"""Train Aurum Guard's probability gate from synchronized MT5 bars.

Training is chronological: oldest 60% trains, next 20% selects/calibrates, and
newest 20% is a locked test.  This script never submits an order.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from aurum_guard_ai_core import (
    AurumProbabilityModel,
    FEATURE_COLUMNS,
    add_triple_barrier_labels,
    build_feature_frame,
    choose_temperature,
    evaluate_threshold,
    fit_softmax,
    probabilities,
    select_threshold,
    training_matrix,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the Aurum Guard Gold/Silver probability gate")
    parser.add_argument("--terminal", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--gold", default="XAUUSD")
    parser.add_argument("--silver", default="XAGUSD")
    parser.add_argument("--bars", type=int, default=75000)
    parser.add_argument("--horizon", type=int, default=15)
    parser.add_argument("--target-atr", type=float, default=1.25)
    parser.add_argument("--stop-atr", type=float, default=1.00)
    parser.add_argument("--model", type=Path, default=Path("aurum_guard_ai_model.json"))
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


def class_counts(values: np.ndarray) -> dict[str, int]:
    return {str(label): int((values == label).sum()) for label in (-1, 0, 1)}


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

    feature_frame = build_feature_frame(gold, silver)
    labelled = add_triple_barrier_labels(feature_frame, args.horizon, args.target_atr, args.stop_atr)
    x, y, utility_long, usable = training_matrix(labelled)
    if len(x) < 20000:
        raise SystemExit(f"Only {len(x)} usable synchronized samples; at least 20,000 are required")

    train_end = int(len(x) * 0.60)
    validation_end = int(len(x) * 0.80)
    x_train, y_train = x[:train_end], y[:train_end]
    x_validation, y_validation = x[train_end:validation_end], y[train_end:validation_end]
    x_test, y_test = x[validation_end:], y[validation_end:]
    utility_validation = utility_long[train_end:validation_end]
    utility_test = utility_long[validation_end:]

    mean, scale, weights, bias = fit_softmax(x_train, y_train)
    temperature = choose_temperature(x_validation, y_validation, mean, scale, weights, bias)
    validation_probability = probabilities(x_validation, mean, scale, weights, bias, temperature)
    threshold, validation_report = select_threshold(y_validation, utility_validation, validation_probability)
    test_probability = probabilities(x_test, mean, scale, weights, bias, temperature)
    test_report = evaluate_threshold(y_test, utility_test, test_probability, threshold)

    # A model is never promoted merely because it fitted the training period.
    # Both untouched chronological segments must show a modest positive edge,
    # enough observations, and better-than-random directional precision.
    deployment_eligible = bool(
        validation_report["approved_signals"] >= 100
        and validation_report["mean_atr_utility"] > 0.0
        and test_report["approved_signals"] >= 100
        and test_report["directional_precision"] >= 0.55
        and test_report["mean_atr_utility"] > 0.0
    )

    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    model_id = datetime.now(timezone.utc).strftime("ag-%Y%m%d-%H%M%S")
    metadata = {
        "trained_at_utc": trained_at,
        "gold_symbol": args.gold,
        "silver_symbol": args.silver,
        "timeframe": "M1",
        "horizon_bars": args.horizon,
        "target_atr": args.target_atr,
        "stop_atr": args.stop_atr,
        "samples": len(x),
        "train_samples": len(x_train),
        "validation_samples": len(x_validation),
        "test_samples": len(x_test),
        "train_period_utc": [
            datetime.fromtimestamp(int(usable.iloc[0]["time"]), timezone.utc).isoformat(),
            datetime.fromtimestamp(int(usable.iloc[train_end - 1]["time"]), timezone.utc).isoformat(),
        ],
        "validation_period_utc": [
            datetime.fromtimestamp(int(usable.iloc[train_end]["time"]), timezone.utc).isoformat(),
            datetime.fromtimestamp(int(usable.iloc[validation_end - 1]["time"]), timezone.utc).isoformat(),
        ],
        "test_period_utc": [
            datetime.fromtimestamp(int(usable.iloc[validation_end]["time"]), timezone.utc).isoformat(),
            datetime.fromtimestamp(int(usable.iloc[-1]["time"]), timezone.utc).isoformat(),
        ],
        "class_counts": class_counts(y),
        "validation": validation_report,
        "locked_test": test_report,
        "deployment_eligible": deployment_eligible,
        "deployment_status": (
            "PASSED RESEARCH GATE - FORWARD DEMO STILL REQUIRED"
            if deployment_eligible
            else "FAILED RESEARCH GATE - SHADOW ONLY"
        ),
        "warning": "Research probabilities are not guaranteed win rates or profit forecasts.",
    }
    model = AurumProbabilityModel(mean, scale, weights, bias, temperature, threshold, model_id, metadata)
    model.save(args.model)
    args.report.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(json.dumps({"model": str(args.model), "model_id": model_id, **metadata}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
