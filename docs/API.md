# API contract

All endpoints are `GET` and return JSON. Timestamps are ISO-8601 UTC strings ending in `Z`.
Dates (`date`, `start`, `end`) are Europe/London calendar dates `YYYY-MM-DD` and refer to the
**delivery day**. Power values are MW, energy values are MWh.

## Domain rules (single source of truth)

| Rule | Value |
|---|---|
| Scope | Purchase decisions made on 2026-01-01 .. 2026-01-31, so delivery days D = 2026-01-02 .. 2026-02-01 |
| Decision time | D-1 at `cutoff` Europe/London. Default `09:20` (GB day-ahead hourly auction gate closure). Query param `cutoff=HH:MM` overrides it. |
| Forecast used | For each target hour, the WINDFOR value from the latest run with `publishTime < decision time` (a run published at the gate-closure instant is too late to use; e.g. at the 15:30 cutoff in GMT the 15:30 UTC run is excluded and the 11:30 run is used) |
| Forecast resolution | WINDFOR is hourly; nominal runs at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC (about 73 hourly points). Occasionally a run is published late (snapshot: 2025-11-27 12:48, 2026-01-15 12:25 instead of 11:30). Selection uses the actual publishTime, so the 12:25 run is the decision run (for D = 2026-01-16) for cutoffs after 12:25 up to and including 15:30 on 2026-01-15. |
| Actual resolution | FUELHH WIND is half-hourly. Hourly actual for hour H = mean of the periods starting H:00 and H:30 (both required). This is the average MW over the hour, matching hourly day-ahead products. |
| Error sign | `error = forecast - actual`. Positive = wind over-forecast = shortfall risk (must buy more). |
| Horizon | `horizonHours = (startTime - publishTime)` in hours, for the forecast used |
| Baselines | `persistence`: last half-hourly actual known at decision time (period end < decision time: a period is published at its end, so one ending at the cutoff is not yet known), held flat. `sameHourD2`: hourly actual of the same hour two days earlier (fully known at decision time). |
| Uncertainty band | Empirical quantiles of decision-time forecast errors for delivery days **strictly before D**, trailing 28 days, restricted to hours that ended strictly before D's decision time (December 2025 history is in the snapshot for this). `p10 = max(0, forecast - q90(error))`, `p90 = max(0, forecast - q10(error))`. Gives an 80% interval for the actual. Needs at least 168 past errors, otherwise `p10`/`p50`/`p90` are `null`. |
| Bias-adjusted P50 | `p50 = max(0, forecast - q50(error))`: the raw forecast minus its trailing median error, same trailing window and no look-ahead. The bias-adjusted central estimate to size purchases against (the raw forecast has run persistently high). |

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
- `forecastRunTimesUtc` is the nominal WINDFOR schedule, not a list of every publish time in the data.

## `GET /api/decision?date=2026-01-15&cutoff=09:20`
`date` = delivery day D (decision is made on D-1). It is **required** (400 if missing).
Values below are the real response for this request (first row of each list shown).
```json
{
  "deliveryDate": "2026-01-15", "decisionDate": "2026-01-14",
  "cutoff": "09:20", "decisionTimeUtc": "2026-01-14T09:20:00Z",
  "forecastPublishTimeUtc": "2026-01-14T07:30:00Z", "forecastAgeMinutes": 110,
  "bandMethod": "Empirical 10-90% error quantiles, 28 delivery days before D (n=657)",
  "hourly": [
    {"startTime": "2026-01-15T00:00:00Z", "forecast": 15834.0, "p50": 14983.5, "p10": 11637.9, "p90": 17201.1,
     "actual": 14456.5, "error": 1377.5, "horizonHours": 16.5}
  ],
  "actualHalfHourly": [{"startTime": "2026-01-15T00:00:00Z", "generation": 14602.0}],
  "summary": {
    "forecastMWh": 278630.0, "p50MWh": 258218.0, "actualMWh": 253626.0, "errorMWh": 25004.0,
    "minForecast": {"startTime": "2026-01-15T16:00:00Z", "mw": 8864.0},
    "maxForecast": {"startTime": "2026-01-15T00:00:00Z", "mw": 15834.0},
    "shortfallP90MWh": 100706.4,
    "mae": 1041.8, "bias": 1041.8,
    "trailingMedianError": 850.5
  },
  "runs": [
    {"publishTimeUtc": "2026-01-13T02:30:00Z", "availableAtDecision": true, "isDecisionRun": false,
     "points": [{"startTime": "2026-01-15T00:00:00Z", "forecast": 13924.0}]}
  ]
}
```
- `hourly`: 24 rows for D (23/25 on clock-change days; not relevant in January). `actual`, `error` are `null` when unknown.
  Hours the decision run does not cover (cutoffs before 02:30 London use the D-2 22:30 UTC run, which ends at
  D 21:00 UTC, so 23:00 and later are uncovered) have `forecast`, `p50`, `p10`, `p90`, `error`, `horizonHours` = `null`.
