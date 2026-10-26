from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def spa_client(settings, tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>app</title>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    with TestClient(create_app(replace(settings, static_dir=tmp_path))) as client:
        yield client


@pytest.mark.parametrize("path", ["/", "/decision/2026-01-15", "/accuracy?cutoff=11:00"])
def test_client_routes_get_index(spa_client, path):
    response = spa_client.get(path)
    assert response.status_code == 200
    assert "<title>app</title>" in response.text


def test_static_files_are_served(spa_client):
    assert spa_client.get("/assets/app.js").text == "console.log(1)"
    assert spa_client.get("/favicon.svg").text == "<svg/>"
    assert spa_client.get("/assets/missing.js").status_code == 404


def test_api_is_not_shadowed(spa_client):
    assert spa_client.get("/api/health").json() == {"status": "ok"}
    response = spa_client.get("/api/unknown")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_without_static_dir_root_is_404(client):
    assert client.get("/").status_code == 404
