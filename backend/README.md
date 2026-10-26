# Backend (FastAPI)

Serves the API in [`docs/API.md`](../docs/API.md) from an in-memory copy of Elexon FUELHH (WIND actuals)
and WINDFOR (wind forecasts). Optionally serves the built frontend from the same origin.

## Run

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:app --reload     # http://localhost:8000/docs
```

Refresh the committed snapshot (about 10 s, roughly 3k actual and 30k forecast rows):

```bash
python -m scripts.fetch_data      # writes data/snapshot/{actuals,forecasts}.csv.gz + manifest.json
```

Docker: the root `Dockerfile` builds one image with the API and the frontend (copied to `static/`).

## Configuration

| Env var | Default | |
|---|---|---|
| `DATA_SOURCE` | `snapshot` | `live` fetches the same ranges from Elexon at startup instead |
| `SNAPSHOT_DIR` | `data/snapshot` | relative paths resolve against `backend/` |
| `STATIC_DIR` | `static` | if it has `index.html`: serves `/assets` and returns `index.html` for non-`/api` GETs |
| `ELEXON_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1/datasets` | |
| `PORT` | `8000` | Docker/Heroku only |

## Layout

```
app/
  config.py        domain constants (scope, cutoffs, band settings) + env settings
  elexon.py        the only module that calls Elexon; cleaning of raw rows
  data.py          Dataset (loaded once at startup), snapshot read/write
  analysis/        pure, vectorised functions over DataFrames
    timeutil.py    London delivery days/hours, decision times (DST-safe)
    actuals.py     half-hourly -> hourly mean (both halves required)
    selection.py   latest run at or before decision time (merge_asof by startTime)
    baselines.py   persistence, sameHourD2
    band.py        trailing empirical error quantiles, no look-ahead
    metrics.py     error metrics, grouped metrics, histogram
    leadtime.py    every run's error by lead time
    table.py       composes the per-hour decision table
  reports/         JSON responses per endpoint; tables cached per (dataset, cutoff)
  api/             routes and query-parameter validation (400s)
  spa.py           optional static frontend
scripts/fetch_data.py
tests/             unit tests + API tests against the snapshot
```

## Data handling notes

- FUELHH revisions: the row with the latest `publishTime` per `startTime` is kept.
- WINDFOR runs also carry points before their own publish time; only `startTime > publishTime` is kept.
- The snapshot spans delivery days 2025-11-28..2026-02-01, so the 28-day band for 2026-01-02 has full history.
  Requests outside that range are clamped (`/api/accuracy*`) or 404 (`/api/decision`).
- Uncertainty band for D: errors of delivery days D-28..D-1, but only hours whose actual was complete at
  D's decision time. The rest of D-1 is still in the future at a D-1 morning decision, so it is left out
  (n = 657 rather than 672 at the 09:20 cutoff).
- `byHorizon` and lead-time `points` list non-empty buckets only.