- `bandMethod` names the window and its sample count `n` = past hourly errors in the trailing window that were
  known strictly before D's decision time (657 at 09:20: 27 full days + the 9 hours of D-1 that ended by 09:00;
  594 at 01:00). When `n < 168` it reads `"Unavailable: fewer than 168 past errors ... (n=...)"` and
  `p10`/`p50`/`p90` are `null` on every row (e.g. D = 2025-11-28, the first day of the snapshot).
- `summary` nullability:
  - `forecastMWh` sums the covered hours only (a partial total at early cutoffs).
  - `actualMWh`, `errorMWh`: `null` unless **every** hour of D has both a forecast and an actual.
  - `mae`, `bias`: over whichever hours have both; `null` when there are none.
  - `p50MWh` (sum of hourly `p50`, bias-adjusted day energy), `shortfallP90MWh` and `trailingMedianError`: `null`
    when the band is unavailable.
- `trailingMedianError` = the median past error subtracted to get `p50` (MW, positive = the raw forecast has been
  running high).
- `shortfallP90MWh` = sum over hours of `forecast - p10` (wind energy that may be missing in a 1-in-10 case).
- `minForecast` / `maxForecast`: the lowest / highest hourly decision-time forecast of D.
- `runs`: every WINDFOR run published between D-2 00:00 and D 00:00 (London) that covers D, oldest first
  (16 runs for D = 2026-01-15). `availableAtDecision` = `publishTime < decision time`; later runs (and one
  published at the decision instant) have `availableAtDecision: false` (shows how the forecast moved after the
  purchase). Exactly one run has `isDecisionRun: true`.
- 404 with `{"detail": "..."}` if D is outside the data range (2025-11-28 .. 2026-02-01 for the snapshot) or no
  forecast exists before the decision time.

## `GET /api/accuracy?start=2026-01-02&end=2026-02-01&cutoff=09:20`
Defaults: `start` = 2026-01-02, `end` = 2026-02-01, `cutoff` = 09:20 (the full scope window). The window is
clamped to the days the dataset can answer (2025-11-28 .. 2026-02-01 for the snapshot); the response echoes the
clamped `start`/`end`. Metrics use hours where both forecast and actual exist. Values below are the real
response for the default request (first row of each list shown).
```json
{
  "start": "2026-01-02", "end": "2026-02-01", "cutoff": "09:20",
  "forecast": {"n": 744, "mae": 2038.9, "rmse": 2504.8, "bias": 1747.9, "nmae_pct": 18.1, "p10_error": -549.3, "p50_error": 1592.0, "p90_error": 4097.9, "p90_abs_error": 4097.9, "max_abs_error": 6870.0, "mean_actual": 11283.6},
  "forecastAdjusted": {"n": 744, "mae": 1445.8, "rmse": 1909.0, "bias": 649.3, "nmae_pct": 12.8, "...": "same keys as forecast"},
  "baselines": {"persistence": {"n": 744, "mae": 4110.6, "...": "same keys"}, "sameHourD2": {"n": 744, "mae": 4340.3, "...": "same keys"}},
  "skill": {"vsPersistence_pct": 50.4, "vsSameHourD2_pct": 53.0, "adjustedVsForecast_pct": 29.1, "adjustedVsPersistence_pct": 64.8},
  "byHorizon": [{"bucket": "12-18h", "horizonFrom": 12, "horizonTo": 18, "n": 62, "mae": 2098.4, "rmse": 2599.8, "bias": 2043.0}],
  "byForecastLevel": [{"bucket": "8-12 GW", "from": 8000, "to": 12000, "n": 201, "mae": 1754.8, "bias": 1467.7, "overForecastShare": 0.851}],
  "byHourOfDay": [{"hour": 0, "n": 31, "mae": 2027.8, "bias": 1952.7}],
  "byDay": [{"date": "2026-01-02", "mae": 3109.9, "bias": 3109.9, "forecastMWh": 438696.0, "actualMWh": 364058.0}],
  "histogram": [{"from": -4000, "to": -3500, "count": 1}],
  "series": [{"startTime": "2026-01-02T00:00:00Z", "forecast": 18781.0, "actual": 15366.5, "error": 3414.5, "horizonHours": 16.5}]
}
```
- Metric objects (`forecast`, `forecastAdjusted`, each baseline) always have the same 11 keys;
  `nmae_pct = mae / mean_actual * 100`. With `n = 0` every other key is `null`.
