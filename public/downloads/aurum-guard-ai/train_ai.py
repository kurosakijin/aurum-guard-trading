"""Train the execution-aligned Aurum Guard protected-outcome classifier."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import ExtraTreesClassifier
from threadpoolctl import threadpool_limits

from aurum_guard_ai_core import AurumProbabilityModel, add_protected_trade_outcomes, build_feature_frame, evaluate_protected_trades, protected_training_matrix

DEFAULT_THRESHOLD = 0.525
DEFAULT_HORIZON = 60
DEFAULT_STOP_ATR = 1.25
DEFAULT_TARGET_R = 20.0 / 7.5
DEFAULT_COST_R = 0.10


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Aurum Guard execution-aligned M1 AI")
    parser.add_argument("--terminal", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--gold", default="XAUUSD")
    parser.add_argument("--silver", default="XAGUSD")
    parser.add_argument("--bars", type=int, default=75000)
    parser.add_argument("--model", type=Path, default=Path("aurum_guard_ai_model.joblib"))
    parser.add_argument("--report", type=Path, default=Path("aurum_guard_ai_report.json"))
    parser.add_argument("--snapshot", type=Path, default=Path("aurum_guard_ai_research_snapshot.joblib"))
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


def new_estimator(seed: int) -> ExtraTreesClassifier:
    return ExtraTreesClassifier(n_estimators=300, max_depth=6, min_samples_leaf=20, max_features=0.65, class_weight="balanced", n_jobs=1, random_state=seed)


def period(usable: pd.DataFrame, first: int, last: int) -> list[str]:
    return [datetime.fromtimestamp(int(usable.iloc[first]["time"]), timezone.utc).isoformat(), datetime.fromtimestamp(int(usable.iloc[last]["time"]), timezone.utc).isoformat()]


def score_slice(probability, utility, exit_bar, usable, start, end):
    return evaluate_protected_trades(probability, DEFAULT_THRESHOLD, utility[start:end], exit_bar[start:end], usable.iloc[start:end]["bar_index"].to_numpy(dtype=np.int64))


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

    joblib.dump({"captured_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "gold": gold, "silver": silver}, args.snapshot, compress=3)

    features = build_feature_frame(gold, silver)
    labelled = add_protected_trade_outcomes(features, DEFAULT_HORIZON, DEFAULT_STOP_ATR, DEFAULT_TARGET_R, DEFAULT_COST_R)
    x, y, utility, exit_bar, usable = protected_training_matrix(labelled)
    if len(x) < 3000:
        raise SystemExit(f"Only {len(x)} defended candidates; at least 3,000 are required")

    quarantine_start = int(len(x) * 0.85)
    quarantine_start_bar = int(usable.iloc[quarantine_start]["bar_index"])
    dev_end = int(np.searchsorted(usable["bar_index"].to_numpy(), quarantine_start_bar - DEFAULT_HORIZON, side="right"))
    fold_edges = np.linspace(int(dev_end * 0.35), dev_end, 5, dtype=int)
    fold_reports, oof_probability, oof_utility, oof_exit, oof_bars = [], [], [], [], []
    for fold_number, (validation_start, validation_end) in enumerate(zip(fold_edges[:-1], fold_edges[1:]), start=1):
        validation_start_bar = int(usable.iloc[validation_start]["bar_index"])
        train_end = int(np.searchsorted(usable["bar_index"].to_numpy(), validation_start_bar - DEFAULT_HORIZON, side="right"))
        estimator = new_estimator(52000 + fold_number)
        with threadpool_limits(limits=1):
            estimator.fit(x[:train_end], y[:train_end])
        probability = estimator.predict_proba(x[validation_start:validation_end])[:, 1]
        report = score_slice(probability, utility, exit_bar, usable, validation_start, validation_end)
        report.update({"fold": fold_number, "train_candidates": int(train_end), "test_candidates": int(validation_end - validation_start)})
        fold_reports.append(report)
        oof_probability.append(probability)
        oof_utility.append(utility[validation_start:validation_end])
        oof_exit.append(exit_bar[validation_start:validation_end])
        oof_bars.append(usable.iloc[validation_start:validation_end]["bar_index"].to_numpy(dtype=np.int64))
    development = evaluate_protected_trades(np.concatenate(oof_probability), DEFAULT_THRESHOLD, np.concatenate(oof_utility), np.concatenate(oof_exit), np.concatenate(oof_bars))

    final_estimator = new_estimator(52999)
    with threadpool_limits(limits=1):
        final_estimator.fit(x[:dev_end], y[:dev_end])
    quarantine_probability = final_estimator.predict_proba(x[quarantine_start:])[:, 1]
    quarantine = score_slice(quarantine_probability, utility, exit_bar, usable, quarantine_start, len(x))
    positive_folds = int(sum(float(report["net_r"]) > 0.0 for report in fold_reports))
    deployment_eligible = bool(
        development["trades"] >= 300 and positive_folds == 4 and development["profit_factor"] >= 1.20
        and development["lower_confidence_r"] > 0.0 and development["max_drawdown_r"] <= 6.0
        and quarantine["trades"] >= 75 and quarantine["profit_factor"] >= 1.25 and quarantine["net_r"] > 0.0
        and quarantine["lower_confidence_r"] > 0.0 and quarantine["max_drawdown_r"] <= 5.0
    )

    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    model_id = datetime.now(timezone.utc).strftime("ag-protected-%Y%m%d-%H%M%S")
    metadata = {
        "model_type": "execution-aligned protected-outcome Extra Trees classifier",
        "trained_at_utc": trained_at, "gold_symbol": args.gold, "silver_symbol": args.silver, "timeframe": "M1",
        "horizon_bars": DEFAULT_HORIZON, "minimum_stop_atr": DEFAULT_STOP_ATR, "final_target_r": DEFAULT_TARGET_R,
        "estimated_round_trip_cost_r": DEFAULT_COST_R,
        "profit_protection_r": {"break_even_trigger": 0.40, "profit_lock_trigger": 0.80, "locked_profit": 0.20, "trailing_trigger": 4.0 / 3.0, "trailing_giveback": 0.40},
        "threshold": DEFAULT_THRESHOLD, "synchronized_bars": int(len(features)), "defended_candidates": int(len(x)),
        "development_candidates": int(dev_end), "quarantine_candidates": int(len(x) - quarantine_start),
        "development_period_utc": period(usable, 0, dev_end - 1), "quarantine_period_utc": period(usable, quarantine_start, len(usable) - 1),
        "development_walk_forward": development, "development_folds": fold_reports, "positive_development_folds": positive_folds,
        "quarantine": quarantine, "deployment_eligible": deployment_eligible,
        "deployment_status": "PASSED RESEARCH GATE - FORWARD DEMO STILL REQUIRED" if deployment_eligible else "FAILED RESEARCH GATE - SHADOW ONLY",
        "warning": "Positive retrospective performance is not a profit forecast; this model still requires untouched forward-demo evidence.",
    }
    feature_low = np.quantile(x[:dev_end], 0.01, axis=0)
    feature_high = np.quantile(x[:dev_end], 0.99, axis=0)
    AurumProbabilityModel(final_estimator, DEFAULT_THRESHOLD, model_id, metadata, feature_low, feature_high).save(args.model)
    args.report.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"model": str(args.model), "model_id": model_id, **metadata}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
