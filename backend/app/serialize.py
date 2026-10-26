"""JSON-safe conversion: NaN/NaT -> null, ISO-8601 'Z' timestamps, rounded numbers."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from typing import Any

import pandas as pd

ISO_Z = "%Y-%m-%dT%H:%M:%SZ"


def num(value: Any, digits: int = 1) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), digits)


def iso(ts: pd.Timestamp | None) -> str | None:
    return None if ts is None or pd.isna(ts) else ts.tz_convert("UTC").strftime(ISO_Z)


def day(ts: pd.Timestamp | date) -> str:
    return ts.strftime("%Y-%m-%d")


def metrics(values: Mapping[str, float | int | None], digits: int = 1) -> dict[str, float | int | None]:
    return {k: v if isinstance(v, int) or v is None else num(v, digits) for k, v in values.items()}


def records(df: pd.DataFrame, digits: Mapping[str, int] | None = None) -> list[dict[str, Any]]:
    """Rows as dicts. Datetime columns become ISO strings; float columns are rounded
    (1 decimal unless ``digits`` says otherwise); missing values become None."""
    digits = digits or {}
    out = df.copy()
    for col in out.columns:
        series = out[col]
        if isinstance(series.dtype, pd.DatetimeTZDtype):
            out[col] = series.dt.strftime(ISO_Z)
        elif pd.api.types.is_float_dtype(series):
            out[col] = series.round(digits.get(col, 1))
    return out.astype(object).where(out.notna(), None).to_dict(orient="records")
