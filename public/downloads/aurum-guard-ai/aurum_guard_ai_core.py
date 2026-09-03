"""Causal feature engineering and a nonlinear meta-label approval model.

The model does not guess a direction on every candle. It first requires a
rule-based defended trend candidate, then estimates whether that candidate's
TP is likely to arrive before its SL. MT5 remains the only order executor.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


MODEL_FORMAT_VERSION = 3
FEATURE_COLUMNS = [
    "return_1", "return_3", "return_5", "return_15", "return_30",
    "ema20_distance_atr", "ema50_distance_atr", "ema20_slope_atr",
    "ema50_slope_atr", "ema_gap_atr", "rsi_14", "rsi_change_3",
    "atr_percent", "atr_ratio_50", "range_atr", "directional_body",
    "body_share", "lower_wick_share", "upper_wick_share", "volume_z20",
    "volume_z50", "range_position_20", "range_position_50",
    "silver_return_1", "silver_return_5", "silver_return_15",
    "silver_ema_gap", "metals_correlation_20", "metal_return_divergence_5",
    "hour_sin", "hour_cos", "weekday_sin", "weekday_cos",
]

ORIENTED_FEATURE_COLUMNS = [
    "dir_return_1", "dir_return_3", "dir_return_5", "dir_return_15",
    "dir_return_30", "dir_ema20_distance_atr", "dir_ema50_distance_atr",
    "dir_ema20_slope_atr", "dir_ema50_slope_atr", "dir_ema_gap_atr",
    "dir_rsi_bias", "dir_rsi_change_3", "atr_percent", "atr_ratio_50",
    "range_atr", "dir_body", "body_share", "favorable_wick_share",
    "adverse_wick_share", "volume_z20", "volume_z50",
    "dir_range_position_20", "dir_range_position_50",
    "dir_silver_return_1", "dir_silver_return_5", "dir_silver_return_15",
    "dir_silver_ema_gap", "metals_correlation_20",
    "dir_metal_return_divergence_5", "hour_sin", "hour_cos",
    "weekday_sin", "weekday_cos",
]


def _rsi(close: pd.Series, length: int = 14) -> pd.Series:
    change = close.diff()
    gain = change.clip(lower=0.0)
    loss = -change.clip(upper=0.0)
    average_gain = gain.ewm(alpha=1.0 / length, adjust=False).mean()
    average_loss = loss.ewm(alpha=1.0 / length, adjust=False).mean()
    relative_strength = average_gain / average_loss.replace(0.0, np.nan)
    return 100.0 - 100.0 / (1.0 + relative_strength)


def _atr(frame: pd.DataFrame, length: int = 14) -> pd.Series:
    previous_close = frame["close"].shift(1)
    true_range = pd.concat(
        [
            frame["high"] - frame["low"],
            (frame["high"] - previous_close).abs(),
            (frame["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.ewm(alpha=1.0 / length, adjust=False).mean()


def prepare_market_frame(gold: pd.DataFrame, silver: pd.DataFrame) -> pd.DataFrame:
    required = {"time", "open", "high", "low", "close", "tick_volume"}
    if not required.issubset(gold.columns) or not required.issubset(silver.columns):
        raise ValueError(f"Gold and Silver data need columns: {sorted(required)}")
    gold_clean = gold.copy().sort_values("time").drop_duplicates("time")
    silver_clean = silver[["time", "close"]].copy().sort_values("time").drop_duplicates("time")
    silver_clean = silver_clean.rename(columns={"close": "silver_close"})
    merged = gold_clean.merge(silver_clean, on="time", how="inner")
    if len(merged) < 150:
        raise ValueError("Not enough synchronized Gold/Silver bars")
    return merged.reset_index(drop=True)


def build_feature_frame(gold: pd.DataFrame, silver: pd.DataFrame) -> pd.DataFrame:
    frame = prepare_market_frame(gold, silver)
    close = frame["close"].astype(float)
    silver_close = frame["silver_close"].astype(float)
    open_price = frame["open"].astype(float)
    high = frame["high"].astype(float)
    low = frame["low"].astype(float)
    frame["bar_index"] = np.arange(len(frame), dtype=np.int64)
    frame["atr"] = _atr(frame)
    frame["ema20"] = close.ewm(span=20, adjust=False).mean()
    frame["ema50"] = close.ewm(span=50, adjust=False).mean()
    frame["silver_ema20"] = silver_close.ewm(span=20, adjust=False).mean()
    frame["silver_ema50"] = silver_close.ewm(span=50, adjust=False).mean()
    safe_atr = frame["atr"].replace(0.0, np.nan)
    candle_range = (high - low).replace(0.0, np.nan)
    signed_body = close - open_price

    for length in (1, 3, 5, 15, 30):
        frame[f"return_{length}"] = np.log(close).diff(length)
    frame["ema20_distance_atr"] = (close - frame["ema20"]) / safe_atr
    frame["ema50_distance_atr"] = (close - frame["ema50"]) / safe_atr
    frame["ema20_slope_atr"] = frame["ema20"].diff(3) / safe_atr
    frame["ema50_slope_atr"] = frame["ema50"].diff(5) / safe_atr
    frame["ema_gap_atr"] = (frame["ema20"] - frame["ema50"]) / safe_atr
    rsi = _rsi(close) / 100.0
    frame["rsi_14"] = rsi
    frame["rsi_change_3"] = rsi.diff(3)
    frame["atr_percent"] = safe_atr / close
    frame["atr_ratio_50"] = safe_atr / safe_atr.rolling(50).median().replace(0.0, np.nan)
    frame["range_atr"] = candle_range / safe_atr
    frame["directional_body"] = signed_body / candle_range
    frame["body_share"] = signed_body.abs() / candle_range
    frame["lower_wick_share"] = (np.minimum(open_price, close) - low) / candle_range
    frame["upper_wick_share"] = (high - np.maximum(open_price, close)) / candle_range

    volume = frame["tick_volume"].astype(float)
    for length in (20, 50):
        volume_std = volume.rolling(length).std().replace(0.0, np.nan)
        frame[f"volume_z{length}"] = (volume - volume.rolling(length).mean()) / volume_std
    for length in (20, 50):
        rolling_low = low.rolling(length).min()
        rolling_high = high.rolling(length).max()
        frame[f"range_position_{length}"] = (close - rolling_low) / (rolling_high - rolling_low).replace(0.0, np.nan)

    for length in (1, 5, 15):
        frame[f"silver_return_{length}"] = np.log(silver_close).diff(length)
    frame["silver_ema_gap"] = (frame["silver_ema20"] - frame["silver_ema50"]) / silver_close
    frame["metals_correlation_20"] = frame["return_1"].rolling(20).corr(frame["silver_return_1"])
    frame["metal_return_divergence_5"] = frame["return_5"] - frame["silver_return_5"]

    timestamp = pd.to_datetime(frame["time"], unit="s", utc=True)
    minute_of_day = timestamp.dt.hour * 60 + timestamp.dt.minute
    day_angle = 2.0 * math.pi * minute_of_day / 1440.0
    week_angle = 2.0 * math.pi * timestamp.dt.dayofweek / 5.0
    frame["hour_sin"] = np.sin(day_angle)
    frame["hour_cos"] = np.cos(day_angle)
    frame["weekday_sin"] = np.sin(week_angle)
    frame["weekday_cos"] = np.cos(week_angle)
    return frame


def add_trade_outcomes(
    frame: pd.DataFrame,
    horizon: int,
    target_atr: float,
    stop_atr: float,
    round_trip_cost_atr: float,
) -> pd.DataFrame:
    """Create side-specific first-touch outcomes with estimated trading cost."""
    if horizon < 2 or target_atr <= 0 or stop_atr <= 0 or round_trip_cost_atr < 0:
        raise ValueError("Invalid outcome settings")
    close = frame["close"].to_numpy(dtype=float)
    high = frame["high"].to_numpy(dtype=float)
    low = frame["low"].to_numpy(dtype=float)
    atr = frame["atr"].to_numpy(dtype=float)
    long_win = np.full(len(frame), np.nan)
    short_win = np.full(len(frame), np.nan)
    long_utility = np.full(len(frame), np.nan)
    short_utility = np.full(len(frame), np.nan)

    for index in range(len(frame) - horizon):
        if not np.isfinite(atr[index]) or atr[index] <= 0:
            continue
        future_high = high[index + 1 : index + horizon + 1]
        future_low = low[index + 1 : index + horizon + 1]
        long_target = close[index] + atr[index] * target_atr
        long_stop = close[index] - atr[index] * stop_atr
        short_target = close[index] - atr[index] * target_atr
        short_stop = close[index] + atr[index] * stop_atr

        long_target_hits = np.flatnonzero(future_high >= long_target)
        long_stop_hits = np.flatnonzero(future_low <= long_stop)
        short_target_hits = np.flatnonzero(future_low <= short_target)
        short_stop_hits = np.flatnonzero(future_high >= short_stop)
        first_long_target = int(long_target_hits[0]) if long_target_hits.size else horizon + 1
        first_long_stop = int(long_stop_hits[0]) if long_stop_hits.size else horizon + 1
        first_short_target = int(short_target_hits[0]) if short_target_hits.size else horizon + 1
        first_short_stop = int(short_stop_hits[0]) if short_stop_hits.size else horizon + 1

        if first_long_target < first_long_stop:
            long_win[index] = 1.0
            long_utility[index] = target_atr - round_trip_cost_atr
        elif first_long_stop < first_long_target:
            long_win[index] = 0.0
            long_utility[index] = -stop_atr - round_trip_cost_atr
        else:
            terminal = (close[index + horizon] - close[index]) / atr[index]
            long_win[index] = 0.0
            long_utility[index] = float(np.clip(terminal, -stop_atr, target_atr) - round_trip_cost_atr)

        if first_short_target < first_short_stop:
            short_win[index] = 1.0
            short_utility[index] = target_atr - round_trip_cost_atr
        elif first_short_stop < first_short_target:
            short_win[index] = 0.0
            short_utility[index] = -stop_atr - round_trip_cost_atr
        else:
            terminal = (close[index] - close[index + horizon]) / atr[index]
            short_win[index] = 0.0
            short_utility[index] = float(np.clip(terminal, -stop_atr, target_atr) - round_trip_cost_atr)

    output = frame.copy()
    output["long_win"] = long_win
    output["short_win"] = short_win
    output["long_utility"] = long_utility
    output["short_utility"] = short_utility
    return output


def candidate_direction(frame: pd.DataFrame) -> pd.Series:
    """Return a causal defended-pullback direction, or zero when no setup exists."""
    trend_direction = np.sign(frame["ema_gap_atr"]).astype(float)
    direction = trend_direction.where(
        (trend_direction != 0)
        & (frame["ema20_slope_atr"] * trend_direction > 0.0)
        & (frame["directional_body"] * trend_direction >= 0.25)
        & (frame["body_share"] >= 0.30)
        & (frame["range_atr"].between(0.30, 1.50))
        & (frame["ema20_distance_atr"].abs() <= 0.90)
        & (frame["ema50_distance_atr"].abs() <= 2.25)
        & (((frame["rsi_14"] - 0.50) * trend_direction).between(-0.10, 0.30))
        & (frame["silver_return_5"] * trend_direction >= -0.0015)
        & (frame["metals_correlation_20"] >= -0.10),
        0.0,
    )
    return direction.fillna(0.0).astype(np.int8)


def oriented_features(frame: pd.DataFrame, direction: pd.Series | np.ndarray) -> pd.DataFrame:
    d = pd.Series(np.asarray(direction, dtype=float), index=frame.index)
    values: dict[str, pd.Series | np.ndarray] = {}
    for length in (1, 3, 5, 15, 30):
        values[f"dir_return_{length}"] = frame[f"return_{length}"] * d
    for name in ("ema20_distance_atr", "ema50_distance_atr", "ema20_slope_atr", "ema50_slope_atr", "ema_gap_atr"):
        values[f"dir_{name}"] = frame[name] * d
    values["dir_rsi_bias"] = (frame["rsi_14"] - 0.50) * d
    values["dir_rsi_change_3"] = frame["rsi_change_3"] * d
    for name in ("atr_percent", "atr_ratio_50", "range_atr"):
        values[name] = frame[name]
    values["dir_body"] = frame["directional_body"] * d
    values["body_share"] = frame["body_share"]
    values["favorable_wick_share"] = np.where(d > 0, frame["lower_wick_share"], frame["upper_wick_share"])
    values["adverse_wick_share"] = np.where(d > 0, frame["upper_wick_share"], frame["lower_wick_share"])
    for name in ("volume_z20", "volume_z50"):
        values[name] = frame[name]
    values["dir_range_position_20"] = (frame["range_position_20"] - 0.50) * d
    values["dir_range_position_50"] = (frame["range_position_50"] - 0.50) * d
    for length in (1, 5, 15):
        values[f"dir_silver_return_{length}"] = frame[f"silver_return_{length}"] * d
    values["dir_silver_ema_gap"] = frame["silver_ema_gap"] * d
    values["metals_correlation_20"] = frame["metals_correlation_20"]
    values["dir_metal_return_divergence_5"] = frame["metal_return_divergence_5"] * d
    for name in ("hour_sin", "hour_cos", "weekday_sin", "weekday_cos"):
        values[name] = frame[name]
    return pd.DataFrame(values, index=frame.index)[ORIENTED_FEATURE_COLUMNS]


def meta_training_matrix(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray, pd.DataFrame]:
    outcome_columns = ["long_win", "short_win", "long_utility", "short_utility"]
    usable = frame.dropna(subset=FEATURE_COLUMNS + outcome_columns).copy()
    usable["direction"] = candidate_direction(usable)
    usable = usable.loc[usable["direction"] != 0].copy()
    oriented = oriented_features(usable, usable["direction"])
    finite = np.isfinite(oriented.to_numpy(dtype=float)).all(axis=1)
    usable = usable.loc[finite].reset_index(drop=True)
    oriented = oriented.loc[finite].reset_index(drop=True)
    direction = usable["direction"].to_numpy(dtype=np.int8)
    y = np.where(direction > 0, usable["long_win"], usable["short_win"]).astype(np.int8)
    utility = np.where(direction > 0, usable["long_utility"], usable["short_utility"]).astype(float)
    return oriented.to_numpy(dtype=float), y, utility, usable


def evaluate_threshold(y: np.ndarray, utility: np.ndarray, probability: np.ndarray, threshold: float) -> dict[str, float | int]:
    approved = probability >= threshold
    count = int(approved.sum())
    if count == 0:
        return {"threshold": float(threshold), "approved_signals": 0, "coverage": 0.0, "win_rate": 0.0, "mean_net_atr_utility": -999.0, "lower_confidence_utility": -999.0}
    selected = utility[approved]
    mean_utility = float(selected.mean())
    standard_error = float(selected.std(ddof=1) / math.sqrt(count)) if count > 1 else 999.0
    return {
        "threshold": float(threshold),
        "approved_signals": count,
        "coverage": float(count / len(y)),
        "win_rate": float(y[approved].mean()),
        "mean_net_atr_utility": mean_utility,
        "lower_confidence_utility": mean_utility - 1.645 * standard_error,
    }


def select_threshold(y: np.ndarray, utility: np.ndarray, probability: np.ndarray) -> tuple[float, dict[str, Any]]:
    reports = [evaluate_threshold(y, utility, probability, float(value)) for value in np.arange(0.52, 0.811, 0.01)]
    eligible = [report for report in reports if report["approved_signals"] >= 100 and report["coverage"] <= 0.35]
    if not eligible:
        return 0.70, evaluate_threshold(y, utility, probability, 0.70)
    best = max(eligible, key=lambda report: float(report["lower_confidence_utility"]))
    if float(best["lower_confidence_utility"]) <= 0.0:
        return 0.70, evaluate_threshold(y, utility, probability, 0.70)
    return float(best["threshold"]), best


@dataclass
class AurumProbabilityModel:
    estimator: Any
    threshold: float
    model_id: str
    metadata: dict[str, Any]
    feature_low: np.ndarray
    feature_high: np.ndarray

    def predict_success_probability(self, x: np.ndarray) -> np.ndarray:
        values = np.asarray(x, dtype=float)
        if values.ndim == 1:
            values = values.reshape(1, -1)
        return np.asarray(self.estimator.predict_proba(values)[:, 1], dtype=float)

    def decide_frame_row(self, row: pd.Series) -> tuple[int, float, float, float, str, float]:
        single = row.to_frame().T
        direction = int(candidate_direction(single).iloc[0])
        if direction == 0:
            return 0, 0.0, 0.0, 1.0, "NO_CANDIDATE", 0.0
        x = oriented_features(single, np.array([direction])).to_numpy(dtype=float)
        outside_reference = (x[0] < self.feature_low) | (x[0] > self.feature_high)
        drift_share = float(outside_reference.mean())
        probability = float(self.predict_success_probability(x)[0])
        long_probability = probability if direction > 0 else 0.0
        short_probability = probability if direction < 0 else 0.0
        if drift_share > 0.15:
            return 0, long_probability, short_probability, 1.0 - probability, "REGIME_DRIFT", drift_share
        if probability < self.threshold:
            return 0, long_probability, short_probability, 1.0 - probability, "LOW_CONFIDENCE", drift_share
        return direction, long_probability, short_probability, 1.0 - probability, "CANDIDATE_APPROVED", drift_share

    def save(self, path: Path) -> None:
        payload = {
            "format_version": MODEL_FORMAT_VERSION,
            "model_id": self.model_id,
            "feature_names": ORIENTED_FEATURE_COLUMNS,
            "threshold": self.threshold,
            "metadata": self.metadata,
            "estimator": self.estimator,
            "feature_low": self.feature_low.tolist(),
            "feature_high": self.feature_high.tolist(),
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        joblib.dump(payload, temporary, compress=3)
        temporary.replace(path)

    @classmethod
    def load(cls, path: Path) -> "AurumProbabilityModel":
        payload = joblib.load(path)
        if payload.get("format_version") != MODEL_FORMAT_VERSION:
            raise ValueError("Unsupported Aurum Guard AI model format")
        if payload.get("feature_names") != ORIENTED_FEATURE_COLUMNS:
            raise ValueError("Model feature order does not match this AI runner")
        return cls(
            estimator=payload["estimator"],
            threshold=float(payload["threshold"]),
            model_id=str(payload["model_id"]),
            metadata=dict(payload.get("metadata", {})),
            feature_low=np.asarray(payload["feature_low"], dtype=float),
            feature_high=np.asarray(payload["feature_high"], dtype=float),
        )
