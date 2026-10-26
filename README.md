# Wind Forecast Accuracy Portal (WIP)

Web app for a UK energy utility's day-ahead purchasing team. It shows which wind generation forecast was the latest available at the decision time, and quantifies how accurate those forecasts are. Data is national wind generation from Elexon only (FUELHH actuals, WINDFOR forecasts), for January 2026 delivery.

## Layout

- `backend/` - FastAPI service
  - `app/config.py` - settings (env-overridable: cutoff time, timezone, cache dir)
  - `app/elexon.py` - Elexon API client with on-disk caching; normalises actuals and forecasts
  - `app/forecast.py` - decision-cutoff logic, latest-forecast selection, error metrics
  - `app/main.py` - API routes (`/health`, `/api/forecasts/latest`, `/api/accuracy`)
  - `tests/` - unit tests for cutoff logic and metrics
  - `Dockerfile`, `requirements.txt`
- `frontend/` - React app (not started)
- `docker-compose.yml` - runs the backend locally

## Run locally

Backend without Docker:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

With Docker:

```bash
docker compose up --build
```

Then open http://localhost:8000/docs.

Example: `GET /api/accuracy?start=2026-01-01&end=2026-01-31`

## Deployment

TBD (Heroku or Render for the backend, Vercel for the frontend).

## AI tool disclosure

Parts of this project were drafted with AI assistance (Claude). All code should be reviewed and tested by the author.

## Open questions

- Decision cutoff: assumed 11:00 Europe/London on D-1. Confirm the exact gate-closure time with the product owner.
- Elexon query parameter names for WINDFOR and FUELHH must be checked against the API docs; `app/main.py` has a TODO.
- Baseline: "same half-hour, one day earlier" is used as the naive benchmark. Confirm this is acceptable.
