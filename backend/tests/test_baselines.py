import pandas as pd

from app.analysis.baselines import add_persistence, add_same_hour_d2
from tests.conftest import utc

HALF_HOURLY = pd.DataFrame(
    {
        "startTime": utc("2026-01-14T08:30Z", "2026-01-14T09:00Z", "2026-01-14T09:30Z"),
        "generation": [111.0, 222.0, 333.0],
    }
)


def _persistence(decision: str) -> float:
    table = pd.DataFrame({"startTime": utc("2026-01-15T00:00Z"), "decisionTime": utc(decision)})
    return add_persistence(table, HALF_HOURLY)["persistence"].iloc[0]


def test_persistence_uses_last_period_ended_before_decision_time():
    assert _persistence("2026-01-14T09:20Z") == 111.0  # the 09:00 period only ends at 09:30
    # period ending exactly at decision time is not yet known
    assert _persistence("2026-01-14T09:30Z") == 111.0
    assert _persistence("2026-01-14T09:31Z") == 222.0


def test_same_hour_d2_is_hourly_actual_48h_earlier():
    hourly = pd.DataFrame({"startTime": utc("2026-01-13T05:00Z", "2026-01-14T05:00Z"), "actual": [1.0, 2.0]})
    table = pd.DataFrame({"startTime": utc("2026-01-15T05:00Z", "2026-01-15T06:00Z")})
    out = add_same_hour_d2(table, hourly)
    assert out["sameHourD2"].iloc[0] == 1.0
    assert pd.isna(out["sameHourD2"].iloc[1])
