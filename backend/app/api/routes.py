"""HTTP endpoints under /api (contract: docs/API.md)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request

from app import config
from app.api.params import parse_cutoff, parse_date, parse_window
from app.data import Dataset, load_dataset
from app.reports.accuracy import accuracy_report, lead_time_report
from app.reports.decision import decision_report
from app.serialize import ISO_Z

router = APIRouter(prefix="/api")

DEFAULT_START = config.DELIVERY_START.isoformat()
DEFAULT_END = config.DELIVERY_END.isoformat()


def get_dataset(request: Request) -> Dataset:
    state = request.app.state
    if not hasattr(state, "dataset"):
        state.dataset = load_dataset(state.settings)
    return state.dataset


DatasetDep = Annotated[Dataset, Depends(get_dataset)]
Cutoff = Annotated[str, Query(description="Decision cutoff HH:MM, Europe/London, on D-1")]
Start = Annotated[str, Query(description="First delivery day YYYY-MM-DD (Europe/London)")]
End = Annotated[str, Query(description="Last delivery day YYYY-MM-DD (Europe/London)")]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta")
def meta(ds: DatasetDep) -> dict[str, Any]:
    return {
        "deliveryStart": DEFAULT_START,
        "deliveryEnd": DEFAULT_END,
        "decisionStart": config.DECISION_START.isoformat(),
        "decisionEnd": config.DECISION_END.isoformat(),
        "defaultCutoff": config.DEFAULT_CUTOFF,
        "cutoffPresets": list(config.CUTOFF_PRESETS),
        "forecastRunTimesUtc": list(config.FORECAST_RUN_TIMES_UTC),
        "dataSource": ds.source,
        "snapshotCreatedUtc": ds.created_utc.strftime(ISO_Z),
        "timezone": config.TIMEZONE,
    }


@router.get("/decision")
def decision(
    ds: DatasetDep,
    date: Annotated[str, Query(description="Delivery day D, YYYY-MM-DD")],
    cutoff: Cutoff = config.DEFAULT_CUTOFF,
) -> dict[str, Any]:
    return decision_report(ds, parse_date(date, "date"), parse_cutoff(cutoff))


@router.get("/accuracy")
def accuracy(
    ds: DatasetDep,
    start: Start = DEFAULT_START,
    end: End = DEFAULT_END,
    cutoff: Cutoff = config.DEFAULT_CUTOFF,
) -> dict[str, Any]:
    first, last = parse_window(start, end)
    return accuracy_report(ds, first, last, parse_cutoff(cutoff))


@router.get("/accuracy/lead-time")
def accuracy_lead_time(
    ds: DatasetDep, start: Start = DEFAULT_START, end: End = DEFAULT_END
) -> dict[str, Any]:
    first, last = parse_window(start, end)
    return lead_time_report(ds, first, last)
