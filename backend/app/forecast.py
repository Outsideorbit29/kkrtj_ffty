"""Core logic: which forecast was available at decision time, and how accurate it was."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app import config


def decision_cutoff(delivery_start: pd.Timestamp) -> pd.Timestamp:
    """UTC instant at which the purchase decision for `delivery_start` must be made."""
    local = delivery_start.tz_convert(config.LOCAL_TZ)
    day = (local - pd.Timedelta(days=config.DECISION_LEAD_DAYS)).tz_localize(None).normalize()
    hh, mm = map(int, config.DECISION_CUTOFF_LOCAL.split(":"))
    return (day + pd.Timedelta(hours=hh, minutes=mm)).tz_localize(config.LOCAL_TZ).tz_convert("UTC")


def latest_forecast_before(forecasts: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """For each delivery startTime, keep the most recent forecast published at or before the cutoff."""
    available = forecasts[forecasts["publishTime"] <= cutoff]
    if available.empty:
        return available.rename(columns={"generation": "forecast"})
    latest = available.sort_values("publishTime").groupby("startTime", as_index=False).last()
    return latest.rename(columns={"generation": "forecast"})


def build_comparison(actuals: pd.DataFrame, forecasts: pd.DataFrame, cutoff_fn=decision_cutoff) -> pd.DataFrame:
    """Join the decision-time forecast with actuals and a naive baseline (same half-hour, one day earlier)."""
    rows = []
    for start, group in forecasts.groupby("startTime"):
        cutoff = cutoff_fn(start)
        picked = latest_forecast_before(group, cutoff)
        if not picked.empty:
            rows.append(picked.assign(cutoff=cutoff))
    if not rows:
        return pd.DataFrame(columns=["startTime", "forecast", "actual", "baseline", "publishTime", "cutoff"])
    comp = pd.concat(rows, ignore_index=True)
    comp = comp.merge(actuals.rename(columns={"generation": "actual"}), on="startTime", how="inner")
    lagged = actuals.assign(startTime=actuals["startTime"] + pd.Timedelta(days=1)).rename(columns={"generation": "baseline"})
    comp = comp.merge(lagged, on="startTime", how="left")
    return comp.sort_values("startTime").reset_index(drop=True)


def error_metrics(actual: pd.Series, predicted: pd.Series) -> dict:
    """MAE, RMSE, bias (positive = over-forecast) and MAPE over intervals with actual > 0."""
    err = predicted - actual
    mask = actual > 0
    return {
        "n": int(err.notna().sum()),
        "mae_mw": float(err.abs().mean()),
        "rmse_mw": float(np.sqrt((err ** 2).mean())),
        "bias_mw": float(err.mean()),
        "mape_pct": float((err[mask].abs() / actual[mask]).mean() * 100) if mask.any() else None,
    }
