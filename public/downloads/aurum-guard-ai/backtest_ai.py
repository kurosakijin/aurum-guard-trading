"""Reproduce the protected-outcome development and quarantine evaluation."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import joblib
from threadpoolctl import threadpool_limits

from aurum_guard_ai_core import (
    FEATURE_COLUMNS, LEGACY_FEATURE_COLUMNS, LEGACY_ORIENTED_FEATURE_COLUMNS,
    ORIENTED_FEATURE_COLUMNS, add_protected_trade_outcomes, build_feature_frame,
    evaluate_protected_trades, protected_training_matrix,
)
from train_ai import DEFAULT_COST_R, DEFAULT_HORIZON, DEFAULT_STOP_ATR, DEFAULT_TARGET_R, DEFAULT_THRESHOLD, fetch_rates, new_estimator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backtest Aurum Guard protected-outcome AI")
    parser.add_argument("--terminal", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--gold", default="XAUUSD")
    parser.add_argument("--silver", default="XAGUSD")
    parser.add_argument("--bars", type=int, default=75000)
    parser.add_argument("--report", type=Path, default=Path("aurum_guard_ai_backtest.json"))
    parser.add_argument("--snapshot", type=Path, default=Path("aurum_guard_ai_research_snapshot.joblib"))
    parser.add_argument("--multitimeframe-challenger", action="store_true")
    return parser.parse_args()


def score(probability, utility, exit_bar, usable, start, end):
    return evaluate_protected_trades(probability, DEFAULT_THRESHOLD, utility[start:end], exit_bar[start:end], usable.iloc[start:end]["bar_index"].to_numpy(dtype=np.int64))


def main() -> int:
    args = parse_args()
    if args.snapshot.exists():
        snapshot = joblib.load(args.snapshot)
        gold, silver = snapshot["gold"], snapshot["silver"]
    else:
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
    labelled = add_protected_trade_outcomes(frame, DEFAULT_HORIZON, DEFAULT_STOP_ATR, DEFAULT_TARGET_R, DEFAULT_COST_R)
    feature_names = ORIENTED_FEATURE_COLUMNS if args.multitimeframe_challenger else LEGACY_ORIENTED_FEATURE_COLUMNS
    required_names = FEATURE_COLUMNS if args.multitimeframe_challenger else LEGACY_FEATURE_COLUMNS
    x, y, utility, exit_bar, usable = protected_training_matrix(labelled, required_names, feature_names)
    quarantine_start = int(len(x) * 0.85)
    quarantine_start_bar = int(usable.iloc[quarantine_start]["bar_index"])
    dev_end = int(np.searchsorted(usable["bar_index"].to_numpy(), quarantine_start_bar - DEFAULT_HORIZON, side="right"))
    edges = np.linspace(int(dev_end * 0.35), dev_end, 5, dtype=int)
    folds, all_probability, all_utility, all_exit, all_bars = [], [], [], [], []
    for fold_number, (start, end) in enumerate(zip(edges[:-1], edges[1:]), start=1):
        start_bar = int(usable.iloc[start]["bar_index"])
        train_end = int(np.searchsorted(usable["bar_index"].to_numpy(), start_bar - DEFAULT_HORIZON, side="right"))
        estimator = new_estimator(52000 + fold_number)
        with threadpool_limits(limits=1):
            estimator.fit(x[:train_end], y[:train_end])
        probability = estimator.predict_proba(x[start:end])[:, 1]
        report = score(probability, utility, exit_bar, usable, start, end)
        report.update({"fold": fold_number, "train_candidates": int(train_end), "test_candidates": int(end - start)})
        folds.append(report)
        all_probability.append(probability); all_utility.append(utility[start:end]); all_exit.append(exit_bar[start:end])
        all_bars.append(usable.iloc[start:end]["bar_index"].to_numpy(dtype=np.int64))
    development = evaluate_protected_trades(np.concatenate(all_probability), DEFAULT_THRESHOLD, np.concatenate(all_utility), np.concatenate(all_exit), np.concatenate(all_bars))

    final = new_estimator(52999)
    with threadpool_limits(limits=1):
        final.fit(x[:dev_end], y[:dev_end])
    quarantine_probability = final.predict_proba(x[quarantine_start:])[:, 1]
    quarantine = score(quarantine_probability, utility, exit_bar, usable, quarantine_start, len(x))
    positive_folds = int(sum(report["net_r"] > 0 for report in folds))
    passed = bool(
        development["trades"] >= 300 and positive_folds == 4 and development["profit_factor"] >= 1.20
        and development["lower_confidence_r"] > 0 and development["max_drawdown_r"] <= 6
        and quarantine["trades"] >= 75 and quarantine["profit_factor"] >= 1.25 and quarantine["net_r"] > 0
        and quarantine["lower_confidence_r"] > 0 and quarantine["max_drawdown_r"] <= 5
    )
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "method": "causal multi-timeframe challenger" if args.multitimeframe_challenger else "execution-aligned expanding walk-forward plus quarantined newest period",
        "decision_timeframe": "M1", "context_timeframes": ["M5", "M15", "H1"] if args.multitimeframe_challenger else [],
        "feature_count": len(feature_names),
        "history_period_utc": [datetime.fromtimestamp(int(usable.iloc[0]["time"]), timezone.utc).isoformat(), datetime.fromtimestamp(int(usable.iloc[-1]["time"]), timezone.utc).isoformat()],
        "synchronized_bars": len(frame), "defended_candidates": len(x), "threshold": DEFAULT_THRESHOLD,
        "horizon_bars": DEFAULT_HORIZON, "minimum_stop_atr": DEFAULT_STOP_ATR, "final_target_r": DEFAULT_TARGET_R,
        "estimated_round_trip_cost_r": DEFAULT_COST_R, "development": development,
        "positive_development_folds": positive_folds, "folds": folds, "quarantine": quarantine,
        "strict_deployment_result": "PASS - FORWARD DEMO PROBATION REQUIRED" if passed else "NO TRADES - RESEARCH GATE NOT FULLY PASSED",
        "limitations": [
            "The outcome approximates the EA's $7.50 planned loss, $20 target and stepped profit protection in R units.",
            "Stop changes activate on the following bar and ambiguous OHLC paths are treated conservatively.",
            "This does not reproduce broker ticks, spread spikes, slippage, latency, commissions, news-calendar behavior or the full pending-retest state machine.",
            "The quarantine result has already been observed and cannot replace future untouched demo evidence.",
        ],
    }
    args.report.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
