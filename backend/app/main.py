"""FastAPI application factory and ASGI entry point (uvicorn app.main:app)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import time

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.api.routes import router
from app.data import load_dataset
from app.reports import NoDataError
from app.reports.tables import decision_table
from app.spa import mount_spa


def create_app(settings: config.Settings | None = None) -> FastAPI:
    settings = settings or config.Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.dataset = load_dataset(settings)
        hh, mm = map(int, config.DEFAULT_CUTOFF.split(":"))
        decision_table(app.state.dataset, time(hh, mm))  # warm the cache for the default view
        yield

    app = FastAPI(title="Wind Forecast Decision API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

    @app.exception_handler(RequestValidationError)
    async def bad_request(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": jsonable_encoder(exc.errors())})

    @app.exception_handler(NoDataError)
    async def not_found(_: Request, exc: NoDataError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    app.include_router(router)
    mount_spa(app, settings.static_dir)
    return app


app = create_app()
