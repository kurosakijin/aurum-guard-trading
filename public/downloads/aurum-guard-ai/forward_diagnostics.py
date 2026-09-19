"""Versioned, analysis-only diagnostics. Never submits or changes MT5 orders."""
from __future__ import annotations

import argparse
import csv
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

FIELDS = [
    "schema_version", "generated_at", "bar_time", "model_id", "model_sha256",
    "symbol", "silver_symbol", "timeframe", "model_direction", "model_health",
    "plan_direction", "m1_direction", "plan_detail", "filtered_direction",
    "effective_health", "equity_guard", "deployment_eligible", "published_direction",
    "buy_probability", "sell_probability", "wait_probability", "threshold",
]


def append_diagnostics(history_path: Path, record: dict) -> Path:
    """Keep legacy CSV intact; refuse incompatible companion schemas."""
    path = history_path.with_name(history_path.stem + "_diagnostics_v2.csv")
    path.parent.mkdir(parents=True, exist_ok=True)
    populated = path.exists() and path.stat().st_size > 0
    if populated:
        with path.open(newline="", encoding="utf-8") as handle:
            if next(csv.reader(handle), None) != FIELDS:
                raise ValueError("Incompatible diagnostic header; existing file left intact")
    if set(record) != set(FIELDS):
        raise ValueError("Diagnostic fields do not match schema")
    with path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        if not populated:
            writer.writeheader()
        writer.writerow(record)
        handle.flush()
        os.fsync(handle.fileno())
    return path


def summarize(path: Path, start: int = 0, end: int | None = None) -> dict:
    """Count first observations, not trades; filter on UTC bar time [start,end)."""
    unique = {}
    total = 0
    malformed = 0
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not {"bar_time", "model_id"}.issubset(reader.fieldnames or []):
            raise ValueError("Not a supported AI forward log")
        for row in reader:
            try:
                bar = int(row["bar_time"])
                if None in row or not row["model_id"] or bar <= 0:
                    raise ValueError("Malformed row")
            except (ValueError, TypeError):
                malformed += 1
                continue
            if bar < start or (end is not None and bar >= end):
                continue
            total += 1
            key = tuple(row.get(k, "") for k in (
                "model_id", "model_sha256", "symbol", "silver_symbol", "timeframe", "bar_time"
            ))
            unique.setdefault(key, row)
    rows = list(unique.values())
    times = [int(row["bar_time"]) for row in rows]
    def counts(field):
        return dict(Counter(row.get(field, "unavailable") for row in rows))
    return {
        "source": str(path.resolve()), "rows_in_window": total,
        "unique_observations": len(rows), "duplicate_observations": total - len(rows),
        "malformed_rows": malformed,
        "first_bar_utc": datetime.fromtimestamp(min(times), timezone.utc).isoformat() if times else None,
        "last_bar_utc": datetime.fromtimestamp(max(times), timezone.utc).isoformat() if times else None,
        "model_ids": counts("model_id"), "raw_labels": counts("raw_label"),
        "model_health": counts("model_health"),
        "effective_health": dict(Counter(row.get("effective_health", row.get("health", "unavailable")) for row in rows)),
        "win_rate": None,
        "limitation": "Predictions are not independent trades. No matched outcomes or AI win rate in this log. Legacy logs lack symbol identity and underlying model health.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Read-only AI forward-log review; no MT5 connection")
    parser.add_argument("path", type=Path)
    parser.add_argument("--start", type=int, default=0, help="Inclusive UTC epoch seconds")
    parser.add_argument("--end", type=int, help="Exclusive UTC epoch seconds")
    args = parser.parse_args()
    print(json.dumps(summarize(args.path, args.start, args.end), indent=2))
