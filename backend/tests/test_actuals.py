import numpy as np
import pandas as pd

from app.analysis.actuals import hourly_actuals
from app.elexon import clean_actuals
from tests.conftest import utc


def test_hourly_actual_is_mean_of_both_half_hours_and_requires_both():
    half_hourly = pd.DataFrame(
        {
            "startTime": utc(
                "2026-01-15T00:00Z",
                "2026-01-15T00:30Z",  # 00:00 complete
                "2026-01-15T01:00Z",  # 01:30 missing
                "2026-01-15T02:00Z",
                "2026-01-15T02:30Z",  # 02:30 value unknown
            ),
            "generation": [1000.0, 2000.0, 5000.0, 3000.0, np.nan],
        }
    )
    out = hourly_actuals(half_hourly)
    assert list(out["startTime"]) == [pd.Timestamp("2026-01-15T00:00Z")]
    assert out["actual"].tolist() == [1500.0]


def test_clean_actuals_keeps_latest_revision_and_wind_only():
    raw = pd.DataFrame(
        {
            "startTime": ["2026-01-15T00:00:00Z"] * 3,
            "publishTime": ["2026-01-15T00:30:00Z", "2026-01-15T01:30:00Z", "2026-01-15T02:00:00Z"],
            "settlementDate": ["2026-01-15"] * 3,
            "settlementPeriod": [1, 1, 1],
            "fuelType": ["WIND", "WIND", "CCGT"],
            "generation": [100, 120, 9999],
        }
    )
    out = clean_actuals(raw)
    assert len(out) == 1
    assert out["generation"].iloc[0] == 120
