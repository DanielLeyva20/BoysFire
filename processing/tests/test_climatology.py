import numpy as np
import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.harmonize.climatology import full_years, leap_day_of_year, region_climatology

SETTINGS = HarmonizationSettings(climatology_window_days=7)


def test_day_of_year_is_stable_across_leap_and_common_years():
    dates = pd.DatetimeIndex(["2023-03-01", "2024-03-01", "2024-02-29", "2023-12-31"])

    assert leap_day_of_year(dates).tolist() == [61, 61, 60, 366]


def test_partial_years_are_left_out_of_the_baseline():
    dates = pd.date_range("2000-11-01", "2003-06-30")

    assert full_years(dates) == [2001, 2002]


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
