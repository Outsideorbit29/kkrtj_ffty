"""Domain constants (see docs/API.md) and environment-driven runtime settings."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Literal

BACKEND_DIR = Path(__file__).resolve().parents[1]

TIMEZONE = "Europe/London"

# Scope: purchase decisions on 2026-01-01..2026-01-31, i.e. delivery days D below.
DELIVERY_START = date(2026, 1, 2)
DELIVERY_END = date(2026, 2, 1)
DECISION_LEAD_DAYS = 1
DECISION_START = DELIVERY_START - timedelta(days=DECISION_LEAD_DAYS)
DECISION_END = DELIVERY_END - timedelta(days=DECISION_LEAD_DAYS)

DEFAULT_CUTOFF = "09:20"
CUTOFF_PRESETS = (
    {"label": "N2EX / EPEX hourly auction", "value": "09:20"},
    {"label": "Pre-Brexit coupled auction", "value": "11:00"},
    {"label": "EPEX half-hourly auction", "value": "15:30"},
)
FORECAST_RUN_TIMES_UTC = ("02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30")

BAND_WINDOW_DAYS = 28
BAND_MIN_SAMPLES = 7 * 24  # below a week of history the quantiles are too noisy to show
HISTOGRAM_BIN_MW = 500
HORIZON_BUCKET_HOURS = 6
LEAD_BUCKET_HOURS = 3
LEAD_MAX_HOURS = 72

# Snapshot coverage: December 2025 history feeds the trailing uncertainty band for early January.
ACTUALS_SETTLEMENT_FROM = date(2025, 11, 28)
ACTUALS_SETTLEMENT_TO = date(2026, 2, 2)
FORECASTS_PUBLISH_FROM = datetime(2025, 11, 27, tzinfo=UTC)
FORECASTS_PUBLISH_TO = datetime(2026, 2, 1, tzinfo=UTC)

DataSource = Literal["snapshot", "live"]


def _path_from_env(name: str, default: str) -> Path:
    path = Path(os.getenv(name, default))
    return path if path.is_absolute() else BACKEND_DIR / path


@dataclass(frozen=True)
class Settings:
    data_source: DataSource
    snapshot_dir: Path
    static_dir: Path
    elexon_base_url: str

    @classmethod
    def from_env(cls) -> Settings:
        source = os.getenv("DATA_SOURCE", "snapshot").strip().lower()
        if source not in ("snapshot", "live"):
            raise ValueError(f"DATA_SOURCE must be 'snapshot' or 'live', got {source!r}")
        return cls(
            data_source=source,  # type: ignore[arg-type]  # narrowed by the check above
            snapshot_dir=_path_from_env("SNAPSHOT_DIR", "data/snapshot"),
            static_dir=_path_from_env("STATIC_DIR", "static"),
            elexon_base_url=os.getenv(
                "ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1/datasets"
            ).rstrip("/"),
        )
