"""Accuracy of every WINDFOR run as a function of lead time."""

from __future__ import annotations

import pandas as pd

from app.analysis.metrics import bucket_start, grouped_metrics
from app.analysis.timeutil import HOUR, london_day


def run_errors(forecasts: pd.DataFrame, hourly: pd.DataFrame) -> pd.DataFrame:
    """One row per (run, hour) with an actual: deliveryDay, leadHours, forecast, actual, error."""
    joined = forecasts.rename(columns={"generation": "forecast"}).merge(hourly, on="startTime")
    joined["deliveryDay"] = london_day(joined["startTime"])
    joined["leadHours"] = (joined["startTime"] - joined["publishTime"]) / HOUR
    joined["error"] = joined["forecast"] - joined["actual"]
    return joined


def lead_time_metrics(errors: pd.DataFrame, bucket_hours: int, max_hours: int) -> pd.DataFrame:
    """Metrics per [leadFrom, leadTo) bucket for 0 < lead < max_hours."""
    in_range = errors[(errors["leadHours"] > 0) & (errors["leadHours"] < max_hours)]
    out = grouped_metrics(in_range, bucket_start(in_range["leadHours"], bucket_hours).rename("leadFrom"))
    out = out.reset_index()
    out["leadTo"] = out["leadFrom"] + bucket_hours
    return out
