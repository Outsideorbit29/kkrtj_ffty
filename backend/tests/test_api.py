"""API tests against the committed snapshot."""

import pytest

from app.analysis.metrics import METRIC_KEYS

DECISION_KEYS = {
    "deliveryDate", "decisionDate", "cutoff", "decisionTimeUtc", "forecastPublishTimeUtc",
    "forecastAgeMinutes", "bandMethod", "hourly", "actualHalfHourly", "summary", "runs",
}  # fmt: skip
HOURLY_KEYS = {"startTime", "forecast", "p50", "p10", "p90", "actual", "error", "horizonHours"}
SUMMARY_KEYS = {
    "forecastMWh", "p50MWh", "actualMWh", "errorMWh", "minForecast", "maxForecast", "shortfallP90MWh",
    "mae", "bias", "trailingMedianError",
}  # fmt: skip
ACCURACY_KEYS = {
    "start", "end", "cutoff", "forecast", "forecastAdjusted", "baselines", "skill",
    "byHorizon", "byForecastLevel", "byHourOfDay", "byDay", "histogram", "series",
}  # fmt: skip
SKILL_KEYS = {"vsPersistence_pct", "vsSameHourD2_pct", "adjustedVsForecast_pct", "adjustedVsPersistence_pct"}
FORECAST_LEVEL_KEYS = {"bucket", "from", "to", "n", "mae", "bias", "overForecastShare"}


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
    summary = body["summary"]
    for row in hourly:
        assert 0 <= row["p10"] <= row["p50"] <= row["p90"]
        assert row["p50"] == pytest.approx(
            max(0.0, row["forecast"] - summary["trailingMedianError"]), abs=0.11
        )
        assert row["error"] == pytest.approx(row["forecast"] - row["actual"], abs=0.11)
        assert 0 <= row["actual"] <= 30_000

    assert len(body["actualHalfHourly"]) == 48
    assert set(body["summary"]) == SUMMARY_KEYS
    total = sum(row["forecast"] for row in hourly)
    assert body["summary"]["forecastMWh"] == pytest.approx(total, abs=0.5)
    assert summary["p50MWh"] == pytest.approx(sum(row["p50"] for row in hourly), abs=2)
    assert summary["trailingMedianError"] > 0  # the raw forecast has been running high


def test_decision_runs_show_what_was_available(client):
    body = client.get("/api/decision", params={"date": "2026-01-15"}).json()
    runs = body["runs"]
    publish_times = [r["publishTimeUtc"] for r in runs]
    assert publish_times == sorted(publish_times)
    assert publish_times[0] >= "2026-01-13T00:00:00Z" and publish_times[-1] < "2026-01-15T00:00:00Z"
    assert [r["publishTimeUtc"] for r in runs if r["isDecisionRun"]] == [body["forecastPublishTimeUtc"]]
    for run in runs:
        assert run["availableAtDecision"] == (run["publishTimeUtc"] < body["decisionTimeUtc"])
        assert all("2026-01-15" <= p["startTime"] < "2026-01-16" for p in run["points"])
    decision_run = next(r for r in runs if r["isDecisionRun"])
    by_start = {p["startTime"]: p["forecast"] for p in decision_run["points"]}
    assert all(by_start[row["startTime"]] == row["forecast"] for row in body["hourly"])


