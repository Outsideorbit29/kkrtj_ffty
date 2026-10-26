"""Per-dataset cached analysis tables. Returned frames are shared: treat them as read-only."""

from __future__ import annotations

from datetime import date, time
from functools import lru_cache

import pandas as pd

from app import config
from app.analysis.leadtime import run_errors
from app.analysis.table import build_decision_table
from app.data import Dataset
from app.reports import NoDataError


@lru_cache(maxsize=32)
def decision_table(ds: Dataset, cutoff: time) -> pd.DataFrame:
    return build_decision_table(
        ds.actuals,
        ds.hourly_actuals,
        ds.forecasts,
        ds.first_day,
        ds.last_day,
        cutoff,
        lead_days=config.DECISION_LEAD_DAYS,
        band_window_days=config.BAND_WINDOW_DAYS,
        band_min_samples=config.BAND_MIN_SAMPLES,
    )


@lru_cache(maxsize=4)
def run_error_table(ds: Dataset) -> pd.DataFrame:
    return run_errors(ds.forecasts, ds.hourly_actuals)


def clamp_window(ds: Dataset, start: date, end: date) -> tuple[date, date]:
    """Intersect [start, end] with the delivery days the dataset can answer."""
    first, last = max(start, ds.first_day), min(end, ds.last_day)
    if first > last:
        raise NoDataError(f"No data between {start} and {end}; available {ds.first_day}..{ds.last_day}")
    return first, last


def in_window(frame: pd.DataFrame, start: date, end: date) -> pd.DataFrame:
    days = frame["deliveryDay"]
    return frame[(days >= pd.Timestamp(start)) & (days <= pd.Timestamp(end))]
