"""Naive benchmarks available at decision time."""

from __future__ import annotations

import pandas as pd

HALF_HOUR = pd.Timedelta(minutes=30)
TWO_DAYS = pd.Timedelta(days=2)


def add_persistence(table: pd.DataFrame, half_hourly: pd.DataFrame) -> pd.DataFrame:
    """``persistence``: last half-hourly actual whose period ended at or before ``decisionTime``."""
    known = pd.DataFrame(
        {"periodEnd": half_hourly["startTime"] + HALF_HOUR, "persistence": half_hourly["generation"]}
    ).dropna()
    merged = pd.merge_asof(
        table.sort_values("decisionTime"),
        known.sort_values("periodEnd"),
        left_on="decisionTime",
        right_on="periodEnd",
        direction="backward",
        allow_exact_matches=True,
    )
    return merged.drop(columns="periodEnd").sort_values("startTime", ignore_index=True)


def add_same_hour_d2(table: pd.DataFrame, hourly: pd.DataFrame) -> pd.DataFrame:
    """``sameHourD2``: hourly actual 48h earlier.

    Its hour ends by D-1 00:00 London, so it is known for any cutoff on D-1. On clock-change
    days a fixed 48h is one wall-clock hour off "the same hour", which is acceptable here.
    """
    lagged = pd.DataFrame({"startTime": hourly["startTime"] + TWO_DAYS, "sameHourD2": hourly["actual"]})
    return table.merge(lagged, on="startTime", how="left")