@pytest.mark.parametrize(
    ("date", "cutoff", "publish", "age"),
    [
        ("2026-01-15", "11:00", "2026-01-14T09:30:00Z", 90),
        # The 15:30 UTC run is published at the 15:30 gate closure itself: too late to use.
        ("2026-01-15", "15:30", "2026-01-14T11:30:00Z", 240),
        # On 2026-01-15 the 11:30 run was published late, at 12:25.
        ("2026-01-16", "15:30", "2026-01-15T12:25:00Z", 185),
    ],
)
def test_decision_cutoff_changes_the_run(client, date, cutoff, publish, age):
    body = client.get("/api/decision", params={"date": date, "cutoff": cutoff}).json()
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
    assert set(skill) == SKILL_KEYS

    adjusted = body["forecastAdjusted"]
    assert tuple(adjusted) == METRIC_KEYS
    assert adjusted["n"] == forecast["n"]
    assert adjusted["mae"] < forecast["mae"] and abs(adjusted["bias"]) < abs(forecast["bias"])
    gain = (1 - adjusted["mae"] / forecast["mae"]) * 100
    assert skill["adjustedVsForecast_pct"] == pytest.approx(gain, abs=0.1)
    assert "adjusted" not in body["baselines"]

    levels = body["byForecastLevel"]
    assert all(set(row) == FORECAST_LEVEL_KEYS for row in levels)
    assert sum(row["n"] for row in levels) == forecast["n"]
    for row in levels:
        assert row["to"] - row["from"] == 4000 and row["from"] % 4000 == 0
        assert row["bucket"] == f"{row['from'] // 1000}-{row['to'] // 1000} GW"
        assert 0 <= row["overForecastShare"] <= 1

    assert sum(b["n"] for b in body["byHorizon"]) == forecast["n"]
    assert all(b["bucket"] == f"{b['horizonFrom']}-{b['horizonTo']}h" for b in body["byHorizon"])
    assert [h["hour"] for h in body["byHourOfDay"]] == list(range(24))
    assert len(body["byDay"]) == 31 and body["byDay"][0]["date"] == "2026-01-02"
    assert set(body["byDay"][0]) == {"date", "mae", "bias", "forecastMWh", "actualMWh"}
    assert sum(h["count"] for h in body["histogram"]) == forecast["n"]
    assert all(h["to"] - h["from"] == 500 for h in body["histogram"])
    assert len(body["series"]) == forecast["n"]


def test_accuracy_headline_snapshot(client):
    # Headline numbers from the committed snapshot (09:20 cutoff, full scope window). They pin the
    # method: update them on purpose when the snapshot or the analysis changes, never to make CI pass.
    body = client.get("/api/accuracy").json()
    forecast = body["forecast"]
    assert forecast["n"] == 744
    assert forecast["mae"] == pytest.approx(2038.9, abs=0.5)
    assert forecast["rmse"] == pytest.approx(2504.8, abs=0.5)
    assert forecast["bias"] == pytest.approx(1747.9, abs=0.5)
    assert forecast["nmae_pct"] == pytest.approx(18.1, abs=0.05)
    assert body["skill"]["vsPersistence_pct"] == pytest.approx(50.4, abs=0.2)
    assert body["skill"]["vsSameHourD2_pct"] == pytest.approx(53.0, abs=0.2)
    adjusted = body["forecastAdjusted"]
    assert adjusted["n"] == 744
    assert adjusted["mae"] == pytest.approx(1445.8, abs=0.5)
    assert adjusted["rmse"] == pytest.approx(1909.0, abs=0.5)
    assert adjusted["bias"] == pytest.approx(649.3, abs=0.5)


def test_accuracy_15_30_does_not_use_the_run_published_at_closure(client):
    body = client.get("/api/accuracy", params={"cutoff": "15:30"}).json()
    assert body["forecast"]["mae"] == pytest.approx(1904.0, abs=0.5)
    assert body["forecast"]["rmse"] == pytest.approx(2361.1, abs=0.5)
    # The 15:30 run would give an 8.5h horizon for D 00:00; the 11:30 (or 12:25) run gives more.
    assert all(row["horizonHours"] > 8.5 for row in body["series"])


def test_partial_coverage_cutoff(client):
    # At 01:00 on D-1 the latest run (22:30 on D-2) does not reach the end of D.
    body = client.get("/api/accuracy", params={"cutoff": "01:00"}).json()
    n = body["forecast"]["n"]
    assert n == 682
    assert all(baseline["n"] == n for baseline in body["baselines"].values())

    decision = client.get("/api/decision", params={"date": "2026-01-15", "cutoff": "01:00"}).json()
    uncovered = [row for row in decision["hourly"] if row["forecast"] is None]
    assert uncovered
    for row in uncovered:
        assert row["p50"] is None and row["p10"] is None and row["p90"] is None
        assert row["horizonHours"] is None and row["error"] is None


def test_band_unavailable_without_history(client):
    response = client.get("/api/decision", params={"date": "2025-11-28"})
    assert response.status_code == 200
    body = response.json()
    assert body["bandMethod"].startswith("Unavailable")
    assert all(row[k] is None for row in body["hourly"] for k in ("p10", "p50", "p90"))
    assert body["summary"]["trailingMedianError"] is None
    assert body["summary"]["p50MWh"] is None


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
