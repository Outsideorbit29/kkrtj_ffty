"""The decision table: one row per delivery hour with everything known at decision time."""

from __future__ import annotations

from datetime import date, time

import pandas as pd

from app.analysis.band import add_uncertainty_band
from app.analysis.baselines import add_persistence, add_same_hour_d2
from app.analysis.selection import select_decision_forecasts
from app.analysis.timeutil import decision_times, delivery_hours


def build_decision_table(
    half_hourly: pd.DataFrame,
    hourly: pd.DataFrame,
    forecasts: pd.DataFrame,
    first_day: date,
    last_day: date,
    cutoff: time,
    *,
    lead_days: int,
    band_window_days: int,
    band_min_samples: int,
) -> pd.DataFrame:
    """Columns: startTime, deliveryDay, decisionTime, publishTime, forecast, horizonHours,
    actual, error, persistence, sameHourD2, errorQLow, errorQHigh, bandN, p10, p90."""
    hours = delivery_hours(first_day, last_day)
    days = hours["deliveryDay"].drop_duplicates()
    decisions = pd.DataFrame({"deliveryDay": days, "decisionTime": decision_times(days, cutoff, lead_days)})
    targets = hours.merge(decisions, on="deliveryDay")

    table = select_decision_forecasts(targets, forecasts)
    table = table.merge(hourly, on="startTime", how="left")
    table["error"] = table["forecast"] - table["actual"]
    table = add_persistence(table, half_hourly)
    table = add_same_hour_d2(table, hourly)
    return add_uncertainty_band(table, band_window_days, band_min_samples)
