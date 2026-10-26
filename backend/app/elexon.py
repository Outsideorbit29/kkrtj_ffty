"""Elexon BMRS client: the only module that talks to Elexon.

Returns cleaned frames with tz-aware UTC timestamps:
- actuals:   one row per half-hour ``startTime`` (latest revision), FUELHH fuelType WIND
- forecasts: one row per (``publishTime``, ``startTime``), WINDFOR, future points only
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime, timedelta

import httpx
import pandas as pd

TIMEOUT_S = 120.0
ACTUAL_COLUMNS = ["startTime", "publishTime", "settlementDate", "settlementPeriod", "generation"]
FORECAST_COLUMNS = ["publishTime", "startTime", "generation"]


def _next_month(d: date) -> date:
    return date(d.year + d.month // 12, d.month % 12 + 1, 1)


def _date_chunks(first: date, last: date) -> Iterator[tuple[date, date]]:
    """Inclusive [from, to] date ranges split at month boundaries."""
    start = first
    while start <= last:
        end = min(_next_month(start) - timedelta(days=1), last)
        yield start, end
        start = end + timedelta(days=1)


def _datetime_chunks(start: datetime, end: datetime) -> Iterator[tuple[datetime, datetime]]:
    """[from, to] datetime ranges split at UTC month boundaries."""
    while start < end:
        boundary = datetime.combine(_next_month(start.date()), datetime.min.time(), start.tzinfo)
        stop = min(boundary, end)
        yield start, stop
        start = stop


def _iso_z(ts: datetime) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%SZ")


def _get_stream(client: httpx.Client, base_url: str, dataset: str, params: dict[str, str]) -> list[dict]:
    response = client.get(f"{base_url}/{dataset}/stream", params=params)
    response.raise_for_status()
    payload = response.json()
    # The stream endpoints return a bare JSON array; tolerate a {"data": [...]} wrapper.
    return payload.get("data", []) if isinstance(payload, dict) else payload


def _client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT_S, transport=httpx.HTTPTransport(retries=3))


def clean_actuals(raw: pd.DataFrame) -> pd.DataFrame:
    """WIND rows only; for revised periods keep the latest publication."""
    if raw.empty:
        return pd.DataFrame(columns=ACTUAL_COLUMNS)
    df = raw[raw["fuelType"] == "WIND"].copy() if "fuelType" in raw else raw.copy()
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True, format="ISO8601")
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True, format="ISO8601")
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    df = df.sort_values(["startTime", "publishTime"]).drop_duplicates("startTime", keep="last")
    return df[ACTUAL_COLUMNS].reset_index(drop=True)


def clean_forecasts(raw: pd.DataFrame) -> pd.DataFrame:
    """Drop the points of each run that lie before its publish time (not forecasts)."""
    if raw.empty:
        return pd.DataFrame(columns=FORECAST_COLUMNS)
    df = raw.copy()
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True, format="ISO8601")
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True, format="ISO8601")
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")
    df = df[df["startTime"] > df["publishTime"]]
    df = df.drop_duplicates(["publishTime", "startTime"], keep="last")
    return df.sort_values(["publishTime", "startTime"])[FORECAST_COLUMNS].reset_index(drop=True)


def fetch_wind_actuals(settlement_from: date, settlement_to: date, base_url: str) -> pd.DataFrame:
    """FUELHH WIND for settlement dates [from, to], inclusive."""
    rows: list[dict] = []
    with _client() as client:
        for first, last in _date_chunks(settlement_from, settlement_to):
            params = {
                "settlementDateFrom": first.isoformat(),
                "settlementDateTo": last.isoformat(),
                "fuelType": "WIND",
            }
            rows.extend(_get_stream(client, base_url, "FUELHH", params))
    return clean_actuals(pd.DataFrame(rows))


def fetch_wind_forecasts(publish_from: datetime, publish_to: datetime, base_url: str) -> pd.DataFrame:
    """WINDFOR runs published in [from, to] (UTC), fetched one month per request."""
    rows: list[dict] = []
    with _client() as client:
        for start, stop in _datetime_chunks(publish_from, publish_to):
            params = {"publishDateTimeFrom": _iso_z(start), "publishDateTimeTo": _iso_z(stop)}
            rows.extend(_get_stream(client, base_url, "WINDFOR", params))
    return clean_forecasts(pd.DataFrame(rows))
