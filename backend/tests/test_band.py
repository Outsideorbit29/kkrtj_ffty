from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from app.analysis.band import add_uncertainty_band, error_quantiles_by_day
from app.analysis.timeutil import HOUR, delivery_hours

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
    tampered.loc[tampered["startTime"] + HOUR > decision, "error"] = 1e6  # D-1 after 09:00, D, later
    after = _band_for(tampered, "2026-02-01")

    assert (after["errorQLow"], after["errorQHigh"]) == (before["errorQLow"], before["errorQHigh"])
    assert before["bandN"] == 28 * 24 - 15  # 28 days minus the D-1 hours ending after 09:00


def test_band_window_is_trailing_28_days():
    table = _table()
    q = _band_for(table, "2026-02-01")
    history = table[
        (table["deliveryDay"] >= pd.Timestamp("2026-01-04"))
        & (table["startTime"] + HOUR <= pd.Timestamp("2026-01-31T09:00Z"))
    ]
    assert q["errorQLow"] == pytest.approx(np.quantile(history["error"], 0.1))
    assert q["errorQHigh"] == pytest.approx(np.quantile(history["error"], 0.9))


def test_band_needs_history_and_maps_error_quantiles_to_actual_interval():
    table = _table(days=3, seed=1).assign(forecast=200.0)
    out = add_uncertainty_band(table, window_days=28, min_samples=24)

    assert out.loc[out["deliveryDay"] == pd.Timestamp("2026-01-01"), "p10"].isna().all()
    row = out[out["deliveryDay"] == pd.Timestamp("2026-01-03")].iloc[0]
    # actual = forecast - error, so the high error quantile sets the low end; floored at 0.
    assert row["p10"] == max(0.0, 200.0 - row["errorQHigh"])
    assert row["p90"] == pytest.approx(max(0.0, 200.0 - row["errorQLow"]))
    assert row["p10"] <= row["p90"]
