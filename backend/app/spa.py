"""Serve the built React app from the same origin as the API (optional)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response


class ImmutableStaticFiles(StaticFiles):
    """Long-lived caching for /assets. Safe only because Vite content-hashes these file names."""

    def file_response(self, *args: Any, **kwargs: Any) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_spa(app: FastAPI, static_dir: Path) -> bool:
    """Mount /assets and a catch-all GET returning index.html. Register after the API routes.

    Returns False (and does nothing) when ``static_dir`` has no index.html.
    """
    root = static_dir.resolve()
    index = root / "index.html"
    if not index.is_file():
        return False

    if (root / "assets").is_dir():
        app.mount("/assets", ImmutableStaticFiles(directory=root / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (root / path).resolve()
        # Top-level files such as favicon.ico; anything else is a client-side route.
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        # Revalidate on every load (ETag keeps it cheap) so a redeploy never leaves a stale index
        # pointing at hashed /assets that no longer exist.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return True
