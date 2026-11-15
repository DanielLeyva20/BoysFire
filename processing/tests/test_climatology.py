import numpy as np
import pandas as pd
import pytest

from boysfire.config import HarmonizationSettings
from boysfire.harmonize.climatology import full_years, leap_day_of_year, region_climatology

SETTINGS = HarmonizationSettings(climatology_window_days=7)


def test_day_of_year_is_stable_across_leap_and_common_years():
    dates = pd.DatetimeIndex(["2023-03-01", "2024-03-01", "2024-02-29", "2023-12-31"])

    assert leap_day_of_year(dates).tolist() == [61, 61, 60, 366]


def test_partial_years_are_left_out_of_the_baseline():
    dates = pd.date_range("2000-11-01", "2003-06-30")

    assert full_years(dates) == [2001, 2002]


def test_percentiles_match_numpy_and_ignore_missing_days():
    dates = pd.date_range("2010-01-01", "2014-12-31")
    values = np.random.default_rng(7).gamma(shape=0.5, scale=40.0, size=len(dates))
    daily = pd.Series(values, index=dates).drop(pd.date_range("2012-03-01", "2012-03-20"))   # un hueco

    climatology = region_climatology(daily, SETTINGS).set_index("day_of_year")

    day = leap_day_of_year(pd.DatetimeIndex(["2024-03-10"]))[0]
    window = [
        value
        for date, value in daily.items()
        if abs(int(leap_day_of_year(pd.DatetimeIndex([date]))[0]) - day) <= SETTINGS.climatology_window_days
    ]
    assert climatology.loc[day, "p90_index"] == pytest.approx(np.percentile(window, 90), abs=1e-3)
    assert climatology.loc[day, "mean_index"] == pytest.approx(np.mean(window), abs=1e-3)


def test_fire_season_gets_a_higher_threshold_than_the_wet_season():
    dates = pd.date_range("2010-01-01", "2019-12-31")
    seasonal = np.where(dates.month == 9, 1000.0, 10.0)
    daily = pd.Series(seasonal, index=dates)

    climatology = region_climatology(daily, SETTINGS).set_index("day_of_year")
    mid_september = leap_day_of_year(pd.DatetimeIndex(["2024-09-15"]))[0]
    mid_march = leap_day_of_year(pd.DatetimeIndex(["2024-03-15"]))[0]

    assert len(climatology) == 366
    assert climatology.loc[mid_september, "p90_index"] == 1000
    assert climatology.loc[mid_march, "p90_index"] == 10
    assert climatology.loc[mid_september, "critical_threshold"] > climatology.loc[mid_march, "critical_threshold"]
    assert climatology.loc[mid_march, "sample_years"] == 10
