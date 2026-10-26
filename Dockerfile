# One image: the React build is served by the FastAPI backend from STATIC_DIR.

FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STATIC_DIR=static \
    PORT=8000
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

RUN useradd --create-home --uid 10001 appuser
COPY backend/app ./app
COPY backend/scripts ./scripts
COPY backend/data/snapshot ./data/snapshot
COPY --from=frontend /frontend/dist ./static
USER appuser

EXPOSE 8000
# Local/compose health status (Heroku ignores HEALTHCHECK). Reads the same $PORT as CMD.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3   CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT','8000'), timeout=4).status == 200 else 1)"
# Heroku injects $PORT at runtime and terminates TLS in its router.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
