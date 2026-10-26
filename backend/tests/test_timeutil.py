from datetime import date, time

import pandas as pd
import pytest

from app.analysis.timeutil import decision_times, delivery_hours, london_day
from tests.conftest import utc


def _decision(day: str, cutoff: time) -> pd.Timestamp:
    return decision_times(pd.Series([pd.Timestamp(day)]), cutoff).iloc[0]


@pytest.mark.parametrize(
    ("delivery_day", "cutoff", "expected_utc"),
    [
        ("2026-01-15", time(9, 20), "2026-01-14T09:20Z"),  # GMT
        ("2026-07-15", time(9, 20), "2026-07-14T08:20Z"),  # BST
        ("2026-03-29", time(9, 20), "2026-03-28T09:20Z"),  # D is the short day, D-1 still GMT
        ("2026-03-30", time(9, 20), "2026-03-29T08:20Z"),  # D-1 is the short day, after the change
        ("2026-10-26", time(9, 20), "2026-10-25T09:20Z"),  # D-1 is the long day, after the change
        ("2026-03-30", time(1, 30), "2026-03-29T01:00Z"),  # 01:30 does not exist: 02:00 BST
        ("2026-10-26", time(1, 30), "2026-10-25T00:30Z"),  # 01:30 happens twice: first (BST)
    ],
)
def test_decision_time_is_cutoff_on_previous_london_day(delivery_day, cutoff, expected_utc):
    assert _decision(delivery_day, cutoff) == pd.Timestamp(expected_utc)


@pytest.mark.parametrize(("day", "hours"), [("2026-01-15", 24), ("2026-03-29", 23), ("2026-10-25", 25)])
def test_delivery_hours_follow_london_clock(day, hours):
    d = date.fromisoformat(day)
    frame = delivery_hours(d, d)
    assert len(frame) == hours
    assert (frame["deliveryDay"] == pd.Timestamp(day)).all()
    assert frame["startTime"].diff().dropna().eq(pd.Timedelta(hours=1)).all()


def test_london_day_uses_local_calendar():
    days = london_day(utc("2026-07-14T23:30Z", "2026-01-14T23:30Z"))
    assert list(days) == [pd.Timestamp("2026-07-15"), pd.Timestamp("2026-01-14")]
