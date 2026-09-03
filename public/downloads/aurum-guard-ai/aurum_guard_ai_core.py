"""Shared feature engineering and a small dependency-light probability model.

This module deliberately uses chronological features only.  It never places an
order; the MT5 Expert Advisor remains responsible for execution and risk.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


MODEL_FORMAT_VERSION = 1
CLASS_VALUES = np.array([-1, 0, 1], dtype=np.int8)
FEATURE_COLUMNS = [
    "return_1",
    "return_3",
    "return_5",
    "return_15",
    "ema20_distance_atr",
    "ema50_distance_atr",
    "ema20_slope_atr",
    "ema_gap_atr",
    "rsi_14",
    "atr_percent",
    "range_atr",
    "body_share",
    "lower_wick_share",
    "upper_wick_share",
    "volume_z20",
    "range_position_20",
    "silver_return_1",
    "silver_return_5",
    "metals_correlation_20",
    "hour_sin",
    "hour_cos",
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

    frame["atr"] = _atr(frame)
    frame["ema20"] = close.ewm(span=20, adjust=False).mean()
    frame["ema50"] = close.ewm(span=50, adjust=False).mean()
    safe_atr = frame["atr"].replace(0.0, np.nan)
    candle_range = (high - low).replace(0.0, np.nan)
    candle_body = (close - open_price).abs()

    frame["return_1"] = np.log(close).diff(1)
    frame["return_3"] = np.log(close).diff(3)
    frame["return_5"] = np.log(close).diff(5)
    frame["return_15"] = np.log(close).diff(15)
    frame["ema20_distance_atr"] = (close - frame["ema20"]) / safe_atr
    frame["ema50_distance_atr"] = (close - frame["ema50"]) / safe_atr
    frame["ema20_slope_atr"] = frame["ema20"].diff(3) / safe_atr
    frame["ema_gap_atr"] = (frame["ema20"] - frame["ema50"]) / safe_atr
    frame["rsi_14"] = _rsi(close) / 100.0
    frame["atr_percent"] = safe_atr / close
    frame["range_atr"] = candle_range / safe_atr
    frame["body_share"] = candle_body / candle_range
    frame["lower_wick_share"] = (np.minimum(open_price, close) - low) / candle_range
    frame["upper_wick_share"] = (high - np.maximum(open_price, close)) / candle_range

    volume = frame["tick_volume"].astype(float)
    volume_mean = volume.rolling(20).mean()
    volume_std = volume.rolling(20).std().replace(0.0, np.nan)
    frame["volume_z20"] = (volume - volume_mean) / volume_std
    rolling_low = low.rolling(20).min()
    rolling_high = high.rolling(20).max()
    frame["range_position_20"] = (close - rolling_low) / (rolling_high - rolling_low).replace(0.0, np.nan)

    frame["silver_return_1"] = np.log(silver_close).diff(1)
    frame["silver_return_5"] = np.log(silver_close).diff(5)
    frame["metals_correlation_20"] = frame["return_1"].rolling(20).corr(frame["silver_return_1"])
    timestamp = pd.to_datetime(frame["time"], unit="s", utc=True)
    minute_of_day = timestamp.dt.hour * 60 + timestamp.dt.minute
    angle = 2.0 * math.pi * minute_of_day / 1440.0
    frame["hour_sin"] = np.sin(angle)
    frame["hour_cos"] = np.cos(angle)
    return frame


def add_triple_barrier_labels(
    frame: pd.DataFrame,
    horizon: int,
    target_atr: float,
    stop_atr: float,
) -> pd.DataFrame:
    if horizon < 2 or target_atr <= 0 or stop_atr <= 0:
        raise ValueError("Invalid label settings")
    close = frame["close"].to_numpy(dtype=float)
    high = frame["high"].to_numpy(dtype=float)
    low = frame["low"].to_numpy(dtype=float)
    atr = frame["atr"].to_numpy(dtype=float)
    labels = np.full(len(frame), np.nan)
    utility_long = np.full(len(frame), np.nan)

    for index in range(len(frame) - horizon):
        if not np.isfinite(atr[index]) or atr[index] <= 0:
            continue
        future_high = high[index + 1 : index + horizon + 1]
        future_low = low[index + 1 : index + horizon + 1]
        upper = close[index] + atr[index] * target_atr
        lower = close[index] - atr[index] * stop_atr
        upper_hits = np.flatnonzero(future_high >= upper)
        lower_hits = np.flatnonzero(future_low <= lower)
        first_upper = int(upper_hits[0]) if upper_hits.size else horizon + 1
        first_lower = int(lower_hits[0]) if lower_hits.size else horizon + 1
        if first_upper < first_lower:
            labels[index] = 1
            utility_long[index] = target_atr
        elif first_lower < first_upper:
            labels[index] = -1
            utility_long[index] = -stop_atr
        else:
            labels[index] = 0
            terminal_move = (close[index + horizon] - close[index]) / atr[index]
            utility_long[index] = float(np.clip(terminal_move, -stop_atr, target_atr))

    frame = frame.copy()
    frame["label"] = labels
    frame["utility_long"] = utility_long
    return frame


def training_matrix(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray, pd.DataFrame]:
    usable = frame.dropna(subset=FEATURE_COLUMNS + ["label", "utility_long"]).copy()
    finite = np.isfinite(usable[FEATURE_COLUMNS].to_numpy(dtype=float)).all(axis=1)
    usable = usable.loc[finite].reset_index(drop=True)
    x = usable[FEATURE_COLUMNS].to_numpy(dtype=float)
    y = usable["label"].to_numpy(dtype=np.int8)
    utility_long = usable["utility_long"].to_numpy(dtype=float)
    return x, y, utility_long, usable


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    exp = np.exp(np.clip(shifted, -50.0, 50.0))
    return exp / np.sum(exp, axis=1, keepdims=True)


def _class_indexes(y: np.ndarray) -> np.ndarray:
    mapping = {-1: 0, 0: 1, 1: 2}
    return np.array([mapping[int(value)] for value in y], dtype=np.int64)


def fit_softmax(
    x: np.ndarray,
    y: np.ndarray,
    *,
    steps: int = 2200,
    batch_size: int = 2048,
    learning_rate: float = 0.012,
    l2: float = 0.001,
    seed: int = 260904,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    if len(x) < 1000:
        raise ValueError("At least 1,000 training samples are required")
    mean = x.mean(axis=0)
    scale = x.std(axis=0)
    scale[scale < 1e-9] = 1.0
    standardized = np.clip((x - mean) / scale, -8.0, 8.0)
    y_index = _class_indexes(y)
    counts = np.bincount(y_index, minlength=3).astype(float)
    class_weights = np.sqrt(len(y_index) / np.maximum(counts * 3.0, 1.0))
    class_weights = np.clip(class_weights, 0.55, 2.50)

    rng = np.random.default_rng(seed)
    weights = np.zeros((standardized.shape[1], 3), dtype=float)
    bias = np.zeros(3, dtype=float)
    mw = np.zeros_like(weights)
    vw = np.zeros_like(weights)
    mb = np.zeros_like(bias)
    vb = np.zeros_like(bias)
    beta1, beta2 = 0.9, 0.999

    for step in range(1, steps + 1):
        indexes = rng.integers(0, len(standardized), size=min(batch_size, len(standardized)))
        xb = standardized[indexes]
        yi = y_index[indexes]
        probability = _softmax(xb @ weights + bias)
        target = np.zeros_like(probability)
        target[np.arange(len(yi)), yi] = 1.0
        sample_weights = class_weights[yi]
        gradient_logits = (probability - target) * sample_weights[:, None] / sample_weights.sum()
        gradient_weights = xb.T @ gradient_logits + l2 * weights
        gradient_bias = gradient_logits.sum(axis=0)

        mw = beta1 * mw + (1.0 - beta1) * gradient_weights
        vw = beta2 * vw + (1.0 - beta2) * np.square(gradient_weights)
        mb = beta1 * mb + (1.0 - beta1) * gradient_bias
        vb = beta2 * vb + (1.0 - beta2) * np.square(gradient_bias)
        mw_hat = mw / (1.0 - beta1**step)
        vw_hat = vw / (1.0 - beta2**step)
        mb_hat = mb / (1.0 - beta1**step)
        vb_hat = vb / (1.0 - beta2**step)
        weights -= learning_rate * mw_hat / (np.sqrt(vw_hat) + 1e-8)
        bias -= learning_rate * mb_hat / (np.sqrt(vb_hat) + 1e-8)
    return mean, scale, weights, bias


def probabilities(
    x: np.ndarray,
    mean: np.ndarray,
    scale: np.ndarray,
    weights: np.ndarray,
    bias: np.ndarray,
    temperature: float = 1.0,
) -> np.ndarray:
    standardized = np.clip((x - mean) / scale, -8.0, 8.0)
    return _softmax((standardized @ weights + bias) / max(temperature, 0.05))


def multiclass_log_loss(y: np.ndarray, probability: np.ndarray) -> float:
    indexes = _class_indexes(y)
    chosen = np.clip(probability[np.arange(len(indexes)), indexes], 1e-9, 1.0)
    return float(-np.log(chosen).mean())


def choose_temperature(
    x: np.ndarray,
    y: np.ndarray,
    mean: np.ndarray,
    scale: np.ndarray,
    weights: np.ndarray,
    bias: np.ndarray,
) -> float:
    candidates = np.linspace(0.65, 2.50, 38)
    losses = [multiclass_log_loss(y, probabilities(x, mean, scale, weights, bias, value)) for value in candidates]
    return float(candidates[int(np.argmin(losses))])


def directional_mask(probability: np.ndarray, threshold: float) -> tuple[np.ndarray, np.ndarray]:
    short_probability = probability[:, 0]
    no_trade_probability = probability[:, 1]
    long_probability = probability[:, 2]
    direction = np.where(long_probability >= short_probability, 1, -1)
    directional_probability = np.maximum(long_probability, short_probability)
    approved = (directional_probability >= threshold) & (directional_probability > no_trade_probability)
    return direction, approved


def evaluate_threshold(
    y: np.ndarray,
    utility_long: np.ndarray,
    probability: np.ndarray,
    threshold: float,
) -> dict[str, float | int]:
    direction, approved = directional_mask(probability, threshold)
    count = int(approved.sum())
    if count == 0:
        return {
            "threshold": float(threshold),
            "approved_signals": 0,
            "coverage": 0.0,
            "directional_precision": 0.0,
            "mean_atr_utility": -999.0,
            "conservative_score": -999.0,
        }
    approved_direction = direction[approved]
    approved_y = y[approved]
    signed_utility = utility_long[approved] * approved_direction
    precision = float((approved_direction == approved_y).mean())
    mean_utility = float(signed_utility.mean())
    standard_error = float(signed_utility.std(ddof=1) / math.sqrt(count)) if count > 1 else 999.0
    return {
        "threshold": float(threshold),
        "approved_signals": count,
        "coverage": float(count / len(y)),
        "directional_precision": precision,
        "mean_atr_utility": mean_utility,
        "conservative_score": mean_utility - 0.50 * standard_error,
    }


def select_threshold(y: np.ndarray, utility_long: np.ndarray, probability: np.ndarray) -> tuple[float, dict[str, Any]]:
    candidates = np.arange(0.55, 0.861, 0.01)
    reports = [evaluate_threshold(y, utility_long, probability, float(value)) for value in candidates]
    eligible = [report for report in reports if report["approved_signals"] >= 100 and report["coverage"] <= 0.20]
    if not eligible:
        fallback = evaluate_threshold(y, utility_long, probability, 0.70)
        return 0.70, fallback
    best = max(eligible, key=lambda report: float(report["conservative_score"]))
    if float(best["mean_atr_utility"]) <= 0.0:
        fallback = evaluate_threshold(y, utility_long, probability, 0.70)
        return 0.70, fallback
    return float(best["threshold"]), best


@dataclass
class AurumProbabilityModel:
    mean: np.ndarray
    scale: np.ndarray
    weights: np.ndarray
    bias: np.ndarray
    temperature: float
    threshold: float
    model_id: str
    metadata: dict[str, Any]

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        values = np.asarray(x, dtype=float)
        if values.ndim == 1:
            values = values.reshape(1, -1)
        return probabilities(values, self.mean, self.scale, self.weights, self.bias, self.temperature)

    def decide(self, x: np.ndarray) -> tuple[int, np.ndarray]:
        probability = self.predict_proba(x)[0]
        direction, approved = directional_mask(probability.reshape(1, -1), self.threshold)
        return (int(direction[0]) if bool(approved[0]) else 0), probability

    def save(self, path: Path) -> None:
        payload = {
            "format_version": MODEL_FORMAT_VERSION,
            "model_id": self.model_id,
            "feature_names": FEATURE_COLUMNS,
            "class_values": CLASS_VALUES.tolist(),
            "mean": self.mean.tolist(),
            "scale": self.scale.tolist(),
            "weights": self.weights.tolist(),
            "bias": self.bias.tolist(),
            "temperature": self.temperature,
            "threshold": self.threshold,
            "metadata": self.metadata,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        temporary.replace(path)

    @classmethod
    def load(cls, path: Path) -> "AurumProbabilityModel":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("format_version") != MODEL_FORMAT_VERSION:
            raise ValueError("Unsupported Aurum Guard AI model format")
        if payload.get("feature_names") != FEATURE_COLUMNS:
            raise ValueError("Model feature order does not match this AI runner")
        return cls(
            mean=np.asarray(payload["mean"], dtype=float),
            scale=np.asarray(payload["scale"], dtype=float),
            weights=np.asarray(payload["weights"], dtype=float),
            bias=np.asarray(payload["bias"], dtype=float),
            temperature=float(payload["temperature"]),
            threshold=float(payload["threshold"]),
            model_id=str(payload["model_id"]),
            metadata=dict(payload.get("metadata", {})),
        )
