from datetime import date, time, timedelta

import numpy as np
import pandas as pd
import pytest

from app.analysis.band import add_uncertainty_band, error_quantiles_by_day
from app.analysis.timeutil import HOUR, delivery_hours
from app.reports.tables import decision_table, in_window

FIRST_DAY = date(2026, 1, 1)
DECISION_OFFSET = pd.Timedelta(hours=-24 + 9)  # 09:00 on D-1 (January: London == UTC)


def _table(days: int = 40, seed: int = 0) -> pd.DataFrame:
    hours = delivery_hours(FIRST_DAY, FIRST_DAY + timedelta(days=days - 1))
    rng = np.random.default_rng(seed)
    return hours.assign(
        decisionTime=(hours["deliveryDay"] + DECISION_OFFSET).dt.tz_localize("UTC"),
        forecast=1000.0,
        error=rng.normal(0, 300, len(hours)),
    )


def _band_for(table: pd.DataFrame, day: str) -> pd.Series:
    quantiles = error_quantiles_by_day(table, window_days=28, min_samples=24)
    return quantiles.set_index("deliveryDay").loc[pd.Timestamp(day)]


def test_band_ignores_errors_not_yet_known_at_decision_time():
    table = _table()
    before = _band_for(table, "2026-02-01")

    decision = pd.Timestamp("2026-01-31T09:00Z")
    tampered = table.copy()
    # D-1 hours ending at or after 09:00 (the 08:00 hour's last half-hour is published at 09:00), D, later
    tampered.loc[tampered["startTime"] + HOUR >= decision, "error"] = 1e6
    after = _band_for(tampered, "2026-02-01")

    columns = ["errorQLow", "errorQMid", "errorQHigh"]
    assert after[columns].tolist() == before[columns].tolist()
    assert before["bandN"] == 28 * 24 - 16  # 28 days minus the D-1 hours not ended before 09:00


def test_band_window_is_trailing_28_days():
    table = _table()
    q = _band_for(table, "2026-02-01")
    history = table[
        (table["deliveryDay"] >= pd.Timestamp("2026-01-04"))
        & (table["startTime"] + HOUR < pd.Timestamp("2026-01-31T09:00Z"))
    ]
    assert q["errorQLow"] == pytest.approx(np.quantile(history["error"], 0.1))
    assert q["errorQHigh"] == pytest.approx(np.quantile(history["error"], 0.9))
    assert q["errorQMid"] == pytest.approx(np.median(history["error"]))


def test_band_needs_history_and_maps_error_quantiles_to_actual_interval():
    table = _table(days=3, seed=1).assign(forecast=200.0)
    out = add_uncertainty_band(table, window_days=28, min_samples=24)

    assert out.loc[out["deliveryDay"] == pd.Timestamp("2026-01-01"), "p10"].isna().all()
    row = out[out["deliveryDay"] == pd.Timestamp("2026-01-03")].iloc[0]
    # actual = forecast - error, so the high error quantile sets the low end; floored at 0.
    assert row["p10"] == max(0.0, 200.0 - row["errorQHigh"])
    assert row["p90"] == pytest.approx(max(0.0, 200.0 - row["errorQLow"]))
    assert row["p10"] <= row["p90"]


def test_p50_ignores_errors_not_yet_known_at_decision_time():
    table = _table()
    day = pd.Timestamp("2026-02-01")
    before = add_uncertainty_band(table, window_days=28, min_samples=24)

    tampered = table.copy()
    tampered.loc[tampered["startTime"] + HOUR >= pd.Timestamp("2026-01-31T09:00Z"), "error"] = 1e6
    after = add_uncertainty_band(tampered, window_days=28, min_samples=24)

    p50_before = before.loc[before["deliveryDay"] == day, "p50"].to_numpy()
    p50_after = after.loc[after["deliveryDay"] == day, "p50"].to_numpy()
    np.testing.assert_array_equal(p50_after, p50_before)


def test_p50_is_forecast_minus_trailing_median_error():
    # Two days of history with a known median, then the day under test.
    table = _table(days=3).assign(forecast=1000.0)
    table["error"] = np.where(table["deliveryDay"] == pd.Timestamp("2026-01-01"), 300.0, 100.0)
    out = add_uncertainty_band(table, window_days=28, min_samples=24)

    day3 = out[out["deliveryDay"] == pd.Timestamp("2026-01-03")]
    history = table[
        (table["deliveryDay"] < pd.Timestamp("2026-01-03"))
        & (table["startTime"] + HOUR < pd.Timestamp("2026-01-02T09:00Z"))
    ]
    expected = 1000.0 - np.median(history["error"])
    assert day3["p50"].tolist() == pytest.approx([expected] * 24)
    assert (day3["p10"] <= day3["p50"]).all() and (day3["p50"] <= day3["p90"]).all()


def test_p50_needs_history_and_is_floored_at_zero():
    table = _table(days=3).assign(forecast=50.0, error=400.0)  # forecast ran 400 MW high
    out = add_uncertainty_band(table, window_days=28, min_samples=24)

    assert out.loc[out["deliveryDay"] == pd.Timestamp("2026-01-01"), "p50"].isna().all()
    assert (out.loc[out["deliveryDay"] == pd.Timestamp("2026-01-03"), "p50"] == 0.0).all()


def test_band_coverage_snapshot(dataset):
    # Snapshot regression: 09:20 cutoff, scope window. Update on purpose if the data or method changes.
    t = in_window(decision_table(dataset, time(9, 20)), date(2026, 1, 2), date(2026, 2, 1))
    assert len(t) == 744
    assert t[["p10", "p50", "p90"]].notna().all().all()
    inside = (t["actual"] >= t["p10"]) & (t["actual"] <= t["p90"])
    assert inside.mean() == pytest.approx(0.852, abs=0.005)
