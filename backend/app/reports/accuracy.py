"""GET /api/accuracy and /api/accuracy/lead-time."""

from __future__ import annotations

from datetime import date, time
from typing import Any

import pandas as pd

from app import config
from app.analysis.leadtime import lead_time_metrics
from app.analysis.metrics import bucket_start, error_metrics, grouped_metrics, histogram, skill_pct
from app.data import Dataset
from app.reports import NoDataError
from app.reports.tables import clamp_window, decision_table, in_window, run_error_table
from app.serialize import metrics, num, records

# response key -> (decision-table column, skill key)
BASELINES = {
    "persistence": ("persistence", "vsPersistence_pct"),
    "sameHourD2": ("sameHourD2", "vsSameHourD2_pct"),
}


def accuracy_report(ds: Dataset, start: date, end: date, cutoff: time) -> dict[str, Any]:
    start, end = clamp_window(ds, start, end)
    window = in_window(decision_table(ds, cutoff), start, end)
    comparable = window.dropna(subset=["forecast", "actual"])
    if comparable.empty:
        raise NoDataError(f"No hours with both forecast and actual between {start} and {end}")

    baselines: dict[str, Any] = {}
    skill: dict[str, float | None] = {}
    for key, (column, skill_key) in BASELINES.items():
        baseline = error_metrics(comparable[column], comparable["actual"])
        # Compare MAEs over the same hours (those where the baseline exists).
        forecast_mae = comparable.loc[comparable[column].notna(), "error"].abs().mean()
        baselines[key] = metrics(baseline)
        skill[skill_key] = num(skill_pct(_or_none(forecast_mae), baseline["mae"]))

    series_columns = ["startTime", "forecast", "actual", "error", "horizonHours"]
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "cutoff": cutoff.strftime("%H:%M"),
        "forecast": metrics(error_metrics(comparable["forecast"], comparable["actual"])),
        "baselines": baselines,
        "skill": skill,
        "byHorizon": _by_horizon(comparable),
        "byHourOfDay": _by_hour_of_day(comparable),
        "byDay": _by_day(comparable),
        "histogram": records(histogram(comparable["error"], config.HISTOGRAM_BIN_MW)),
        "series": records(window.loc[window["forecast"].notna(), series_columns], {"horizonHours": 2}),
    }


def lead_time_report(ds: Dataset, start: date, end: date) -> dict[str, Any]:
    start, end = clamp_window(ds, start, end)
    errors = in_window(run_error_table(ds), start, end)
    points = lead_time_metrics(errors, config.LEAD_BUCKET_HOURS, config.LEAD_MAX_HOURS)
    if points.empty:
        raise NoDataError(f"No forecast/actual pairs between {start} and {end}")
    points = points.astype({"leadFrom": int, "leadTo": int})
    points.insert(0, "leadHours", points["leadFrom"])
    columns = ["leadHours", "leadFrom", "leadTo", "n", "mae", "rmse", "bias"]
    return {"start": start.isoformat(), "end": end.isoformat(), "points": records(points[columns])}


def _or_none(value: float) -> float | None:
    return None if pd.isna(value) else float(value)


def _by_horizon(comparable: pd.DataFrame) -> list[dict[str, Any]]:
    width = config.HORIZON_BUCKET_HOURS
    key = bucket_start(comparable["horizonHours"], width).rename("horizonFrom")
    stats = grouped_metrics(comparable, key).reset_index().astype({"horizonFrom": int})
    stats["horizonTo"] = stats["horizonFrom"] + width
    stats["bucket"] = stats["horizonFrom"].astype(str) + "-" + stats["horizonTo"].astype(str) + "h"
    return records(stats[["bucket", "horizonFrom", "horizonTo", "n", "mae", "rmse", "bias"]])


def _by_hour_of_day(comparable: pd.DataFrame) -> list[dict[str, Any]]:
    hour = comparable["startTime"].dt.tz_convert(config.TIMEZONE).dt.hour.rename("hour")
    stats = grouped_metrics(comparable, hour).reset_index()
    return records(stats[["hour", "n", "mae", "bias"]])


def _by_day(comparable: pd.DataFrame) -> list[dict[str, Any]]:
    stats = grouped_metrics(comparable, "deliveryDay")
    energy = comparable.groupby("deliveryDay").agg(
        forecastMWh=("forecast", "sum"), actualMWh=("actual", "sum")
    )
    out = stats.join(energy).reset_index()
    out["date"] = out["deliveryDay"].dt.strftime("%Y-%m-%d")
    return records(out[["date", "mae", "bias", "forecastMWh", "actualMWh"]])
