"""Search conservative analysis-only probability models on chronological data.

Candidate architecture and confidence threshold are selected only from purged
walk-forward development folds.  The newest 15% is evaluated once afterward as
a confirmation period.  A high win rate with too few observations is rejected.
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
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.frozen import FrozenEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import RobustScaler
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
from train_ai_v8 import calibration_report

HORIZON = 60
STOP_ATR = 1.25
TARGET_R = 20.0 / 7.5
COST_R = 0.10
MIN_SELECTION_TRADES = 45


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Asheparte AI v9 analysis-only model search")
    parser.add_argument("--snapshot", type=Path, default=Path("asheparte_ai_v9_snapshot.joblib"))
    parser.add_argument("--model", type=Path, default=Path("asheparte_ai_v9_shadow.joblib"))
    parser.add_argument("--report", type=Path, default=Path("asheparte_ai_v9_report.json"))
    return parser.parse_args()


def specs() -> list[dict]:
    candidates: list[dict] = []
    for depth, leaf, features in [
        (4, 20, 0.45), (4, 36, 0.65), (6, 20, 0.45), (6, 28, 0.65),
        (6, 40, 0.80), (8, 20, 0.45), (8, 32, 0.65), (8, 48, 0.80),
    ]:
        candidates.append({"family": "extra_trees", "max_depth": depth, "min_samples_leaf": leaf, "max_features": features})
    for depth, leaf, features in [
        (4, 18, 0.45), (4, 32, 0.65), (6, 18, 0.45), (6, 30, 0.65),
        (8, 24, 0.55), (8, 40, 0.75),
    ]:
        candidates.append({"family": "random_forest", "max_depth": depth, "min_samples_leaf": leaf, "max_features": features})
    for leaf, learning_rate, regularization in [
        (20, 0.03, 2.0), (30, 0.03, 5.0), (40, 0.05, 5.0), (50, 0.05, 10.0),
    ]:
        candidates.append({"family": "hist_gradient_boosting", "max_leaf_nodes": 15, "min_samples_leaf": leaf, "learning_rate": learning_rate, "l2_regularization": regularization})
    for regularization in (0.15, 0.40):
        candidates.append({"family": "logistic", "C": regularization})
    return candidates


def estimator(spec: dict, seed: int):
    family = spec["family"]
    if family == "extra_trees":
        return ExtraTreesClassifier(
            n_estimators=450, max_depth=spec["max_depth"], min_samples_leaf=spec["min_samples_leaf"],
            max_features=spec["max_features"], class_weight="balanced", n_jobs=1, random_state=seed,
        )
    if family == "random_forest":
        return RandomForestClassifier(
            n_estimators=450, max_depth=spec["max_depth"], min_samples_leaf=spec["min_samples_leaf"],
            max_features=spec["max_features"], class_weight="balanced_subsample", n_jobs=1, random_state=seed,
        )
    if family == "hist_gradient_boosting":
        return HistGradientBoostingClassifier(
            max_iter=220, max_leaf_nodes=spec["max_leaf_nodes"], min_samples_leaf=spec["min_samples_leaf"],
            learning_rate=spec["learning_rate"], l2_regularization=spec["l2_regularization"],
            class_weight="balanced", random_state=seed,
        )
    return make_pipeline(
        RobustScaler(),
        LogisticRegression(C=spec["C"], class_weight="balanced", max_iter=2000, random_state=seed),
    )


def fit_calibrated(spec: dict, x_train, y_train, x_cal, y_cal, seed: int):
    base = estimator(spec, seed)
    with threadpool_limits(limits=1):
        base.fit(x_train, y_train)
        calibrated = CalibratedClassifierCV(FrozenEstimator(base), method="sigmoid")
        calibrated.fit(x_cal, y_cal)
    return calibrated


def purged_end(bars: np.ndarray, boundary_index: int) -> int:
    boundary_bar = int(bars[boundary_index])
    return int(np.searchsorted(bars, boundary_bar - HORIZON, side="right"))


def period(usable, start: int, end: int) -> list[str]:
    return [
        datetime.fromtimestamp(int(usable.iloc[start]["time"]), timezone.utc).isoformat(),
        datetime.fromtimestamp(int(usable.iloc[end - 1]["time"]), timezone.utc).isoformat(),
    ]


def win_rate_lower_bound(wins: int, trades: int, z: float = 1.645) -> float:
    if trades <= 0:
        return 0.0
    p = wins / trades
    denominator = 1.0 + z * z / trades
    center = p + z * z / (2.0 * trades)
    radius = z * math.sqrt(p * (1.0 - p) / trades + z * z / (4.0 * trades * trades))
    return (center - radius) / denominator


def json_default(value):
    """Serialize NumPy scalars without weakening the stored numeric types."""
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def select_threshold(probability, utility, exits, bars) -> tuple[float, dict]:
    reports: list[dict] = []
    for threshold in np.arange(0.35, 0.801, 0.025):
        report = evaluate_protected_trades(probability, float(threshold), utility, exits, bars)
        report["threshold"] = float(threshold)
        report["win_rate_lower_90"] = win_rate_lower_bound(int(report["wins"]), int(report["trades"]))
        reports.append(report)
    eligible = [
        report for report in reports
        if report["trades"] >= MIN_SELECTION_TRADES
        and report["net_r"] > 0.0
        and report["profit_factor"] >= 1.05
        and report["max_drawdown_r"] <= 12.0
    ]
    if not eligible:
        eligible = [report for report in reports if report["trades"] >= MIN_SELECTION_TRADES]
    if not eligible:
        eligible = reports
    best = max(
        eligible,
        key=lambda report: (
            float(report["win_rate_lower_90"]),
            float(report["mean_r"]),
            -float(report["max_drawdown_r"]),
        ),
    )
    return float(best["threshold"]), best


def main() -> int:
    args = parse_args()
    snapshot = joblib.load(args.snapshot)
    frame = build_feature_frame(snapshot["gold"], snapshot["silver"])
    labelled = add_protected_trade_outcomes(frame, HORIZON, STOP_ATR, TARGET_R, COST_R)
    x, y, utility, exits, usable = protected_training_matrix(labelled, FEATURE_COLUMNS, V8_ORIENTED_FEATURE_COLUMNS)
    bars = usable["bar_index"].to_numpy(dtype=np.int64)
    confirmation_start = int(len(x) * 0.85)
    development_end = purged_end(bars, confirmation_start)
    fold_edges = np.linspace(int(development_end * 0.45), development_end, 4, dtype=int)

    candidate_specs = specs()
    candidate_reports: list[dict] = []
    for candidate_number, spec in enumerate(candidate_specs, start=1):
        fold_outputs = []
        all_probability, all_utility, all_exits, all_bars = [], [], [], []
        for fold, (start, end) in enumerate(zip(fold_edges[:-1], fold_edges[1:]), start=1):
            calibration_start = max(500, int(start * 0.80))
            train_end = purged_end(bars, calibration_start)
            calibration_end = purged_end(bars, start)
            model = fit_calibrated(
                spec, x[:train_end], y[:train_end],
                x[calibration_start:calibration_end], y[calibration_start:calibration_end],
                90000 + candidate_number * 10 + fold,
            )
            probability = model.predict_proba(x[start:end])[:, 1]
            all_probability.append(probability)
            all_utility.append(utility[start:end])
            all_exits.append(exits[start:end])
            all_bars.append(bars[start:end])
            fold_outputs.append({"fold": fold, "period_utc": period(usable, start, end), "probability": probability,
                                 "utility": utility[start:end], "exits": exits[start:end], "bars": bars[start:end]})

        joined_probability = np.concatenate(all_probability)
        joined_utility = np.concatenate(all_utility)
        joined_exits = np.concatenate(all_exits)
        joined_bars = np.concatenate(all_bars)
        threshold, aggregate = select_threshold(joined_probability, joined_utility, joined_exits, joined_bars)
        folds = []
        for output in fold_outputs:
            report = evaluate_protected_trades(output["probability"], threshold, output["utility"], output["exits"], output["bars"])
            report.update({"fold": output["fold"], "period_utc": output["period_utc"]})
            folds.append(report)
        positive_folds = sum(float(report["net_r"]) > 0.0 for report in folds)
        robust = bool(
            aggregate["trades"] >= MIN_SELECTION_TRADES
            and aggregate["net_r"] > 0.0
            and aggregate["profit_factor"] >= 1.05
            and aggregate["max_drawdown_r"] <= 12.0
            and positive_folds >= 2
        )
        candidate_reports.append({"spec": spec, "threshold": threshold, "aggregate": aggregate,
                                  "folds": folds, "positive_folds": positive_folds, "robust": robust})
        print(f"[{candidate_number:02d}/{len(candidate_specs)}] {spec['family']} threshold={threshold:.3f} "
              f"trades={aggregate['trades']} win={aggregate['win_rate']:.1%} net={aggregate['net_r']:.2f}R "
              f"PF={aggregate['profit_factor']:.2f} folds={positive_folds}/3 robust={robust}", flush=True)

    robust_candidates = [candidate for candidate in candidate_reports if candidate["robust"]]
    if robust_candidates:
        selected = max(
            robust_candidates,
            key=lambda candidate: (
                float(candidate["aggregate"]["win_rate_lower_90"]),
                float(candidate["aggregate"]["mean_r"]),
            ),
        )
    else:
        # A high aggregate precision is not useful if it came from one isolated
        # regime. Prefer repeatability across time when no candidate clears the
        # formal gate, then keep the result in shadow-only status.
        selected = max(
            candidate_reports,
            key=lambda candidate: (
                int(candidate["positive_folds"]),
                sum(int(fold["trades"] >= 20) for fold in candidate["folds"]),
                float(candidate["aggregate"]["win_rate_lower_90"]),
                float(candidate["aggregate"]["mean_r"]),
            ),
        )

    final_calibration_start = int(development_end * 0.84)
    final_train_end = purged_end(bars, final_calibration_start)
    final_calibration_end = purged_end(bars, confirmation_start)
    confirmation_model = fit_calibrated(
        selected["spec"], x[:final_train_end], y[:final_train_end],
        x[final_calibration_start:final_calibration_end], y[final_calibration_start:final_calibration_end], 99991,
    )
    confirmation_probability = confirmation_model.predict_proba(x[confirmation_start:])[:, 1]
    confirmation = evaluate_protected_trades(
        confirmation_probability, selected["threshold"], utility[confirmation_start:], exits[confirmation_start:], bars[confirmation_start:]
    )
    confirmation["period_utc"] = period(usable, confirmation_start, len(x))
    confirmation["calibration"] = calibration_report(y[confirmation_start:], confirmation_probability)

    research_gate_passed = bool(
        selected["robust"]
        and confirmation["trades"] >= 30
        and confirmation["net_r"] > 0.0
        and confirmation["profit_factor"] >= 1.15
        and confirmation["max_drawdown_r"] <= 8.0
        and confirmation["calibration"]["brier_score"] <= 0.25
    )

    # Retrain the selected architecture on all available history for forward
    # shadow analysis. The confirmation report above remains from the model that
    # had never seen the newest period.
    production_calibration_start = int(len(x) * 0.86)
    production_train_end = purged_end(bars, production_calibration_start)
    production_model = fit_calibrated(
        selected["spec"], x[:production_train_end], y[:production_train_end],
        x[production_calibration_start:], y[production_calibration_start:], 99999,
    )
    model_id = datetime.now(timezone.utc).strftime("asheparte-v9-shadow-%Y%m%d-%H%M%S")
    metadata = {
        "model_type": "Asheparte v9 calibrated chronological model search",
        "model_id": model_id,
        "trained_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "analysis_only": True,
        "synchronized_bars": int(len(frame)),
        "defended_candidates": int(len(x)),
        "feature_count": len(V8_ORIENTED_FEATURE_COLUMNS),
        "selected_spec": selected["spec"],
        "deployment_threshold": selected["threshold"],
        "minimum_selection_trades": MIN_SELECTION_TRADES,
        "development_period_utc": period(usable, int(development_end * 0.45), development_end),
        "development_result": selected,
        "newest_confirmation": confirmation,
        "candidate_count": len(candidate_reports),
        "candidate_leaderboard": sorted(
            candidate_reports,
            key=lambda candidate: float(candidate["aggregate"]["win_rate_lower_90"]), reverse=True,
        )[:8],
        "research_gate_passed": research_gate_passed,
        "deployment_eligible": False,
        "deployment_status": "ANALYSIS ONLY - FORWARD SHADOW REQUIRED",
        "warning": "Selection maximizes robust precision, not certainty. Historical probability is not a future win guarantee.",
    }
    feature_low = np.quantile(x, 0.01, axis=0)
    feature_high = np.quantile(x, 0.99, axis=0)
    AurumProbabilityModel(
        production_model, float(selected["threshold"]), model_id, metadata,
        feature_low, feature_high, V8_ORIENTED_FEATURE_COLUMNS,
    ).save(args.model)
    args.report.write_text(json.dumps(metadata, indent=2, default=json_default), encoding="utf-8")
    print(json.dumps({"model": str(args.model), "report": str(args.report), "selected": selected,
                      "confirmation": confirmation, "research_gate_passed": research_gate_passed},
                     indent=2, default=json_default))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
