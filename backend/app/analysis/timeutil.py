"""Delivery days, delivery hours and decision times in Europe/London, DST-safe."""

from __future__ import annotations

from datetime import date, time

import numpy as np
import pandas as pd

LONDON = "Europe/London"
HOUR = pd.Timedelta(hours=1)


def london_day(times: pd.Series) -> pd.Series:
    """London calendar day of each UTC instant, as naive midnight timestamps."""
    return times.dt.tz_convert(LONDON).dt.tz_localize(None).dt.normalize()


def localize_london(naive: pd.Series) -> pd.Series:
    """Naive London wall-clock times to UTC.

    Times skipped by spring-forward move to the next valid instant; times repeated by
    fall-back resolve to their first (BST) occurrence, i.e. the earlier decision.
    """
    first_occurrence = np.ones(len(naive), dtype=bool)
    aware = naive.dt.tz_localize(LONDON, ambiguous=first_occurrence, nonexistent="shift_forward")
    return aware.dt.tz_convert("UTC")


def delivery_hours(first: date, last: date) -> pd.DataFrame:
    """Every hourly startTime of London delivery days [first, last] (23/25 on clock-change days)."""
    start = pd.Timestamp(first).tz_localize(LONDON)
    end = (pd.Timestamp(last) + pd.Timedelta(days=1)).tz_localize(LONDON)
    starts = pd.Series(pd.date_range(start, end, freq="h", inclusive="left").tz_convert("UTC"))
    return pd.DataFrame({"startTime": starts, "deliveryDay": london_day(starts)})


def decision_times(days: pd.Series, cutoff: time, lead_days: int = 1) -> pd.Series:
    """UTC decision instant for each delivery day: D - lead_days at `cutoff` London time."""
    offset = pd.Timedelta(hours=cutoff.hour, minutes=cutoff.minute)
    return localize_london(days - pd.Timedelta(days=lead_days) + offset)
