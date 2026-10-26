"""API tests against the committed snapshot."""

import pytest

from app.analysis.metrics import METRIC_KEYS

DECISION_KEYS = {
    "deliveryDate", "decisionDate", "cutoff", "decisionTimeUtc", "forecastPublishTimeUtc",
    "forecastAgeMinutes", "bandMethod", "hourly", "actualHalfHourly", "summary", "runs",
}  # fmt: skip
HOURLY_KEYS = {"startTime", "forecast", "p10", "p90", "actual", "error", "horizonHours"}
SUMMARY_KEYS = {
    "forecastMWh", "actualMWh", "errorMWh", "minForecast", "maxForecast", "shortfallP90MWh", "mae", "bias",
}  # fmt: skip
ACCURACY_KEYS = {
    "start", "end", "cutoff", "forecast", "baselines", "skill",
    "byHorizon", "byHourOfDay", "byDay", "histogram", "series",
}  # fmt: skip


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta(client):
    meta = client.get("/api/meta").json()
    assert meta["deliveryStart"] == "2026-01-02" and meta["deliveryEnd"] == "2026-02-01"
    assert meta["decisionStart"] == "2026-01-01" and meta["decisionEnd"] == "2026-01-31"
    assert meta["defaultCutoff"] == "09:20"
    assert {p["value"] for p in meta["cutoffPresets"]} == {"09:20", "11:00", "15:30"}
    assert meta["dataSource"] == "snapshot"
    assert meta["snapshotCreatedUtc"].endswith("Z")
    assert meta["timezone"] == "Europe/London"


def test_decision_default_cutoff(client):
    body = client.get("/api/decision", params={"date": "2026-01-15"}).json()
    assert set(body) == DECISION_KEYS
    assert body["decisionDate"] == "2026-01-14"
    assert body["decisionTimeUtc"] == "2026-01-14T09:20:00Z"
    assert body["forecastPublishTimeUtc"] == "2026-01-14T07:30:00Z"
    assert body["forecastAgeMinutes"] == 110
    assert "n=" in body["bandMethod"]

    hourly = body["hourly"]
    assert len(hourly) == 24
    assert all(set(row) == HOURLY_KEYS for row in hourly)
    assert hourly[0]["startTime"] == "2026-01-15T00:00:00Z"
    assert hourly[0]["horizonHours"] == 16.5
    for row in hourly:
        assert 0 <= row["p10"] <= row["p90"]
        assert row["error"] == pytest.approx(row["forecast"] - row["actual"], abs=0.11)
        assert 0 <= row["actual"] <= 30_000

    assert len(body["actualHalfHourly"]) == 48
    assert set(body["summary"]) == SUMMARY_KEYS
    total = sum(row["forecast"] for row in hourly)
    assert body["summary"]["forecastMWh"] == pytest.approx(total, abs=0.5)


def test_decision_runs_show_what_was_available(client):
    body = client.get("/api/decision", params={"date": "2026-01-15"}).json()
    runs = body["runs"]
    publish_times = [r["publishTimeUtc"] for r in runs]
    assert publish_times == sorted(publish_times)
    assert publish_times[0] >= "2026-01-13T00:00:00Z" and publish_times[-1] < "2026-01-15T00:00:00Z"
    assert [r["publishTimeUtc"] for r in runs if r["isDecisionRun"]] == [body["forecastPublishTimeUtc"]]
    for run in runs:
        assert run["availableAtDecision"] == (run["publishTimeUtc"] <= body["decisionTimeUtc"])
        assert all("2026-01-15" <= p["startTime"] < "2026-01-16" for p in run["points"])
    decision_run = next(r for r in runs if r["isDecisionRun"])
    by_start = {p["startTime"]: p["forecast"] for p in decision_run["points"]}
    assert all(by_start[row["startTime"]] == row["forecast"] for row in body["hourly"])


@pytest.mark.parametrize(
    ("cutoff", "publish", "age"),
    [("11:00", "2026-01-14T09:30:00Z", 90), ("15:30", "2026-01-14T15:30:00Z", 0)],
)
def test_decision_cutoff_changes_the_run(client, cutoff, publish, age):
    body = client.get("/api/decision", params={"date": "2026-01-15", "cutoff": cutoff}).json()
    assert body["cutoff"] == cutoff
    assert body["forecastPublishTimeUtc"] == publish
    assert body["forecastAgeMinutes"] == age


