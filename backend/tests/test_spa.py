from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

INDEX_HTML = "<!doctype html><title>app</title>"


@pytest.fixture
def spa_client(settings, tmp_path_factory):
    site = tmp_path_factory.mktemp("site")
    # A file just outside the static root that traversal must never reach.
    (site / "secret.txt").write_text("SECRET")
    tmp_path = site / "static"
    tmp_path.mkdir()
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text(INDEX_HTML)
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    with TestClient(create_app(replace(settings, static_dir=tmp_path))) as client:
        yield client


@pytest.mark.parametrize("path", ["/", "/decision/2026-01-15", "/accuracy?cutoff=11:00"])
def test_client_routes_get_index(spa_client, path):
    response = spa_client.get(path)
    assert response.status_code == 200
    assert "<title>app</title>" in response.text
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize(
    "path",
    [
        "/../app/main.py",
        "/%2e%2e/%2e%2e/app/config.py",
        "/assets/..%2f..%2fREADME.md",
        "/..%5c..%5cpyproject.toml",
        "/%2e%2e%2fsecret.txt",
        "/..%5csecret.txt",
        "/favicon.svg%00.txt",
    ],
)
def test_path_traversal_never_serves_files_outside_static(spa_client, path):
    response = spa_client.get(path)
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.text == INDEX_HTML


def test_static_files_are_served(spa_client):
    asset = spa_client.get("/assets/app.js")
    assert asset.text == "console.log(1)"
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert spa_client.get("/favicon.svg").text == "<svg/>"
    assert spa_client.get("/assets/missing.js").status_code == 404


def test_api_is_not_shadowed(spa_client):
    assert spa_client.get("/api/health").json() == {"status": "ok"}
    response = spa_client.get("/api/unknown")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_without_static_dir_root_is_404(client):
    assert client.get("/").status_code == 404
