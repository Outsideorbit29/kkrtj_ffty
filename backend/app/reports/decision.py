"""GET /api/decision: what the desk saw at decision time for one delivery day, and what happened."""

from __future__ import annotations

from datetime import date, time
from typing import Any

import pandas as pd

from app import config
from app.analysis.timeutil import HOUR, localize_london
from app.data import Dataset
from app.reports import NoDataError
from app.reports.tables import decision_table
from app.serialize import day, iso, num, records

HOURLY_COLUMNS = ["startTime", "forecast", "p10", "p90", "actual", "error", "horizonHours"]


def decision_report(ds: Dataset, delivery_day: date, cutoff: time) -> dict[str, Any]:
    if not ds.first_day <= delivery_day <= ds.last_day:
        raise NoDataError(
            f"Delivery day {delivery_day} is outside the data range {ds.first_day}..{ds.last_day}"
        )
    table = decision_table(ds, cutoff)
    rows = table[table["deliveryDay"] == pd.Timestamp(delivery_day)]
    decision_time = rows["decisionTime"].iloc[0]
    if rows["forecast"].isna().all():
        raise NoDataError(f"No WINDFOR run published at or before {iso(decision_time)}")

    publish_time = rows["publishTime"].max()
    day_start, day_end = rows["startTime"].min(), rows["startTime"].max() + HOUR
    actuals = ds.actuals
    half_hourly = actuals[(actuals["startTime"] >= day_start) & (actuals["startTime"] < day_end)]

    return {
        "deliveryDate": delivery_day.isoformat(),
        "decisionDate": day(decision_time.tz_convert(config.TIMEZONE)),
        "cutoff": cutoff.strftime("%H:%M"),
        "decisionTimeUtc": iso(decision_time),
        "forecastPublishTimeUtc": iso(publish_time),
        "forecastAgeMinutes": int((decision_time - publish_time) / pd.Timedelta(minutes=1)),
        "bandMethod": _band_method(int(rows["bandN"].iloc[0]), bool(rows["p10"].notna().any())),
        "hourly": records(rows[HOURLY_COLUMNS], {"horizonHours": 2}),
        "actualHalfHourly": records(half_hourly[["startTime", "generation"]]),
        "summary": _summary(rows),
        "runs": _runs(ds.forecasts, delivery_day, day_start, day_end, decision_time, publish_time),
    }


def _band_method(n: int, available: bool) -> str:
    window = f"{config.BAND_WINDOW_DAYS} delivery days before D"
    if not available:
        return f"Unavailable: fewer than {config.BAND_MIN_SAMPLES} past errors in the {window} (n={n})"
    return f"Empirical 10-90% error quantiles, {window} (n={n})"


def _forecast_at(rows: pd.DataFrame, idx: object) -> dict[str, Any]:
    return {"startTime": iso(rows.at[idx, "startTime"]), "mw": num(rows.at[idx, "forecast"])}


def _summary(rows: pd.DataFrame) -> dict[str, Any]:
    # Hourly MW averages integrate to MWh by summing. Day totals involving actuals are only
    # reported for complete days; MAE and bias use whichever hours are comparable.
    complete = bool(rows["actual"].notna().all() and rows["forecast"].notna().all())
    errors = rows["error"].dropna()
    return {
        "forecastMWh": num(rows["forecast"].sum(min_count=1)),
        "actualMWh": num(rows["actual"].sum()) if complete else None,
        "errorMWh": num(errors.sum()) if complete else None,
        "minForecast": _forecast_at(rows, rows["forecast"].idxmin()),
        "maxForecast": _forecast_at(rows, rows["forecast"].idxmax()),
        "shortfallP90MWh": num((rows["forecast"] - rows["p10"]).sum(min_count=1)),
        "mae": num(errors.abs().mean()),
        "bias": num(errors.mean()),
    }


def _runs(
    forecasts: pd.DataFrame,
    delivery_day: date,
    day_start: pd.Timestamp,
    day_end: pd.Timestamp,
    decision_time: pd.Timestamp,
    decision_publish: pd.Timestamp,
) -> list[dict[str, Any]]:
    """Every run published from D-2 00:00 to D 00:00 London with points in D, oldest first."""
    d = pd.Timestamp(delivery_day)
    publish_from, publish_to = localize_london(pd.Series([d - pd.Timedelta(days=2), d]))
    selected = forecasts[
        (forecasts["publishTime"] >= publish_from)
        & (forecasts["publishTime"] < publish_to)
        & (forecasts["startTime"] >= day_start)
        & (forecasts["startTime"] < day_end)
    ]
    return [
        {
            "publishTimeUtc": iso(publish_time),
            "availableAtDecision": bool(publish_time <= decision_time),
            "isDecisionRun": bool(publish_time == decision_publish),
            "points": records(points[["startTime", "generation"]].rename(columns={"generation": "forecast"})),
        }
        for publish_time, points in selected.groupby("publishTime", sort=True)
    ]
