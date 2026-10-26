import math

import numpy as np
import pandas as pd
import pytest

from app.analysis.metrics import METRIC_KEYS, error_metrics, grouped_metrics, histogram, skill_pct


def test_error_metrics_values_and_sign():
    forecast = pd.Series([110.0, 180.0, np.nan, 300.0])
    actual = pd.Series([100.0, 200.0, 50.0, np.nan])
    m = error_metrics(forecast, actual)
    assert tuple(m) == METRIC_KEYS
    assert m["n"] == 2
    assert m["mae"] == 15.0
    assert m["bias"] == -5.0  # (+10 - 20) / 2: negative = under-forecast
    assert m["rmse"] == pytest.approx(math.sqrt((100 + 400) / 2))
    assert m["mean_actual"] == 150.0
    assert m["nmae_pct"] == pytest.approx(10.0)
    assert m["max_abs_error"] == 20.0
    assert m["p50_error"] == pytest.approx(-5.0)


def test_error_metrics_without_data_keeps_keys():
    m = error_metrics(pd.Series([np.nan]), pd.Series([1.0]))
    assert tuple(m) == METRIC_KEYS
    assert m["n"] == 0
    assert all(v is None for k, v in m.items() if k != "n")


def test_skill():
    assert skill_pct(50.0, 200.0) == 75.0
    assert skill_pct(200.0, 100.0) == -100.0
    assert skill_pct(None, 100.0) is None
    assert skill_pct(10.0, 0.0) is None


def test_histogram_bins_cover_range_and_count_everything():
    errors = pd.Series([-1200.0, -1.0, 0.0, 499.9, 500.0, 2000.0])
    h = histogram(errors, 500)
    assert (h["from"].iloc[0], h["to"].iloc[-1]) == (-1500, 2500)
    assert (h["to"] - h["from"] == 500).all()
    assert h["count"].sum() == len(errors)
    assert h.set_index("from").loc[0, "count"] == 2  # [0, 500)


def test_grouped_metrics():
    frame = pd.DataFrame({"g": ["a", "a", "b"], "error": [10.0, -30.0, 5.0]})
    out = grouped_metrics(frame, "g")
    assert out.loc["a"].tolist() == [2, 20.0, pytest.approx(math.sqrt(500)), -10.0]
    assert out.loc["b", "n"] == 1
