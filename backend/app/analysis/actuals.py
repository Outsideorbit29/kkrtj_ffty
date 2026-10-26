"""Half-hourly FUELHH actuals to hourly averages."""

from __future__ import annotations

import pandas as pd


def hourly_actuals(half_hourly: pd.DataFrame) -> pd.DataFrame:
    """Mean MW of the :00 and :30 periods of each clock hour; hours missing either are dropped.

    Expects one row per half-hour ``startTime`` (revisions already resolved).
    """
    hour = half_hourly["startTime"].dt.floor("h").rename("startTime")
    stats = half_hourly.groupby(hour)["generation"].agg(["mean", "count"])
    complete = stats[stats["count"] == 2]
    return pd.DataFrame({"startTime": complete.index, "actual": complete["mean"].to_numpy()})
