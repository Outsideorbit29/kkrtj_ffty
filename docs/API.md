# API contract

All endpoints are `GET` and return JSON. Timestamps are ISO-8601 UTC strings ending in `Z`.
Dates (`date`, `start`, `end`) are Europe/London calendar dates `YYYY-MM-DD` and refer to the
**delivery day**. Power values are MW, energy values are MWh.

## Domain rules (single source of truth)

| Rule | Value |
|---|---|
| Scope | Purchase decisions made on 2026-01-01 .. 2026-01-31, so delivery days D = 2026-01-02 .. 2026-02-01 |
| Decision time | D-1 at `cutoff` Europe/London. Default `09:20` (GB day-ahead hourly auction gate closure). Query param `cutoff=HH:MM` overrides it. |
| Forecast used | For each target hour, the WINDFOR value from the latest run with `publishTime <= decision time` |
| Forecast resolution | WINDFOR is hourly (runs at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC, 73 hourly points each) |
| Actual resolution | FUELHH WIND is half-hourly. Hourly actual for hour H = mean of the periods starting H:00 and H:30 (both required). This is the average MW over the hour, matching hourly day-ahead products. |
| Error sign | `error = forecast - actual`. Positive = wind over-forecast = shortfall risk (must buy more). |
| Horizon | `horizonHours = (startTime - publishTime)` in hours, for the forecast used |
| Baselines | `persistence`: last half-hourly actual known at decision time (period end <= decision time), held flat. `sameHourD2`: hourly actual of the same hour two days earlier (fully known at decision time). |
| Uncertainty band | Empirical quantiles of decision-time forecast errors for delivery days **strictly before D**, trailing 28 days (December 2025 history is in the snapshot for this). `p10 = max(0, forecast - q90(error))`, `p90 = max(0, forecast - q10(error))`. Gives an 80% interval for the actual. |

## `GET /api/health`
`{"status": "ok"}`

## `GET /api/meta`
```json
{
  "deliveryStart": "2026-01-02", "deliveryEnd": "2026-02-01",
  "decisionStart": "2026-01-01", "decisionEnd": "2026-01-31",
  "defaultCutoff": "09:20",
  "cutoffPresets": [{"label": "N2EX / EPEX hourly auction", "value": "09:20"}, {"label": "Pre-Brexit coupled auction", "value": "11:00"}, {"label": "EPEX half-hourly auction", "value": "15:30"}],
  "forecastRunTimesUtc": ["02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30"],
  "dataSource": "snapshot", "snapshotCreatedUtc": "2026-10-26T10:00:00Z",
  "timezone": "Europe/London"
}
```

## `GET /api/decision?date=2026-01-15&cutoff=09:20`
`date` = delivery day D (decision is made on D-1).
```json
{
  "deliveryDate": "2026-01-15", "decisionDate": "2026-01-14",
  "cutoff": "09:20", "decisionTimeUtc": "2026-01-14T09:20:00Z",
  "forecastPublishTimeUtc": "2026-01-14T07:30:00Z", "forecastAgeMinutes": 110,
  "bandMethod": "Empirical 10-90% error quantiles, 28 delivery days before D (n=672)",
  "hourly": [
    {"startTime": "2026-01-15T00:00:00Z", "forecast": 12000, "p10": 10100, "p90": 13600,
     "actual": 11800, "error": 200, "horizonHours": 16.5}
  ],
  "actualHalfHourly": [{"startTime": "2026-01-15T00:00:00Z", "generation": 11750}],
  "summary": {
    "forecastMWh": 280000, "actualMWh": 275000, "errorMWh": 5000,
    "minForecast": {"startTime": "...", "mw": 6000}, "maxForecast": {"startTime": "...", "mw": 15000},
    "shortfallP90MWh": 24000,
    "mae": 900, "bias": 210
  },
  "runs": [
    {"publishTimeUtc": "2026-01-13T22:30:00Z", "availableAtDecision": true, "isDecisionRun": false,
     "points": [{"startTime": "2026-01-15T00:00:00Z", "forecast": 11900}]}
  ]
}
```
- `hourly`: 24 rows for D (23/25 on clock-change days; not relevant in January). `actual`, `error` are `null` when unknown.
- `shortfallP90MWh` = sum over hours of `forecast - p10` (wind energy that may be missing in a 1-in-10 case).
- `runs`: every WINDFOR run published between D-2 00:00 and D 00:00 (London) that covers D, oldest first.
  Runs after the decision time have `availableAtDecision: false` (shows how the forecast moved after the purchase).
- 404 with `{"detail": "..."}` if D is outside the data range or no forecast exists before the decision time.

## `GET /api/accuracy?start=2026-01-02&end=2026-02-01&cutoff=09:20`
Defaults: the full scope window. Metrics use hours where both forecast and actual exist.
```json
{
  "start": "2026-01-02", "end": "2026-02-01", "cutoff": "09:20",
  "forecast": {"n": 744, "mae": 900, "rmse": 1200, "bias": 100, "nmae_pct": 8.1, "p10_error": -1400, "p50_error": 50, "p90_error": 1500, "p90_abs_error": 2100, "max_abs_error": 5200, "mean_actual": 11000},
  "baselines": {"persistence": {"n": 744, "mae": "..."}, "sameHourD2": {"n": 744, "mae": "..."}},
  "skill": {"vsPersistence_pct": 55.0, "vsSameHourD2_pct": 70.0},
  "byHorizon": [{"bucket": "12-18h", "horizonFrom": 12, "horizonTo": 18, "n": 186, "mae": 700, "rmse": 900, "bias": 40}],
  "byHourOfDay": [{"hour": 0, "n": 31, "mae": 800, "bias": 20}],
  "byDay": [{"date": "2026-01-02", "mae": 650, "bias": -120, "forecastMWh": 280000, "actualMWh": 283000}],
  "histogram": [{"from": -3000, "to": -2500, "count": 4}],
  "series": [{"startTime": "...", "forecast": 12000, "actual": 11800, "error": 200, "horizonHours": 16.5}]
}
```
- metric objects always have the same keys as `forecast`; `nmae_pct = mae / mean_actual * 100`.
- `skill.vsX_pct = (1 - mae_forecast / mae_X) * 100`.
- `histogram`: 500 MW bins spanning the error range.
- `byHorizon` buckets are 6h wide (`0-6h` .. `42-48h`); hour of day is Europe/London.

## `GET /api/accuracy/lead-time?start=2026-01-02&end=2026-02-01`
Accuracy of **every** WINDFOR run (not only the decision-time one) by lead time, to show how much a later or earlier decision would change forecast quality.
```json
{"start": "...", "end": "...",
 "points": [{"leadHours": 0, "leadFrom": 0, "leadTo": 3, "n": 1800, "mae": 400, "rmse": 550, "bias": 10}]}
```
3h buckets from 0 to 72h. `leadHours` is the bucket start. Only runs with `startTime > publishTime`.

## Errors
- `400` for malformed `date`/`start`/`end`/`cutoff`, or `start > end`.
- `404` when the window has no comparable data.
