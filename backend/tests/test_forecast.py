import pandas as pd

from app.forecast import decision_cutoff, error_metrics, latest_forecast_before


def test_cutoff_is_previous_day_at_1100_london_in_winter():
    # 2026-01-15 00:00 London == 2026-01-15 00:00 UTC (GMT in January)
    start = pd.Timestamp("2026-01-15T00:00:00Z")
    assert decision_cutoff(start) == pd.Timestamp("2026-01-14T11:00:00Z")


def test_latest_forecast_ignores_publications_after_cutoff():
    f = pd.DataFrame({
        "startTime": pd.to_datetime(["2026-01-15T00:00Z"] * 3, utc=True),
        "publishTime": pd.to_datetime(["2026-01-13T10:00Z", "2026-01-14T09:00Z", "2026-01-14T12:00Z"], utc=True),
        "generation": [100.0, 200.0, 999.0],
    })
    out = latest_forecast_before(f, pd.Timestamp("2026-01-14T11:00Z"))
    assert out["forecast"].iloc[0] == 200.0


def test_error_metrics_basic():
    m = error_metrics(pd.Series([100.0, 200.0]), pd.Series([110.0, 180.0]))
    assert m["mae_mw"] == 15.0
    assert m["bias_mw"] == -5.0
    assert round(m["rmse_mw"], 3) == 15.811
