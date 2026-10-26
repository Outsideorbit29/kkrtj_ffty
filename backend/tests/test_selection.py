from datetime import time

import numpy as np
import pandas as pd

from app.analysis.selection import select_decision_forecasts
from app.elexon import clean_forecasts
from app.reports.tables import decision_table
from tests.conftest import utc


def _forecasts() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "publishTime": utc("2026-01-13T22:30Z", "2026-01-14T07:30Z", "2026-01-14T09:30Z"),
            "startTime": utc("2026-01-15T00:00Z", "2026-01-15T00:00Z", "2026-01-15T00:00Z"),
            "generation": [100.0, 200.0, 999.0],
        }
    )


def _select(decision: str) -> pd.Series:
    targets = pd.DataFrame({"startTime": utc("2026-01-15T00:00Z"), "decisionTime": utc(decision)})
    return select_decision_forecasts(targets, _forecasts()).iloc[0]


def test_uses_latest_run_published_before_decision_time():
    row = _select("2026-01-14T09:20Z")
    assert row["forecast"] == 200.0
    assert row["publishTime"] == pd.Timestamp("2026-01-14T07:30Z")
    assert row["horizonHours"] == 16.5


def test_run_published_exactly_at_decision_time_is_not_available():
    # A run stamped at the gate-closure instant is too late to inform the bid.
    row = _select("2026-01-14T09:30Z")
    assert row["forecast"] == 200.0
    assert row["publishTime"] == pd.Timestamp("2026-01-14T07:30Z")
    assert _select("2026-01-14T09:31Z")["forecast"] == 999.0


def test_no_run_before_decision_time_gives_missing_forecast():
    row = _select("2026-01-13T12:00Z")
    assert np.isnan(row["forecast"])
    assert pd.isna(row["publishTime"])


def test_clean_forecasts_drops_points_not_after_publish_time():
    raw = pd.DataFrame(
        {
            "publishTime": ["2026-01-14T07:30:00Z"] * 3,
            "startTime": ["2026-01-14T07:00:00Z", "2026-01-14T07:30:00Z", "2026-01-14T08:00:00Z"],
            "generation": [1, 2, 3],
        }
    )
    out = clean_forecasts(raw)
    assert out["startTime"].tolist() == [pd.Timestamp("2026-01-14T08:00Z")]


def test_snapshot_selection_never_uses_a_later_run_and_never_skips_one(dataset):
    for cutoff in (time(9, 20), time(15, 30)):
        picked = decision_table(dataset, cutoff).dropna(subset=["forecast"])
        assert (picked["publishTime"] < picked["decisionTime"]).all()
        # No run covering the same hour was published between the picked run and the decision.
        others = dataset.forecasts[["startTime", "publishTime"]].rename(columns={"publishTime": "other"})
        pairs = picked[["startTime", "publishTime", "decisionTime"]].merge(others, on="startTime")
        skipped = (pairs["other"] > pairs["publishTime"]) & (pairs["other"] < pairs["decisionTime"])
        assert not skipped.any()
        if cutoff == time(15, 30):
            # 15:30 coincides with the 15:30 UTC run in GMT; that run must not be used.
            assert (picked["decisionTime"] - picked["publishTime"] > pd.Timedelta(0)).all()
