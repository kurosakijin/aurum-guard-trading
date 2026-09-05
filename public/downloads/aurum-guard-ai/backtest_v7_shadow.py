"""Reproduce the frozen v7 shadow model's chronological diagnostic backtest."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np

from aurum_guard_ai_core import (
    LEGACY_FEATURE_COLUMNS,
    LEGACY_ORIENTED_FEATURE_COLUMNS,
    AurumProbabilityModel,
    add_protected_trade_outcomes,
    build_feature_frame,
    evaluate_protected_trades,
    protected_training_matrix,
)

PLANNED_RISK_USD = 7.50


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backtest the frozen Aurum Guard v7 shadow challenger"
    )
    parser.add_argument("--model", type=Path, default=Path("aurum_guard_ai_v7_shadow.joblib"))
    parser.add_argument(
        "--snapshot", type=Path, default=Path("aurum_guard_ai_research_snapshot.joblib")
    )
    parser.add_argument(
        "--research", type=Path, default=Path("aurum_guard_ai_v7_research_report.json")
    )
    parser.add_argument(
        "--report", type=Path, default=Path("aurum_guard_ai_v7_backtest.json")
    )
    return parser.parse_args()


def dollar_view(metrics: dict[str, float | int]) -> dict[str, float]:
    net_r = float(metrics.get("net_r", 0.0))
    drawdown_r = float(metrics.get("max_drawdown_r", metrics.get("dd_r", 0.0)))
    return {
        "assumed_risk_per_trade_usd": PLANNED_RISK_USD,
        "net_usd": round(net_r * PLANNED_RISK_USD, 2),
        "max_drawdown_usd": round(drawdown_r * PLANNED_RISK_USD, 2),
    }


def main() -> int:
    args = parse_args()
    model = AurumProbabilityModel.load(args.model)
    snapshot = joblib.load(args.snapshot)
    research = json.loads(args.research.read_text(encoding="utf-8"))

    frame = build_feature_frame(snapshot["gold"], snapshot["silver"])
    labelled = add_protected_trade_outcomes(frame)
    x, _, utility, exits, usable = protected_training_matrix(
        labelled, LEGACY_FEATURE_COLUMNS, LEGACY_ORIENTED_FEATURE_COLUMNS
    )

    quarantine_start = int(len(x) * 0.85)
    probabilities = model.predict_success_probability(x[quarantine_start:])
    quarantine = evaluate_protected_trades(
        probabilities,
        model.threshold,
        utility[quarantine_start:],
        exits[quarantine_start:],
        usable.iloc[quarantine_start:]["bar_index"].to_numpy(dtype=np.int64),
    )
    confirmation = research["winner"]["confirmation_fold"]

    output = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "model_id": model.model_id,
        "model_status": model.metadata.get("deployment_status"),
        "decision_timeframe": "M1",
        "threshold": model.threshold,
        "candidate_count": len(x),
        "method": (
            "Frozen packaged model evaluated on the chronological newest 15% of the "
            "labelled snapshot; the untouched confirmation result is copied from the "
            "selection run because the packaged model was later refit on development data."
        ),
        "confirmation_fold_from_selection_run": confirmation,
        "confirmation_approximate_dollars": dollar_view(confirmation),
        "newest_period_diagnostic": quarantine,
        "newest_period_approximate_dollars": dollar_view(quarantine),
        "promotion_eligible": False,
        "reason": (
            "The pre-declared confirmation fold lost money and the newest period has "
            "already been observed. The model must remain shadow/demo-only."
        ),
        "limitations": [
            "OHLC first-touch approximation, not exact MT5 tick execution.",
            "Estimated 0.10R round-trip cost; broker spread spikes, slippage, commissions and gaps can be worse.",
            "Dollar translation assumes $7.50 risk was achieved exactly; actual 0.01-lot risk varies with stop distance and broker contract settings.",
            "Historical performance cannot guarantee a future profit.",
        ],
    }
    args.report.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
