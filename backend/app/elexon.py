"""Thin async client for the Elexon BMRS datasets used by this app (FUELHH, WINDFOR)."""
from __future__ import annotations

import json
from pathlib import Path

import httpx
import pandas as pd

from app import config


def _to_frame(payload) -> pd.DataFrame:
    # The stream endpoints return a JSON array; some versions wrap it in {"data": [...]}.
    rows = payload.get("data", []) if isinstance(payload, dict) else payload
    return pd.DataFrame(rows)


async def _fetch_stream(dataset: str, params: dict) -> pd.DataFrame:
    url = f"{config.ELEXON_BASE_URL}/{dataset}/stream"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return _to_frame(resp.json())


def _cache_path(dataset: str, params: dict) -> Path:
    key = "_".join(f"{k}-{v}" for k, v in sorted(params.items()))
    key = key.replace(":", "").replace("/", "").replace("+", "")
    return Path(config.CACHE_DIR) / f"{dataset}_{key}.json"


async def fetch_cached(dataset: str, params: dict) -> pd.DataFrame:
    """Fetch a stream once and cache the raw JSON on disk so reruns are fast and offline-friendly."""
    path = _cache_path(dataset, params)
    if path.exists():
        return _to_frame(json.loads(path.read_text()))
    frame = await _fetch_stream(dataset, params)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(frame.to_json(orient="records", date_format="iso"))
    return frame


def normalise_actuals(df: pd.DataFrame) -> pd.DataFrame:
    """Wind actuals: one row per startTime with the generated MW."""
    wind = df[df["fuelType"] == "WIND"].copy()
    wind["startTime"] = pd.to_datetime(wind["startTime"], utc=True)
    return wind[["startTime", "generation"]].drop_duplicates("startTime").sort_values("startTime")


def normalise_forecasts(df: pd.DataFrame) -> pd.DataFrame:
    """Wind forecasts: every (startTime, publishTime) pair with the forecast MW."""
    out = df.copy()
    out["startTime"] = pd.to_datetime(out["startTime"], utc=True)
    out["publishTime"] = pd.to_datetime(out["publishTime"], utc=True)
    return out[["startTime", "publishTime", "generation"]].sort_values(["startTime", "publishTime"])
