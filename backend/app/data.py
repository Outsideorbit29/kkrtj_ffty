"""In-memory dataset: snapshot read/write and live loading."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

import pandas as pd

from app import config, elexon
from app.analysis.actuals import hourly_actuals
from app.analysis.timeutil import london_day
from app.serialize import ISO_Z

ACTUALS_FILE = "actuals.csv.gz"
FORECASTS_FILE = "forecasts.csv.gz"
MANIFEST_FILE = "manifest.json"
_GZIP = {"method": "gzip", "mtime": 0}  # mtime=0 keeps the files byte-reproducible


@dataclass(frozen=True, eq=False)  # eq=False: hashable by identity, usable as a cache key
class Dataset:
    actuals: pd.DataFrame  # half-hourly: startTime, generation (+ FUELHH metadata)
    hourly_actuals: pd.DataFrame  # startTime, actual
    forecasts: pd.DataFrame  # publishTime, startTime, generation
    source: config.DataSource
    created_utc: datetime
    first_day: date  # first delivery day with both actuals and a possible D-1 forecast
    last_day: date


def build_dataset(
    actuals: pd.DataFrame, forecasts: pd.DataFrame, source: config.DataSource, created_utc: datetime
) -> Dataset:
    if actuals.empty or forecasts.empty:
        raise ValueError("dataset needs both actuals and forecasts")
    actuals = actuals.astype({"generation": float})
    forecasts = forecasts.astype({"generation": float})
    actual_days = london_day(actuals["startTime"])
    # A run published on day X can serve the decision for delivery day X + lead.
    lead = pd.Timedelta(days=config.DECISION_LEAD_DAYS)
    publish_days = london_day(forecasts["publishTime"]) + lead
    first = max(actual_days.min(), publish_days.min())
    last = min(actual_days.max(), publish_days.max())
    return Dataset(
        actuals=actuals,
        hourly_actuals=hourly_actuals(actuals),
        forecasts=forecasts,
        source=source,
        created_utc=created_utc,
        first_day=first.date(),
        last_day=last.date(),
    )


def _iso_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for col in columns:
        out[col] = out[col].dt.strftime(ISO_Z)
    return out


def write_snapshot(directory: Path, actuals: pd.DataFrame, forecasts: pd.DataFrame) -> dict:
    """Write both datasets plus a manifest; returns the manifest."""
    directory.mkdir(parents=True, exist_ok=True)
    _iso_columns(actuals, ["startTime", "publishTime"]).to_csv(
        directory / ACTUALS_FILE, index=False, compression=_GZIP
    )
    _iso_columns(forecasts, ["publishTime", "startTime"]).to_csv(
        directory / FORECASTS_FILE, index=False, compression=_GZIP
    )

    def span(series: pd.Series) -> dict[str, str]:
        return {"min": f"{series.min():{ISO_Z}}", "max": f"{series.max():{ISO_Z}}"}

    manifest = {
        "createdUtc": f"{datetime.now(UTC):{ISO_Z}}",
        "source": "Elexon BMRS (https://data.elexon.co.uk/bmrs/api/v1/datasets)",
        "actuals": {
            "file": ACTUALS_FILE,
            "dataset": "FUELHH",
            "fuelType": "WIND",
            "settlementDateFrom": config.ACTUALS_SETTLEMENT_FROM.isoformat(),
            "settlementDateTo": config.ACTUALS_SETTLEMENT_TO.isoformat(),
            "rows": len(actuals),
            "startTime": span(actuals["startTime"]),
            "notes": "Latest publishTime kept per startTime.",
        },
        "forecasts": {
            "file": FORECASTS_FILE,
            "dataset": "WINDFOR",
            "publishDateTimeFrom": f"{config.FORECASTS_PUBLISH_FROM:{ISO_Z}}",
            "publishDateTimeTo": f"{config.FORECASTS_PUBLISH_TO:{ISO_Z}}",
            "rows": len(forecasts),
            "runs": int(forecasts["publishTime"].nunique()),
            "publishTime": span(forecasts["publishTime"]),
            "notes": "Only points with startTime > publishTime.",
        },
    }
    (directory / MANIFEST_FILE).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def _read_csv(path: Path, time_columns: list[str]) -> pd.DataFrame:
    df = pd.read_csv(path)
    for col in time_columns:
        df[col] = pd.to_datetime(df[col], utc=True, format="ISO8601")
    return df


def read_snapshot(directory: Path) -> Dataset:
    manifest = json.loads((directory / MANIFEST_FILE).read_text(encoding="utf-8"))
    actuals = _read_csv(directory / ACTUALS_FILE, ["startTime", "publishTime"])
    forecasts = _read_csv(directory / FORECASTS_FILE, ["publishTime", "startTime"])
    created = datetime.fromisoformat(manifest["createdUtc"].replace("Z", "+00:00"))
    return build_dataset(actuals, forecasts, "snapshot", created)


def fetch_live(base_url: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    actuals = elexon.fetch_wind_actuals(
        config.ACTUALS_SETTLEMENT_FROM, config.ACTUALS_SETTLEMENT_TO, base_url
    )
    forecasts = elexon.fetch_wind_forecasts(
        config.FORECASTS_PUBLISH_FROM, config.FORECASTS_PUBLISH_TO, base_url
    )
    return actuals, forecasts


def load_dataset(settings: config.Settings) -> Dataset:
    if settings.data_source == "live":
        actuals, forecasts = fetch_live(settings.elexon_base_url)
        return build_dataset(actuals, forecasts, "live", datetime.now(UTC))
    return read_snapshot(settings.snapshot_dir)
