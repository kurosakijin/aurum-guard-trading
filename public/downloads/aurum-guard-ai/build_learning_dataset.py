"""Build a leakage-labelled research table from a frozen MT5 Gold/Silver snapshot.

The resulting CSV is for offline model research only. Outcome and exit columns
look into the future and must never be passed to the live decision model.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from aurum_guard_ai_core import (
    ORIENTED_FEATURE_COLUMNS,
    add_protected_trade_outcomes,
    build_feature_frame,
    protected_training_matrix,
)
from train_ai import DEFAULT_COST_R, DEFAULT_HORIZON, DEFAULT_STOP_ATR, DEFAULT_TARGET_R


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the Aurum Guard causal learning table")
    parser.add_argument("--snapshot", type=Path, default=Path("aurum_guard_ai_research_snapshot.joblib"))
    parser.add_argument("--output", type=Path, default=Path("aurum_guard_learning_dataset.csv"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.snapshot.exists():
        raise SystemExit("Snapshot not found. Run train_ai.cmd once on your MT5 demo history.")
    snapshot = joblib.load(args.snapshot)
    features = build_feature_frame(snapshot["gold"], snapshot["silver"])
    labelled = add_protected_trade_outcomes(
        features, DEFAULT_HORIZON, DEFAULT_STOP_ATR, DEFAULT_TARGET_R, DEFAULT_COST_R
    )
    x, y, utility, exit_bar, usable = protected_training_matrix(labelled)

    quarantine_start = int(len(x) * 0.85)
    quarantine_start_bar = int(usable.iloc[quarantine_start]["bar_index"])
    development_end = int(
        np.searchsorted(
            usable["bar_index"].to_numpy(),
            quarantine_start_bar - DEFAULT_HORIZON,
            side="right",
        )
    )
    split = np.full(len(x), "quarantine", dtype=object)
    split[:development_end] = "development"
    split[development_end:quarantine_start] = "leakage_gap_do_not_train"

    output = pd.DataFrame(x, columns=ORIENTED_FEATURE_COLUMNS)
    output.insert(0, "timestamp_utc", pd.to_datetime(usable["time"], unit="s", utc=True).astype(str))
    output.insert(1, "split", split)
    output.insert(2, "direction", np.where(usable["direction"].to_numpy() > 0, "BUY", "SELL"))
    output["protected_utility_r_LABEL_ONLY"] = utility
    output["positive_outcome_LABEL_ONLY"] = y
    output["exit_bar_LABEL_ONLY"] = exit_bar
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.to_csv(args.output, index=False)
    print(
        f"Wrote {len(output):,} candidates to {args.output} at "
        f"{datetime.now(timezone.utc).replace(microsecond=0).isoformat()}"
    )
    print("IMPORTANT: columns ending LABEL_ONLY use future prices and are forbidden in live inputs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
