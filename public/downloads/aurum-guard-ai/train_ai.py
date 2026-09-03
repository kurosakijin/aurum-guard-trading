"""Train the nonlinear Aurum Guard meta-label approval model.

Threshold selection uses expanding walk-forward folds with a label horizon gap.
The newest 15% is held back for one final research check. No order is submitted.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier

from aurum_guard_ai_core import (
    AurumProbabilityModel,
    add_trade_outcomes,
    build_feature_frame,
    evaluate_threshold,
    meta_training_matrix,
    select_threshold,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the Aurum Guard nonlinear M1 approval gate")
    parser.add_argument("--terminal", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--gold", default="XAUUSD")
    parser.add_argument("--silver", default="XAGUSD")
    parser.add_argument("--bars", type=int, default=75000)
    parser.add_argument("--horizon", type=int, default=15)
    parser.add_argument("--target-atr", type=float, default=1.25)
    parser.add_argument("--stop-atr", type=float, default=1.00)
    parser.add_argument("--cost-atr", type=float, default=0.10)
    parser.add_argument("--model", type=Path, default=Path("aurum_guard_ai_model.joblib"))
    parser.add_argument("--report", type=Path, default=Path("aurum_guard_ai_report.json"))
    return parser.parse_args()


def fetch_rates(mt5: object, symbol: str, bars: int) -> pd.DataFrame:
    if not mt5.symbol_select(symbol, True):
        raise RuntimeError(f"MT5 cannot select {symbol}; use the broker's exact Market Watch name")
    attempts = []
    for count in dict.fromkeys([bars, min(bars, 75000), min(bars, 60000), min(bars, 50000)]):
        if count < 1000:
            continue
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, count)
        attempts.append(count)
        if rates is not None and len(rates) >= min(20000, count):
            return pd.DataFrame(rates)
    raise RuntimeError(f"MT5 returned insufficient {symbol} M1 history after requests {attempts}: {mt5.last_error()}")


def new_estimator(seed: int) -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        loss="log_loss",
        learning_rate=0.045,
        max_iter=180,
        max_leaf_nodes=15,
        max_depth=4,
        min_samples_leaf=80,
        l2_regularization=2.0,
        early_stopping=False,
        random_state=seed,
    )


def period(usable: pd.DataFrame, first: int, last: int) -> list[str]:
    return [
        datetime.fromtimestamp(int(usable.iloc[first]["time"]), timezone.utc).isoformat(),
        datetime.fromtimestamp(int(usable.iloc[last]["time"]), timezone.utc).isoformat(),
    ]


def main() -> int:
    args = parse_args()
    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        raise SystemExit("Install requirements-ai.txt before training") from exc

    if not mt5.initialize(path=args.terminal):
        raise SystemExit(f"MT5 connection failed: {mt5.last_error()}")
    try:
        gold = fetch_rates(mt5, args.gold, args.bars)
        silver = fetch_rates(mt5, args.silver, args.bars)
    finally:
        mt5.shutdown()

    features = build_feature_frame(gold, silver)
    labelled = add_trade_outcomes(features, args.horizon, args.target_atr, args.stop_atr, args.cost_atr)
    x, y, utility, usable = meta_training_matrix(labelled)
    if len(x) < 3000:
        raise SystemExit(f"Only {len(x)} defended candidates; at least 3,000 are required")

    test_start = int(len(x) * 0.85)
    test_start_bar = int(usable.iloc[test_start]["bar_index"])
    dev_end = int(np.searchsorted(usable["bar_index"].to_numpy(), test_start_bar - args.horizon, side="right"))
    if dev_end < 2000:
        raise SystemExit("Insufficient pre-test candidates after the leakage gap")

    fold_edges = np.linspace(int(dev_end * 0.40), dev_end, 5, dtype=int)
    oof_y: list[np.ndarray] = []
    oof_utility: list[np.ndarray] = []
    oof_probability: list[np.ndarray] = []
    fold_slices: list[tuple[np.ndarray, np.ndarray, np.ndarray]] = []

    for fold_number, (validation_start, validation_end) in enumerate(zip(fold_edges[:-1], fold_edges[1:]), start=1):
        validation_start_bar = int(usable.iloc[validation_start]["bar_index"])
        train_end = int(np.searchsorted(usable["bar_index"].to_numpy(), validation_start_bar - args.horizon, side="right"))
        estimator = new_estimator(260900 + fold_number)
        estimator.fit(x[:train_end], y[:train_end])
        probability = estimator.predict_proba(x[validation_start:validation_end])[:, 1]
        y_fold = y[validation_start:validation_end]
        utility_fold = utility[validation_start:validation_end]
        oof_y.append(y_fold)
        oof_utility.append(utility_fold)
        oof_probability.append(probability)
        fold_slices.append((y_fold, utility_fold, probability))

    walk_y = np.concatenate(oof_y)
    walk_utility = np.concatenate(oof_utility)
    walk_probability = np.concatenate(oof_probability)
    threshold, walk_report = select_threshold(walk_y, walk_utility, walk_probability)
    fold_reports = [evaluate_threshold(y_fold, utility_fold, probability, threshold) for y_fold, utility_fold, probability in fold_slices]

    final_estimator = new_estimator(260904)
    final_estimator.fit(x[:dev_end], y[:dev_end])
    test_probability = final_estimator.predict_proba(x[test_start:])[:, 1]
    test_report = evaluate_threshold(y[test_start:], utility[test_start:], test_probability, threshold)

    positive_walk_folds = sum(float(report["mean_net_atr_utility"]) > 0.0 for report in fold_reports)
    deployment_eligible = bool(
        walk_report["approved_signals"] >= 100
        and walk_report["lower_confidence_utility"] > 0.0
        and positive_walk_folds >= 3
        and test_report["approved_signals"] >= 50
        and test_report["lower_confidence_utility"] > 0.0
    )

    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    model_id = datetime.now(timezone.utc).strftime("ag-meta-%Y%m%d-%H%M%S")
    metadata = {
        "model_type": "nonlinear defended-entry meta-label classifier",
        "trained_at_utc": trained_at,
        "gold_symbol": args.gold,
        "silver_symbol": args.silver,
        "timeframe": "M1",
        "horizon_bars": args.horizon,
        "target_atr": args.target_atr,
        "stop_atr": args.stop_atr,
        "estimated_round_trip_cost_atr": args.cost_atr,
        "synchronized_bars": len(features),
        "defended_candidates": len(x),
        "development_candidates": dev_end,
        "locked_test_candidates": len(x) - test_start,
        "development_period_utc": period(usable, 0, dev_end - 1),
        "locked_test_period_utc": period(usable, test_start, len(usable) - 1),
        "threshold": threshold,
        "walk_forward": walk_report,
        "walk_forward_folds": fold_reports,
        "positive_walk_forward_folds": positive_walk_folds,
        "locked_test": test_report,
        "deployment_eligible": deployment_eligible,
        "deployment_status": "PASSED RESEARCH GATE - FORWARD DEMO STILL REQUIRED" if deployment_eligible else "FAILED RESEARCH GATE - SHADOW ONLY",
        "warning": "Research probabilities are not guaranteed win rates or profit forecasts.",
    }
    model = AurumProbabilityModel(final_estimator, threshold, model_id, metadata)
    model.save(args.model)
    args.report.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"model": str(args.model), "model_id": model_id, **metadata}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
