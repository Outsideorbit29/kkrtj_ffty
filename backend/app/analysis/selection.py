"""Pick, per target hour, the forecast from the latest run published strictly before decision time.

A run stamped exactly at the decision instant (e.g. the 15:30 UTC run at a 15:30 gate closure) is
too late to inform a bid that must already be submitted, so it is not available.
"""

from __future__ import annotations

import pandas as pd

from app.analysis.timeutil import HOUR


def select_decision_forecasts(targets: pd.DataFrame, forecasts: pd.DataFrame) -> pd.DataFrame:
    """Add ``publishTime``, ``forecast`` and ``horizonHours`` to targets.

    targets:   startTime, decisionTime (+ any other columns, passed through)
    forecasts: publishTime, startTime, generation
    Hours with no run published strictly before their decision time get NaN/NaT.
    """
    runs = forecasts[["publishTime", "startTime", "generation"]].rename(columns={"generation": "forecast"})
    picked = pd.merge_asof(
        targets.sort_values("decisionTime"),
        runs.sort_values("publishTime"),
        left_on="decisionTime",
        right_on="publishTime",
        by="startTime",
        direction="backward",
        allow_exact_matches=False,
    )
    picked["horizonHours"] = (picked["startTime"] - picked["publishTime"]) / HOUR
    return picked.sort_values("startTime", ignore_index=True)
