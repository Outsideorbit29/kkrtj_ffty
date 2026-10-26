from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import config
from app.data import Dataset, read_snapshot
from app.main import create_app


def utc(*values: str) -> pd.Series:
    return pd.Series(pd.to_datetime(list(values), utc=True))


@pytest.fixture(scope="session")
def settings(tmp_path_factory: pytest.TempPathFactory) -> config.Settings:
    # API tests run without a built frontend, whatever is in backend/static locally.
    no_static = tmp_path_factory.mktemp("no-static")
    return replace(config.Settings.from_env(), static_dir=no_static)


@pytest.fixture(scope="session")
def dataset(settings: config.Settings) -> Dataset:
    return read_snapshot(settings.snapshot_dir)


@pytest.fixture(scope="session")
def client(settings: config.Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