def test_accuracy_default_window(client):
    body = client.get("/api/accuracy").json()
    assert set(body) == ACCURACY_KEYS
    assert (body["start"], body["end"], body["cutoff"]) == ("2026-01-02", "2026-02-01", "09:20")

    forecast = body["forecast"]
    assert tuple(forecast) == METRIC_KEYS
    assert forecast["n"] == 31 * 24
    assert forecast["nmae_pct"] == pytest.approx(forecast["mae"] / forecast["mean_actual"] * 100, abs=0.1)
    assert 100 < forecast["mae"] < 3000
    for baseline in body["baselines"].values():
        assert tuple(baseline) == METRIC_KEYS
        assert baseline["n"] == forecast["n"]
    skill = body["skill"]
    assert skill["vsPersistence_pct"] == pytest.approx(
        (1 - forecast["mae"] / body["baselines"]["persistence"]["mae"]) * 100, abs=0.1
    )
    assert set(skill) == {"vsPersistence_pct", "vsSameHourD2_pct"}

    assert sum(b["n"] for b in body["byHorizon"]) == forecast["n"]
    assert all(b["bucket"] == f"{b['horizonFrom']}-{b['horizonTo']}h" for b in body["byHorizon"])
    assert [h["hour"] for h in body["byHourOfDay"]] == list(range(24))
    assert len(body["byDay"]) == 31 and body["byDay"][0]["date"] == "2026-01-02"
    assert set(body["byDay"][0]) == {"date", "mae", "bias", "forecastMWh", "actualMWh"}
    assert sum(h["count"] for h in body["histogram"]) == forecast["n"]
    assert all(h["to"] - h["from"] == 500 for h in body["histogram"])
    assert len(body["series"]) == forecast["n"]


def test_accuracy_single_day_matches_decision_summary(client):
    day = {"start": "2026-01-15", "end": "2026-01-15"}
    accuracy = client.get("/api/accuracy", params=day).json()
    summary = client.get("/api/decision", params={"date": "2026-01-15"}).json()["summary"]
    assert accuracy["forecast"]["mae"] == summary["mae"]
    assert accuracy["forecast"]["bias"] == summary["bias"]


def test_accuracy_window_is_clamped_to_data(client, dataset):
    body = client.get("/api/accuracy", params={"start": "2025-01-01", "end": "2026-12-31"}).json()
    assert body["start"] == dataset.first_day.isoformat()
    assert body["end"] == dataset.last_day.isoformat()


def test_lead_time(client):
    body = client.get("/api/accuracy/lead-time").json()
    assert (body["start"], body["end"]) == ("2026-01-02", "2026-02-01")
    points = body["points"]
    assert points[0]["leadHours"] == 0
    for point in points:
        assert set(point) == {"leadHours", "leadFrom", "leadTo", "n", "mae", "rmse", "bias"}
        assert point["leadHours"] == point["leadFrom"] and point["leadTo"] - point["leadFrom"] == 3
        assert 0 <= point["leadFrom"] < 72
    # Forecasts get worse with lead time: compare the first and last day-ahead buckets.
    assert points[0]["mae"] < next(p for p in points if p["leadFrom"] == 45)["mae"]


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/decision", {}),
        ("/api/decision", {"date": "2026-1-15"}),
        ("/api/decision", {"date": "2026-02-30"}),
        ("/api/decision", {"date": "20260115"}),
        ("/api/decision", {"date": "2026-01-15", "cutoff": "9:20"}),
        ("/api/decision", {"date": "2026-01-15", "cutoff": "24:00"}),
        ("/api/accuracy", {"start": "2026-01-10", "end": "2026-01-05"}),
        ("/api/accuracy", {"start": "yesterday"}),
        ("/api/accuracy", {"cutoff": "09:60"}),
        ("/api/accuracy/lead-time", {"end": "2026-13-01"}),
    ],
)
def test_bad_input_is_400(client, path, params):
    response = client.get(path, params=params)
    assert response.status_code == 400
    assert "detail" in response.json()


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/decision", {"date": "2025-06-01"}),
        ("/api/decision", {"date": "2026-02-02"}),
        ("/api/accuracy", {"start": "2025-01-01", "end": "2025-01-31"}),
        ("/api/accuracy/lead-time", {"start": "2027-01-01", "end": "2027-01-31"}),
        ("/api/nope", {}),
    ],
)
def test_no_data_is_404(client, path, params):
    response = client.get(path, params=params)
    assert response.status_code == 404
    assert "detail" in response.json()


def test_cors_allows_get(client):
    response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "*"
