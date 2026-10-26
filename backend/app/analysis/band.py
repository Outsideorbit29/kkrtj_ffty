"""Empirical uncertainty band from past decision-time errors, without look-ahead."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.analysis.timeutil import HOUR


def error_quantiles_by_day(
    table: pd.DataFrame,
    window_days: int,
    min_samples: int,
    low: float = 0.1,
    high: float = 0.9,
) -> pd.DataFrame:
    """Per delivery day D: low/high quantiles of ``error`` over the trailing window.

    The window is delivery days [D - window_days, D - 1], restricted to hours whose actual was
    complete at D's decision time (hour end <= decisionTime). Without that restriction the
    afternoon of D-1, still in the future at a D-1 morning decision, would leak in.
    Returns deliveryDay, errorQLow, errorQHigh, bandN.
    """
    history = table.loc[table["error"].notna(), ["deliveryDay", "startTime", "error"]]
    hour_end = history["startTime"] + HOUR
    days = table.groupby("deliveryDay", sort=True)["decisionTime"].first()
    window = pd.Timedelta(days=window_days)

    rows = []
    # One iteration per delivery day (tens), each a vectorised mask over the history.
    for day, decision_time in days.items():
        mask = (
            (history["deliveryDay"] >= day - window)
            & (history["deliveryDay"] < day)
            & (hour_end <= decision_time)
        )
        errors = history.loc[mask, "error"].to_numpy(dtype=float)
        q_low, q_high = np.quantile(errors, [low, high]) if errors.size >= min_samples else (np.nan, np.nan)
        rows.append((day, q_low, q_high, errors.size))
    return pd.DataFrame(rows, columns=["deliveryDay", "errorQLow", "errorQHigh", "bandN"])


def add_uncertainty_band(table: pd.DataFrame, window_days: int, min_samples: int) -> pd.DataFrame:
    """Add ``p10``/``p90``: an 80% interval for the actual given the forecast.

    error = forecast - actual, so actual = forecast - error: the high error quantile gives the
    low end of the interval. Floored at 0 MW.
    """
    quantiles = error_quantiles_by_day(table, window_days, min_samples)
    out = table.merge(quantiles, on="deliveryDay", how="left")
    out["p10"] = (out["forecast"] - out["errorQHigh"]).clip(lower=0)
    out["p90"] = (out["forecast"] - out["errorQLow"]).clip(lower=0)
    return out
