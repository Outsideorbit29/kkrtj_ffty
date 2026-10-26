"""Query-parameter parsing. Malformed values raise HTTP 400."""

from __future__ import annotations

import re
from datetime import date, time

from fastapi import HTTPException

_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
_CUTOFF = re.compile(r"([01]\d|2[0-3]):([0-5]\d)")


def parse_date(value: str, name: str) -> date:
    if _DATE.fullmatch(value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise HTTPException(400, f"'{name}' must be a valid date YYYY-MM-DD, got {value!r}")


def parse_cutoff(value: str) -> time:
    match = _CUTOFF.fullmatch(value)
    if not match:
        raise HTTPException(400, f"'cutoff' must be HH:MM (24h), got {value!r}")
    return time(int(match[1]), int(match[2]))


def parse_window(start: str, end: str) -> tuple[date, date]:
    first, last = parse_date(start, "start"), parse_date(end, "end")
    if first > last:
        raise HTTPException(400, f"'start' ({first}) must not be after 'end' ({last})")
    return first, last
