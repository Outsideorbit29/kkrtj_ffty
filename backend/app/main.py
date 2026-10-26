"""FastAPI entry point."""
from __future__ import annotations

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.elexon import fetch_cached, normalise_actuals, normalise_forecasts
from app.forecast import build_comparison, error_metrics

app = FastAPI(title="Wind Forecast Accuracy API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


async def _load(start: str, end: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load actuals and forecasts for delivery dates [start, end] (ISO dates, Europe/London)."""
    t0 = pd.Timestamp(start, tz=config.LOCAL_TZ).tz_convert("UTC")
    t1 = (pd.Timestamp(end, tz=config.LOCAL_TZ) + pd.Timedelta(days=1)).tz_convert("UTC")
    # TODO: confirm the exact query parameter names for each dataset against the Elexon docs.
    # Forecasts are fetched from up to two days earlier so the first delivery day has a decision-time forecast.
    actuals_raw = await fetch_cached("FUELHH", {"publishDateTimeFrom": t0.isoformat(),
                                                "publishDateTimeTo": t1.isoformat()})
    forecasts_raw = await fetch_cached("WINDFOR", {"publishDateTimeFrom": (t0 - pd.Timedelta(days=2)).isoformat(),
                                                   "publishDateTimeTo": t1.isoformat()})
    actuals = normalise_actuals(actuals_raw)
    forecasts = normalise_forecasts(forecasts_raw)
    forecasts = forecasts[(forecasts["startTime"] >= t0) & (forecasts["startTime"] < t1)]
    return actuals, forecasts


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/forecasts/latest")
async def latest(start: str = Query(..., description="Delivery start date, YYYY-MM-DD"),
                 end: str = Query(..., description="Delivery end date, YYYY-MM-DD")):
    """Latest forecast available at each day-ahead decision cutoff, alongside actuals."""
    actuals, forecasts = await _load(start, end)
    comp = build_comparison(actuals, forecasts)
    if comp.empty:
        raise HTTPException(404, "No forecast/actual data for the requested window")
    return _records(comp)


@app.get("/api/accuracy")
async def accuracy(start: str, end: str):
    """Error metrics for the decision-time forecast and the naive baseline over the window."""
    actuals, forecasts = await _load(start, end)
    comp = build_comparison(actuals, forecasts).dropna(subset=["baseline"])
    if comp.empty:
        raise HTTPException(404, "No comparable intervals in the requested window")
    return {
        "forecast": error_metrics(comp["actual"], comp["forecast"]),
        "baseline_same_time_yesterday": error_metrics(comp["actual"], comp["baseline"]),
    }


def _records(df: pd.DataFrame) -> list[dict]:
    out = df.copy()
    for col in ["startTime", "publishTime", "cutoff"]:
        out[col] = out[col].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return out.where(out.notna(), None).to_dict(orient="records")
