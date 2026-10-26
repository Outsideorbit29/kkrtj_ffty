"""Error metrics. Convention: error = forecast - actual (positive = over-forecast)."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

METRIC_KEYS = (
    "n", "mae", "rmse", "bias", "nmae_pct",
    "p10_error", "p50_error", "p90_error", "p90_abs_error", "max_abs_error", "mean_actual",
)  # fmt: skip

Metrics = dict[str, float | int | None]


def error_metrics(forecast: pd.Series, actual: pd.Series) -> Metrics:
    """Summary metrics over the positions where both values exist."""
    both = forecast.notna() & actual.notna()
    f = forecast[both].to_numpy(dtype=float)
    a = actual[both].to_numpy(dtype=float)
    if f.size == 0:
        return {key: (0 if key == "n" else None) for key in METRIC_KEYS}
    err = f - a
    abs_err = np.abs(err)
    mae = float(abs_err.mean())
    mean_actual = float(a.mean())
    p10, p50, p90 = np.quantile(err, [0.1, 0.5, 0.9])
    return {
        "n": int(f.size),
        "mae": mae,
        "rmse": math.sqrt(float(np.mean(err**2))),
        "bias": float(err.mean()),
        "nmae_pct": mae / mean_actual * 100 if mean_actual else None,
        "p10_error": float(p10),
        "p50_error": float(p50),
        "p90_error": float(p90),
        "p90_abs_error": float(np.quantile(abs_err, 0.9)),
        "max_abs_error": float(abs_err.max()),
        "mean_actual": mean_actual,
    }


def skill_pct(mae: float | None, baseline_mae: float | None) -> float | None:
    """MAE skill score in %: 100 = perfect, 0 = no better than the baseline."""
    if mae is None or not baseline_mae:
        return None
    return (1 - mae / baseline_mae) * 100


def grouped_metrics(errors: pd.DataFrame, key: str | pd.Series) -> pd.DataFrame:
    """n, mae, rmse, bias of ``errors['error']`` per group (rows with NaN error are ignored)."""
    valid = errors[errors["error"].notna()]
    if isinstance(key, pd.Series):
        key = key[valid.index]
    work = valid.assign(absError=valid["error"].abs(), sqError=valid["error"] ** 2)
    grouped = work.groupby(key, sort=True).agg(
        n=("error", "size"), mae=("absError", "mean"), mse=("sqError", "mean"), bias=("error", "mean")
    )
    grouped["rmse"] = np.sqrt(grouped.pop("mse"))
    return grouped[["n", "mae", "rmse", "bias"]]


def bucket_start(values: pd.Series, width: float) -> pd.Series:
    """Left edge of the fixed-width bucket containing each value."""
    return np.floor(values / width) * width


def histogram(errors: pd.Series, bin_width: float) -> pd.DataFrame:
    """Counts in [from, to) bins aligned to multiples of ``bin_width`` spanning the data."""
    values = errors.dropna().to_numpy(dtype=float)
    if values.size == 0:
        return pd.DataFrame(columns=["from", "to", "count"])
    first = math.floor(values.min() / bin_width)
    last = math.floor(values.max() / bin_width) + 1
    edges = np.arange(first, last + 1) * bin_width
    counts, _ = np.histogram(values, bins=edges)
    return pd.DataFrame({"from": edges[:-1], "to": edges[1:], "count": counts})
