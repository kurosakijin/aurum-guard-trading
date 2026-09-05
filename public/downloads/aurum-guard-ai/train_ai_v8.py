"""Train a calibrated, multi-timeframe, equity-aware Aurum Guard challenger.

This is research code.  It predicts the probability that a defended setup
finishes profitably under the EA's protected-exit rules.  Equity is deliberately
kept out of the market predictor and is handled by a separate risk controller.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import brier_score_loss, log_loss
from threadpoolctl import threadpool_limits

from aurum_guard_ai_core import (
    FEATURE_COLUMNS,
    V8_ORIENTED_FEATURE_COLUMNS,
    AurumProbabilityModel,
    add_protected_trade_outcomes,
    build_feature_frame,
    evaluate_protected_trades,
    protected_training_matrix,
)

HORIZON = 60
STOP_ATR = 1.25
TARGET_R = 20.0 / 7.5
COST_R = 0.10
PLANNED_RISK_USD = 7.50


def json_default(value):
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Aurum Guard v8 shadow AI")
    parser.add_argument("--snapshot", type=Path, default=Path("aurum_guard_ai_research_snapshot.joblib"))
    parser.add_argument("--model", type=Path, default=Path("aurum_guard_ai_v8_shadow.joblib"))
    parser.add_argument("--report", type=Path, default=Path("aurum_guard_ai_v8_report.json"))
    return parser.parse_args()


def estimator(seed: int) -> ExtraTreesClassifier:
    return ExtraTreesClassifier(
        n_estimators=500,
        max_depth=7,
        min_samples_leaf=24,
        max_features=0.60,
        class_weight="balanced",
        n_jobs=1,
        random_state=seed,
    )


def fit_calibrated(x_train, y_train, x_cal, y_cal, seed: int):
    base = estimator(seed)
    with threadpool_limits(limits=1):
        base.fit(x_train, y_train)
        model = CalibratedClassifierCV(FrozenEstimator(base), method="sigmoid")
        model.fit(x_cal, y_cal)
    return model


def calibration_report(y: np.ndarray, probability: np.ndarray, bins: int = 10) -> dict[str, float]:
    probability = np.clip(np.asarray(probability, dtype=float), 1e-6, 1.0 - 1e-6)
    y = np.asarray(y, dtype=int)
    error = 0.0
    for low, high in zip(np.linspace(0.0, 1.0, bins + 1)[:-1], np.linspace(0.0, 1.0, bins + 1)[1:]):
        selected = (probability >= low) & (probability < high if high < 1.0 else probability <= high)
        if selected.any():
            error += float(selected.mean()) * abs(float(y[selected].mean()) - float(probability[selected].mean()))
    return {
        "brier_score": float(brier_score_loss(y, probability)),
        "log_loss": float(log_loss(y, probability, labels=[0, 1])),
        "expected_calibration_error": float(error),
        "mean_predicted_probability": float(probability.mean()),
        "observed_positive_rate": float(y.mean()),
    }


def equity_aware_backtest(
    probability: np.ndarray,
    threshold: float,
    utility: np.ndarray,
    exit_bar: np.ndarray,
    bar_index: np.ndarray,
) -> dict[str, float | int]:
    """Apply path-dependent safety without using future equity information.

    The controller raises the approval threshold while below the equity peak,
    pauses after two losses, and imposes a longer circuit-breaker pause at 4R
    drawdown.  It never increases size to recover losses.
    """
    trades: list[float] = []
    busy_until = -1
    cooldown_until = -1
    loss_streak = 0
    equity = peak = 0.0
    skipped_cooldown = skipped_drawdown = 0
    for score, result, exit_index, entry_index in zip(probability, utility, exit_bar, bar_index):
        entry_index = int(entry_index)
        if entry_index <= busy_until:
            continue
        if entry_index <= cooldown_until:
            skipped_cooldown += 1
            continue
        drawdown = peak - equity
        threshold_addition = 0.04 if drawdown >= 2.0 else 0.0
        threshold_addition += 0.04 if drawdown >= 3.0 else 0.0
        if score < min(0.90, threshold + threshold_addition):
            if threshold_addition:
                skipped_drawdown += 1
            continue
        value = float(result)
        trades.append(value)
        equity += value
        peak = max(peak, equity)
        busy_until = int(exit_index)
        if value < 0.0:
            loss_streak += 1
            if loss_streak >= 2:
                cooldown_until = busy_until + 30
        else:
            loss_streak = 0
        if peak - equity >= 4.0:
            cooldown_until = max(cooldown_until, busy_until + 240)
    if not trades:
        return {"trades": 0, "wins": 0, "win_rate": 0.0, "net_r": 0.0, "mean_r": -999.0,
                "lower_confidence_r": -999.0, "profit_factor": 0.0, "max_drawdown_r": 0.0,
                "average_win_r": 0.0, "average_loss_r": 0.0,
                "skipped_cooldown": skipped_cooldown, "skipped_drawdown_gate": skipped_drawdown}
    values = np.asarray(trades, dtype=float)
    curve = np.cumsum(values)
    drawdown = np.maximum.accumulate(np.r_[0.0, curve])[1:] - curve
    wins = values[values > 0.0]
    losses = values[values < 0.0]
    standard_error = float(values.std(ddof=1) / math.sqrt(len(values))) if len(values) > 1 else 999.0
    return {
        "trades": int(len(values)), "wins": int(len(wins)), "win_rate": float(len(wins) / len(values)),
        "net_r": float(values.sum()), "mean_r": float(values.mean()),
        "lower_confidence_r": float(values.mean() - 1.645 * standard_error),
        "profit_factor": float(wins.sum() / -losses.sum()) if len(losses) else 999.0,
        "max_drawdown_r": float(drawdown.max()),
        "average_win_r": float(wins.mean()) if len(wins) else 0.0,
        "average_loss_r": float(losses.mean()) if len(losses) else 0.0,
        "skipped_cooldown": skipped_cooldown, "skipped_drawdown_gate": skipped_drawdown,
    }


def choose_threshold(probability, utility, exits, bars) -> tuple[float, dict]:
    candidates = []
    # The protected exit has asymmetric reward/risk and fractional stop-lock
    # outcomes, so a hard 50% classification cutoff is not an economic
    # break-even rule.  Select on realized net-R utility in earlier data.
    for threshold in np.arange(0.30, 0.601, 0.025):
        report = evaluate_protected_trades(probability, float(threshold), utility, exits, bars)
        report["threshold"] = float(threshold)
        candidates.append(report)
    eligible = [r for r in candidates if r["trades"] >= 20 and r["net_r"] > 0 and r["profit_factor"] > 1.0]
    if not eligible:
        return 0.45, next(r for r in candidates if abs(r["threshold"] - 0.45) < 1e-9)
    best = max(eligible, key=lambda r: float(r["lower_confidence_r"]) - 0.02 * float(r["max_drawdown_r"]))
    return float(best["threshold"]), best


def purged_end(bars: np.ndarray, boundary_index: int) -> int:
    boundary_bar = int(bars[boundary_index])
    return int(np.searchsorted(bars, boundary_bar - HORIZON, side="right"))


def period(usable, start: int, end: int) -> list[str]:
    return [
        datetime.fromtimestamp(int(usable.iloc[start]["time"]), timezone.utc).isoformat(),
        datetime.fromtimestamp(int(usable.iloc[end - 1]["time"]), timezone.utc).isoformat(),
    ]


def main() -> int:
    args = parse_args()
    snapshot = joblib.load(args.snapshot)
    frame = build_feature_frame(snapshot["gold"], snapshot["silver"])
    labelled = add_protected_trade_outcomes(frame, HORIZON, STOP_ATR, TARGET_R, COST_R)
    x, y, utility, exits, usable = protected_training_matrix(
        labelled, FEATURE_COLUMNS, V8_ORIENTED_FEATURE_COLUMNS
    )
    if len(x) < 3000:
        raise SystemExit(f"Only {len(x)} defended candidates; at least 3,000 are required")
    bars = usable["bar_index"].to_numpy(dtype=np.int64)

    development_end = int(len(x) * 0.85)
    test_edges = np.linspace(int(development_end * 0.55), development_end, 4, dtype=int)
    folds = []
    selected_thresholds = []
    for fold, (test_start, test_end) in enumerate(zip(test_edges[:-1], test_edges[1:]), start=1):
        window = max(220, int(test_start * 0.12))
        tune_start = test_start - window
        cal_start = tune_start - window
        if cal_start < 500:
            raise SystemExit("Not enough history for purged train/calibrate/tune/test folds")
        train_end = purged_end(bars, cal_start)
        cal_end = purged_end(bars, tune_start)
        tune_end = purged_end(bars, test_start)
        model = fit_calibrated(x[:train_end], y[:train_end], x[cal_start:cal_end], y[cal_start:cal_end], 8000 + fold)
        tune_probability = model.predict_proba(x[tune_start:tune_end])[:, 1]
        threshold, tuning = choose_threshold(
            tune_probability, utility[tune_start:tune_end], exits[tune_start:tune_end], bars[tune_start:tune_end]
        )
        selected_thresholds.append(threshold)
        probability = model.predict_proba(x[test_start:test_end])[:, 1]
        baseline = evaluate_protected_trades(
            probability, threshold, utility[test_start:test_end], exits[test_start:test_end], bars[test_start:test_end]
        )
        controlled = equity_aware_backtest(
            probability, threshold, utility[test_start:test_end], exits[test_start:test_end], bars[test_start:test_end]
        )
        folds.append({
            "fold": fold, "period_utc": period(usable, test_start, test_end), "threshold": threshold,
            "train_candidates": train_end, "calibration_candidates": cal_end - cal_start,
            "threshold_tuning_candidates": tune_end - tune_start, "test_candidates": test_end - test_start,
            "threshold_tuning": tuning, "calibration": calibration_report(y[test_start:test_end], probability),
            "baseline": baseline, "equity_aware": controlled,
        })

    deployment_threshold = float(np.median(selected_thresholds))
    diagnostic_start = development_end
    calibration_start = int(development_end * 0.82)
    train_end = purged_end(bars, calibration_start)
    calibration_end = purged_end(bars, diagnostic_start)
    final_model = fit_calibrated(
        x[:train_end], y[:train_end], x[calibration_start:calibration_end], y[calibration_start:calibration_end], 8999
    )
    diagnostic_probability = final_model.predict_proba(x[diagnostic_start:])[:, 1]
    diagnostic = {
        "period_utc": period(usable, diagnostic_start, len(x)),
        "candidates": int(len(x) - diagnostic_start),
        "calibration": calibration_report(y[diagnostic_start:], diagnostic_probability),
        "baseline": evaluate_protected_trades(
            diagnostic_probability, deployment_threshold, utility[diagnostic_start:], exits[diagnostic_start:], bars[diagnostic_start:]
        ),
        "equity_aware": equity_aware_backtest(
            diagnostic_probability, deployment_threshold, utility[diagnostic_start:], exits[diagnostic_start:], bars[diagnostic_start:]
        ),
    }
    positive_folds = sum(float(f["equity_aware"]["net_r"]) > 0.0 for f in folds)
    controlled = diagnostic["equity_aware"]
    research_gate_passed = bool(
        positive_folds == len(folds)
        and controlled["trades"] >= 30
        and controlled["net_r"] > 0.0
        and controlled["profit_factor"] >= 1.20
        and controlled["max_drawdown_r"] <= 6.0
        and diagnostic["calibration"]["brier_score"] <= 0.25
    )

    model_id = datetime.now(timezone.utc).strftime("ag-v8-shadow-%Y%m%d-%H%M%S")
    metadata = {
        "model_type": "calibrated multi-timeframe Extra Trees protected-outcome classifier",
        "model_id": model_id,
        "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "decision_timeframe": "M1", "context_timeframes": ["M5", "M15", "H1"],
        "feature_count": len(V8_ORIENTED_FEATURE_COLUMNS), "probability_calibration": "sigmoid on later disjoint chronology",
        "outcome": {"horizon_bars": HORIZON, "stop_atr": STOP_ATR, "target_r": TARGET_R, "estimated_cost_r": COST_R},
        "equity_controller": {
            "fixed_planned_risk_usd": PLANNED_RISK_USD, "never_martingale": True,
            "two_loss_cooldown_bars": 30, "drawdown_threshold_increase_at_r": [2.0, 3.0],
            "drawdown_circuit_breaker_r": 4.0, "circuit_breaker_bars": 240,
        },
        "synchronized_bars": int(len(frame)), "defended_candidates": int(len(x)),
        "walk_forward_folds": folds, "positive_equity_aware_folds": positive_folds,
        "deployment_threshold": deployment_threshold, "newest_period_diagnostic": diagnostic,
        "research_gate_passed": research_gate_passed,
        "deployment_eligible": False,
        "deployment_status": "SHADOW ONLY - FORWARD DEMO REQUIRED" if research_gate_passed else "FAILED RESEARCH GATE - SHADOW ONLY",
        "data_status": "The complete snapshot was used in prior research; newest-period results are diagnostic, not a pristine final test.",
        "warning": "Calibrated probabilities are estimates, not certainty. AI cannot predict news shocks or guarantee profit.",
    }
    feature_low = np.quantile(x[:development_end], 0.01, axis=0)
    feature_high = np.quantile(x[:development_end], 0.99, axis=0)
    AurumProbabilityModel(
        final_model, deployment_threshold, model_id, metadata, feature_low, feature_high,
        V8_ORIENTED_FEATURE_COLUMNS,
    ).save(args.model)
    args.report.write_text(json.dumps(metadata, indent=2, default=json_default), encoding="utf-8")
    print(json.dumps({
        "model": str(args.model), "report": str(args.report), "model_id": model_id,
        "research_gate_passed": research_gate_passed, "deployment_status": metadata["deployment_status"],
        "positive_folds": positive_folds, "threshold": deployment_threshold,
        "diagnostic": diagnostic,
    }, indent=2, default=json_default))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
