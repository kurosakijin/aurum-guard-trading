"""Score each completed M1 bar and publish a fail-closed AI approval for MT5."""

from __future__ import annotations

import argparse
import csv
import os
import time
from pathlib import Path

import pandas as pd

from aurum_guard_ai_core import AurumProbabilityModel, FEATURE_COLUMNS, build_feature_frame


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Aurum Guard AI approval gate")
    parser.add_argument("--terminal", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--gold", default="XAUUSD")
    parser.add_argument("--silver", default="XAGUSD")
    parser.add_argument("--model", type=Path, default=Path("aurum_guard_ai_model.json"))
    parser.add_argument("--signal-file", default="aurum_guard_ai_signal.csv")
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    parser.add_argument("--once", action="store_true")
    return parser.parse_args()


def rates_frame(mt5: object, symbol: str, bars: int = 350) -> pd.DataFrame:
    if not mt5.symbol_select(symbol, True):
        raise RuntimeError(f"MT5 cannot select {symbol}")
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, bars)
    if rates is None or len(rates) < 150:
        raise RuntimeError(f"MT5 returned insufficient {symbol} history: {mt5.last_error()}")
    return pd.DataFrame(rates)


def write_signal(path: Path, row: list[object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", newline="", encoding="ascii") as handle:
        csv.writer(handle).writerow(row)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def main() -> int:
    args = parse_args()
    try:
        import MetaTrader5 as mt5
    except ImportError as exc:
        raise SystemExit("Install requirements-ai.txt before running the gate") from exc

    model = AurumProbabilityModel.load(args.model)
    if not mt5.initialize(path=args.terminal):
        raise SystemExit(f"MT5 connection failed: {mt5.last_error()}")
    terminal = mt5.terminal_info()
    if terminal is None or not terminal.commondata_path:
        mt5.shutdown()
        raise SystemExit("MT5 common data path is unavailable")
    signal_path = Path(terminal.commondata_path) / "Files" / args.signal_file
    last_bar_time = 0
    print(f"Aurum Guard AI connected. Publishing closed-bar scores to {signal_path}")

    try:
        while True:
            try:
                gold = rates_frame(mt5, args.gold)
                silver = rates_frame(mt5, args.silver)
                # Position zero is the forming MT5 bar; exclude the newest row.
                features = build_feature_frame(gold.iloc[:-1], silver.iloc[:-1]).dropna(subset=FEATURE_COLUMNS)
                if features.empty:
                    raise RuntimeError("No complete feature row is available")
                latest = features.iloc[-1]
                bar_time = int(latest["time"])
                if bar_time != last_bar_time:
                    raw_direction, probability = model.decide(latest[FEATURE_COLUMNS].to_numpy(dtype=float))
                    short_probability, no_trade_probability, long_probability = [float(value) for value in probability]
                    deployment_eligible = bool(model.metadata.get("deployment_eligible", False))
                    # Failed research models remain visible for shadow review but
                    # cannot approve an automated order in strict mode.
                    direction = raw_direction if deployment_eligible else 0
                    generated_at = int(time.time())
                    write_signal(
                        signal_path,
                        [
                            2,
                            generated_at,
                            args.gold,
                            "M1",
                            direction,
                            f"{long_probability:.6f}",
                            f"{short_probability:.6f}",
                            f"{no_trade_probability:.6f}",
                            model.model_id,
                            bar_time,
                            int(deployment_eligible),
                        ],
                    )
                    raw_label = "BUY" if raw_direction > 0 else "SELL" if raw_direction < 0 else "NO TRADE"
                    label = raw_label if deployment_eligible else f"SHADOW {raw_label} (MODEL NOT PROMOTED)"
                    print(
                        f"{pd.to_datetime(bar_time, unit='s', utc=True)} | {label} | "
                        f"buy={long_probability:.1%} sell={short_probability:.1%} "
                        f"wait={no_trade_probability:.1%} threshold={model.threshold:.1%}"
                    )
                    last_bar_time = bar_time
                if args.once:
                    break
            except Exception as exc:  # fail closed: no fresh file means the EA rejects strict-mode entries
                print(f"AI gate waiting safely: {exc}")
                if args.once:
                    raise
            time.sleep(max(args.poll_seconds, 0.5))
    except KeyboardInterrupt:
        print("Aurum Guard AI stopped by user")
    finally:
        mt5.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