- `skill.vsX_pct = (1 - mae_forecast / mae_X) * 100`, with both MAEs over the hours where the baseline exists.
  Any skill value is `null` when either MAE is missing or the baseline MAE is 0.
- `forecastAdjusted`: the same metrics for the bias-adjusted `p50` (hours where `p50` exists). It is not a naive
  baseline, so it is not in `baselines`. `skill.adjustedVsForecast_pct = (1 - mae_p50 / mae_forecast) * 100` and
  `skill.adjustedVsPersistence_pct = (1 - mae_p50 / mae_persistence) * 100`, each over the hours where both exist.
- Bucket rules (all buckets are `[from, to)`, left edge = `floor(value / width) * width`, and only non-empty
  buckets are listed, in ascending order):
  - `byHorizon`: 6 h buckets of the decision-run horizon (`"12-18h"`). At a fixed cutoff every day uses the
    same run, so this is hour of day relabelled (at 09:20, 12-18h is only 00:00-01:00 of D, n = 62). Use
    `/api/accuracy/lead-time` for how error changes with lead time.
  - `byForecastLevel`: 4 GW buckets of the **decision-time forecast** (never the actual, which is unknown when
    buying), `from`/`to` in MW, label in GW. `overForecastShare` = fraction (0..1, 3 decimals) of hours with
    `error > 0`.
  - `histogram`: 500 MW bins aligned to multiples of 500, spanning the error range.
- `byHourOfDay`: hour of day in Europe/London (0-23).
- `byDay`: one row per delivery day with comparable hours; `forecastMWh`/`actualMWh` are summed over those hours.
- `series`: every hour in the window that has a decision-time forecast; `actual`/`error` are `null` where the
  outturn is missing.
- There is no band-coverage field: the P10-P90 backtest (85.2% inside at 09:20) is computed from the decision
  table offline and pinned in `backend/tests/test_band.py`.

## `GET /api/accuracy/lead-time?start=2026-01-02&end=2026-02-01`
Accuracy of **every** WINDFOR run (not only the decision-time one) by lead time, to show how much a later or earlier decision would change forecast quality.
Defaults and clamping as for `/api/accuracy`; there is no `cutoff` (every run is scored).
```json
{"start": "2026-01-02", "end": "2026-02-01",
 "points": [{"leadHours": 0, "leadFrom": 0, "leadTo": 3, "n": 722, "mae": 1696.0, "rmse": 2151.1, "bias": 1464.0}]}
```
- 3 h buckets `[leadFrom, leadTo)` over `0 < lead < 72` h, where `lead = startTime - publishTime`. `leadHours`
  is the bucket start. Only non-empty buckets are listed (23 for the default window: the longest WINDFOR runs
  end just under 69 h ahead).
- Each (run, hour) pair with an hourly actual counts once, so `n` differs between buckets.
- The snapshot's last run is 2026-01-31 22:30 UTC, so the later hours of 2026-02-01 have no short-lead points.

## Errors
Every error body is `{"detail": ...}`.
- `400` for malformed `date`/`start`/`end`/`cutoff` (`detail` is a message string, e.g.
  `"'cutoff' must be HH:MM (24h), got '9:20'"`), or `start > end`.
- `400` when a required parameter is missing (`date` on `/api/decision`); here `detail` is FastAPI's list of
  validation errors, e.g. `[{"type": "missing", "loc": ["query", "date"], "msg": "Field required", ...}]`.
- `404` when the day or window has no comparable data (`detail` is a message string).
- `404` for unknown `/api/...` paths (the SPA fallback never answers under `/api`).
