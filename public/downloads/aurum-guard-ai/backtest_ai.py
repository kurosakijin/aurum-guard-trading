"""Expanding walk-forward shadow backtest for the Aurum Guard AI layer.

Each fold trains only on older candidates, leaves a 15-bar label gap, and then
scores the next chronological block. Trades use a fixed 70% approval threshold,
regime-drift rejection, conservative same-bar stop ordering, estimated costs,
and no overlapping positions. This is not an MT5 fill or slippage simulation.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from threadpoolctl import threadpool_limits

from aurum_guard_ai_core import add_trade_outcomes, build_feature_frame, meta_training_matrix
from train_ai import fetch_rates, new_estimator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backtest Aurum Guard AI with expanding walk-forward folds")
    parser.add_argument("--terminal", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--gold", default="XAUUSD")
    parser.add_argument("--silver", default="XAGUSD")
    parser.add_argument("--bars", type=int, default=75000)
    parser.add_argument("--horizon", type=int, default=15)
    parser.add_argument("--target-atr", type=float, default=1.25)
    parser.add_argument("--stop-atr", type=float, default=1.00)
    parser.add_argument("--cost-atr", type=float, default=0.10)
    parser.add_argument("--threshold", type=float, default=0.70)
    parser.add_argument("--report", type=Path, default=Path("aurum_guard_ai_backtest.json"))
    return parser.parse_args()


def simulate_trade(frame, row, direction: int, horizon: int, target_atr: float, stop_atr: float, cost_atr: float) -> tuple[float, int, str]:
    index = int(row["bar_index"])
    entry = float(row["close"])
    atr = float(row["atr"])
    target = entry + direction * atr * target_atr
    stop = entry - direction * atr * stop_atr
    last_index = min(index + horizon, len(frame) - 1)
    for future_index in range(index + 1, last_index + 1):
        future = frame.iloc[future_index]
        target_hit = float(future["high"]) >= target if direction > 0 else float(future["low"]) <= target
        stop_hit = float(future["low"]) <= stop if direction > 0 else float(future["high"]) >= stop
        if stop_hit:  # conservative when both levels appear inside one M1 bar
            return -stop_atr - cost_atr, future_index, "SL"
        if target_hit:
            return target_atr - cost_atr, future_index, "TP"
    terminal_move = direction * (float(frame.iloc[last_index]["close"]) - entry) / atr
    return float(np.clip(terminal_move, -stop_atr, target_atr) - cost_atr), last_index, "TIME"


def metrics(trades: list[dict]) -> dict[str, float | int]:
    if not trades:
        return {"trades": 0, "wins": 0, "losses": 0, "win_rate": 0.0, "net_atr": 0.0, "average_atr": 0.0, "profit_factor": 0.0, "max_drawdown_atr": 0.0}
    pnl = np.asarray([trade["net_atr"] for trade in trades], dtype=float)
    equity = np.cumsum(pnl)
    running_peak = np.maximum.accumulate(np.r_[0.0, equity])
    drawdown = running_peak[1:] - equity
    gross_profit = float(pnl[pnl > 0].sum())
    gross_loss = float(-pnl[pnl < 0].sum())
    return {
        "trades": len(trades),
        "wins": int((pnl > 0).sum()),
        "losses": int((pnl <= 0).sum()),
        "win_rate": float((pnl > 0).mean()),
        "net_atr": float(pnl.sum()),
        "average_atr": float(pnl.mean()),
        "profit_factor": float(gross_profit / gross_loss) if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0),
        "max_drawdown_atr": float(drawdown.max()) if len(drawdown) else 0.0,
        "long_trades": int(sum(trade["direction"] > 0 for trade in trades)),
        "short_trades": int(sum(trade["direction"] < 0 for trade in trades)),
    }


def main() -> int:
    args = parse_args()
    if not 0.50 <= args.threshold <= 0.99:
        raise SystemExit("Threshold must be between 0.50 and 0.99")
    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        raise SystemExit("Install requirements-ai.txt before backtesting") from exc
    if not mt5.initialize(path=args.terminal):
        raise SystemExit(f"MT5 connection failed: {mt5.last_error()}")
    try:
        gold = fetch_rates(mt5, args.gold, args.bars)
        silver = fetch_rates(mt5, args.silver, args.bars)
    finally:
        mt5.shutdown()

    frame = build_feature_frame(gold, silver)
    labelled = add_trade_outcomes(frame, args.horizon, args.target_atr, args.stop_atr, args.cost_atr)
    x, y, utility, usable = meta_training_matrix(labelled)
    if len(x) < 3000:
        raise SystemExit(f"Only {len(x)} defended candidates; at least 3,000 are required")

    fold_edges = np.linspace(int(len(x) * 0.40), len(x), 5, dtype=int)
    all_trades: list[dict] = []
    fold_reports: list[dict] = []
    busy_until = -1
    total_probability_approvals = 0
    drift_blocks = 0
    overlap_blocks = 0

    for fold_number, (test_start, test_end) in enumerate(zip(fold_edges[:-1], fold_edges[1:]), start=1):
        test_start_bar = int(usable.iloc[test_start]["bar_index"])
        train_end = int(np.searchsorted(usable["bar_index"].to_numpy(), test_start_bar - args.horizon, side="right"))
        estimator = new_estimator(270000 + fold_number)
        with threadpool_limits(limits=1):
            estimator.fit(x[:train_end], y[:train_end])
        probability = estimator.predict_proba(x[test_start:test_end])[:, 1]
        low = np.quantile(x[:train_end], 0.01, axis=0)
        high = np.quantile(x[:train_end], 0.99, axis=0)
        drift_share = ((x[test_start:test_end] < low) | (x[test_start:test_end] > high)).mean(axis=1)
        fold_trades: list[dict] = []
        fold_approvals = 0
        fold_drift_blocks = 0

        for offset, candidate_probability in enumerate(probability):
            candidate_index = test_start + offset
            if candidate_probability < args.threshold:
                continue
            fold_approvals += 1
            total_probability_approvals += 1
            if drift_share[offset] > 0.15:
                fold_drift_blocks += 1
                drift_blocks += 1
                continue
            row = usable.iloc[candidate_index]
            entry_bar = int(row["bar_index"])
            if entry_bar <= busy_until:
                overlap_blocks += 1
                continue
            direction = int(row["direction"])
            net_atr, exit_bar, exit_reason = simulate_trade(labelled, row, direction, args.horizon, args.target_atr, args.stop_atr, args.cost_atr)
            trade = {
                "fold": fold_number,
                "entry_time_utc": datetime.fromtimestamp(int(row["time"]), timezone.utc).isoformat(),
                "direction": direction,
                "probability": float(candidate_probability),
                "drift_share": float(drift_share[offset]),
                "net_atr": net_atr,
                "exit_reason": exit_reason,
            }
            fold_trades.append(trade)
            all_trades.append(trade)
            busy_until = exit_bar

        fold_reports.append({
            "fold": fold_number,
            "train_candidates": train_end,
            "test_candidates": int(test_end - test_start),
            "probability_approvals": fold_approvals,
            "drift_blocks": fold_drift_blocks,
            **metrics(fold_trades),
        })

    summary = metrics(all_trades)
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "method": "expanding walk-forward shadow backtest",
        "gold_symbol": args.gold,
        "silver_symbol": args.silver,
        "timeframe": "M1",
        "history_period_utc": [
            datetime.fromtimestamp(int(usable.iloc[0]["time"]), timezone.utc).isoformat(),
            datetime.fromtimestamp(int(usable.iloc[-1]["time"]), timezone.utc).isoformat(),
        ],
        "synchronized_bars": len(frame),
        "defended_candidates": len(x),
        "threshold": args.threshold,
        "horizon_bars": args.horizon,
        "target_atr": args.target_atr,
        "stop_atr": args.stop_atr,
        "estimated_round_trip_cost_atr": args.cost_atr,
        "probability_approvals_before_safety": total_probability_approvals,
        "regime_drift_blocks": drift_blocks,
        "overlap_blocks": overlap_blocks,
        "summary": summary,
        "folds": fold_reports,
        "strict_deployment_result": "NO TRADES - MODEL FAILED RESEARCH PROMOTION GATE",
        "limitations": [
            "AI shadow layer only; not a replay of the full EA entry/retest logic.",
            "M1 OHLC bars cannot reveal the true tick order when TP and SL are inside the same bar; the simulator counts that as SL.",
            "Cost is an ATR estimate and does not reproduce broker slippage, latency, commissions, swaps, or spread spikes.",
            "Historical results do not predict future profit.",
        ],
    }
    args.report.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
