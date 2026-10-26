from datetime import UTC, date, datetime

import pandas as pd

from app import config
from app.data import read_snapshot, write_snapshot
from app.elexon import _date_chunks, _datetime_chunks


def test_snapshot_round_trip(dataset, tmp_path):
    manifest = write_snapshot(tmp_path, dataset.actuals, dataset.forecasts)
    reloaded = read_snapshot(tmp_path)
    assert manifest["actuals"]["rows"] == len(reloaded.actuals) == len(dataset.actuals)
    pd.testing.assert_frame_equal(reloaded.forecasts, dataset.forecasts)
    assert (reloaded.first_day, reloaded.last_day) == (dataset.first_day, dataset.last_day)


def test_snapshot_covers_scope_and_band_history(dataset):
    assert dataset.first_day <= config.DELIVERY_START - pd.Timedelta(days=config.BAND_WINDOW_DAYS)
    assert dataset.last_day >= config.DELIVERY_END
    assert dataset.actuals["startTime"].is_unique
    assert (dataset.forecasts["startTime"] > dataset.forecasts["publishTime"]).all()
    assert dataset.actuals["generation"].between(0, 30_000).all()


def test_request_chunks_split_at_month_boundaries():
    assert list(_date_chunks(date(2025, 11, 28), date(2026, 1, 2))) == [
        (date(2025, 11, 28), date(2025, 11, 30)),
        (date(2025, 12, 1), date(2025, 12, 31)),
        (date(2026, 1, 1), date(2026, 1, 2)),
    ]
    chunks = list(_datetime_chunks(datetime(2025, 12, 30, tzinfo=UTC), datetime(2026, 2, 1, tzinfo=UTC)))
    assert chunks == [
        (datetime(2025, 12, 30, tzinfo=UTC), datetime(2026, 1, 1, tzinfo=UTC)),
        (datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 2, 1, tzinfo=UTC)),
    ]
