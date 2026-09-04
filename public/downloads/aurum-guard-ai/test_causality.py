"""Check that later candles cannot change features at earlier decision times."""

from pathlib import Path

import joblib
import numpy as np

from aurum_guard_ai_core import FEATURE_COLUMNS, build_feature_frame


snapshot = joblib.load(Path("aurum_guard_ai_research_snapshot.joblib"))
gold, silver = snapshot["gold"], snapshot["silver"]
full = build_feature_frame(gold, silver)
for cutoff in (40000, 60000):
    decision_time = int(full.iloc[cutoff]["time"])
    prefix = build_feature_frame(
        gold.loc[gold["time"] <= decision_time],
        silver.loc[silver["time"] <= decision_time],
    )
    expected = full.iloc[cutoff][FEATURE_COLUMNS].to_numpy(dtype=float)
    actual = prefix.loc[prefix["time"] == decision_time, FEATURE_COLUMNS].iloc[0].to_numpy(dtype=float)
    if not np.allclose(expected, actual, equal_nan=True, rtol=1e-12, atol=1e-12):
        raise SystemExit(f"CAUSALITY FAILURE at row {cutoff}")
print("PASS: future rows did not change prior M1/M5/M15/H1 features")
