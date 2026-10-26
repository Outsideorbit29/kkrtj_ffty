"""Elexon client: request chunking, payload shapes and cleaning, with a mocked HTTP transport."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime

import httpx
import pytest

from app import elexon
from app.elexon import ACTUAL_COLUMNS, FORECAST_COLUMNS, fetch_wind_actuals, fetch_wind_forecasts

BASE = "https://elexon.test/datasets"

Handler = Callable[[httpx.Request], httpx.Response]


@pytest.fixture
def mock_elexon(monkeypatch: pytest.MonkeyPatch) -> Callable[[Handler], list[httpx.Request]]:
    """Route elexon's HTTP client through ``handler``; returns the list of requests made."""

    def install(handler: Handler) -> list[httpx.Request]:
        seen: list[httpx.Request] = []

        def recording(request: httpx.Request) -> httpx.Response:
            seen.append(request)
            return handler(request)

        monkeypatch.setattr(elexon, "_client", lambda: httpx.Client(transport=httpx.MockTransport(recording)))
        return seen

    return install


def _fuelhh_row(start: str, published: str, generation: float, fuel: str = "WIND") -> dict:
    return {
        "startTime": start,
        "publishTime": published,
        "settlementDate": start[:10],
        "settlementPeriod": 1,
        "fuelType": fuel,
        "generation": generation,
    }


def test_actuals_one_request_per_month_and_revisions_deduplicated(mock_elexon):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params["settlementDateFrom"] != "2026-01-01":
            return httpx.Response(200, json=[])
        return httpx.Response(
            200,
            json=[  # bare list, as the stream endpoint returns
                _fuelhh_row("2026-01-01T00:00:00Z", "2026-01-01T00:30:00Z", 100),
                _fuelhh_row("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", 110),  # revision
                _fuelhh_row("2026-01-01T00:30:00Z", "2026-01-01T01:00:00Z", 120),
                _fuelhh_row("2026-01-01T00:30:00Z", "2026-01-01T01:00:00Z", 999, fuel="CCGT"),
            ],
        )

    seen = mock_elexon(handler)
    out = fetch_wind_actuals(date(2025, 12, 15), date(2026, 2, 3), BASE)

    assert [r.url.path for r in seen] == ["/datasets/FUELHH/stream"] * 3
    chunks = [(r.url.params["settlementDateFrom"], r.url.params["settlementDateTo"]) for r in seen]
    assert chunks == [
        ("2025-12-15", "2025-12-31"),
        ("2026-01-01", "2026-01-31"),
        ("2026-02-01", "2026-02-03"),
    ]
    assert all(r.url.params["fuelType"] == "WIND" for r in seen)

    assert list(out.columns) == ACTUAL_COLUMNS
    assert out["generation"].tolist() == [110, 120]  # latest revision kept, other fuels dropped
    assert str(out["startTime"].dt.tz) == "UTC"


def test_forecasts_accept_data_wrapper_and_drop_points_not_after_publish(mock_elexon):
    def handler(request: httpx.Request) -> httpx.Response:
        rows = [
            {"publishTime": "2026-01-14T07:30:00Z", "startTime": "2026-01-14T07:00:00Z", "generation": 1},
            {"publishTime": "2026-01-14T07:30:00Z", "startTime": "2026-01-14T07:30:00Z", "generation": 2},
            {"publishTime": "2026-01-14T07:30:00Z", "startTime": "2026-01-14T08:00:00Z", "generation": 3},
            {"publishTime": "2026-01-14T07:30:00Z", "startTime": "2026-01-14T08:00:00Z", "generation": 4},
        ]
        return httpx.Response(200, json={"data": rows})

    seen = mock_elexon(handler)
    start, end = datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 20, tzinfo=UTC)
    out = fetch_wind_forecasts(start, end, BASE)

    assert len(seen) == 1 and seen[0].url.path == "/datasets/WINDFOR/stream"
    assert seen[0].url.params["publishDateTimeFrom"] == "2026-01-01T00:00:00Z"
    assert seen[0].url.params["publishDateTimeTo"] == "2026-01-20T00:00:00Z"
    assert list(out.columns) == FORECAST_COLUMNS
    assert len(out) == 1  # points at/before publishTime dropped, duplicate (publish, start) collapsed
    assert out["generation"].iloc[0] == 4


def test_forecasts_split_at_month_boundaries(mock_elexon):
    seen = mock_elexon(lambda _: httpx.Response(200, json=[]))
    fetch_wind_forecasts(datetime(2025, 11, 27, tzinfo=UTC), datetime(2026, 2, 1, tzinfo=UTC), BASE)
    starts = [r.url.params["publishDateTimeFrom"] for r in seen]
    assert starts == ["2025-11-27T00:00:00Z", "2025-12-01T00:00:00Z", "2026-01-01T00:00:00Z"]


@pytest.mark.parametrize(
    ("fetch", "columns"),
    [
        (lambda: fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 2), BASE), ACTUAL_COLUMNS),
        (
            lambda: fetch_wind_forecasts(
                datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC), BASE
            ),
            FORECAST_COLUMNS,
        ),
    ],
)
def test_empty_response_gives_empty_frame_with_columns(mock_elexon, fetch, columns):
    mock_elexon(lambda _: httpx.Response(200, json=[]))
    out = fetch()
    assert out.empty
    assert list(out.columns) == columns


def test_http_error_is_raised(mock_elexon):
    mock_elexon(lambda request: httpx.Response(500, json={"error": "boom"}, request=request))
    with pytest.raises(httpx.HTTPStatusError):
        fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 2), BASE)
