"""Serve the built React app from the same origin as the API (optional)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_spa(app: FastAPI, static_dir: Path) -> bool:
    """Mount /assets and a catch-all GET returning index.html. Register after the API routes.

    Returns False (and does nothing) when ``static_dir`` has no index.html.
    """
    root = static_dir.resolve()
    index = root / "index.html"
    if not index.is_file():
        return False

    if (root / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (root / path).resolve()
        # Top-level files such as favicon.ico; anything else is a client-side route.
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(index)

    return True
