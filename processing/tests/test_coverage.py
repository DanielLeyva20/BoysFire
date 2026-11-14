import pandas as pd

from boysfire.domain.catalogs import Satellite, SourceGroup
from boysfire.harmonize.coverage import group_available_days, observing_days, select_daily_source


def _days(*dates: str) -> pd.DatetimeIndex:
    return pd.DatetimeIndex(dates)


def test_short_silence_is_a_quiet_period_and_long_silence_is_an_outage():
    detections = _days("2024-01-01", "2024-01-03", "2024-01-08", "2024-01-09")

    observed = observing_days(detections, outage_min_days=3)

    assert pd.Timestamp("2024-01-02") in observed          # 1 día sin focos: no hubo fuego
    assert pd.Timestamp("2024-01-05") not in observed      # 4 días sin focos: el satélite no miraba
    assert len(observed) == 5


def test_group_needs_all_its_satellites():
    satellite_days = {
        Satellite.TERRA: pd.date_range("2024-01-01", "2024-01-10"),
        Satellite.AQUA: pd.date_range("2024-01-05", "2024-01-10"),
    }

    groups = group_available_days(satellite_days)

    assert groups[SourceGroup.MODIS][0] == pd.Timestamp("2024-01-05")
    assert groups[SourceGroup.TERRA][0] == pd.Timestamp("2024-01-01")
    assert SourceGroup.SNPP not in groups


def test_daily_source_follows_priority_and_skips_uncalibrated_groups():
    group_days = {
        SourceGroup.SNPP: _days("2024-01-03"),
        SourceGroup.NOAA20: _days("2024-01-02", "2024-01-03"),
        SourceGroup.MODIS: _days("2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"),
        SourceGroup.TERRA: _days("2024-01-05"),
    }
    usable = {SourceGroup.SNPP, SourceGroup.NOAA20, SourceGroup.MODIS}

    chosen = select_daily_source(group_days, usable).set_index("activity_date")["source_group_id"]

    assert chosen.to_dict() == {
        pd.Timestamp("2024-01-01"): SourceGroup.MODIS,
        pd.Timestamp("2024-01-02"): SourceGroup.NOAA20,
        pd.Timestamp("2024-01-03"): SourceGroup.SNPP,
        pd.Timestamp("2024-01-04"): SourceGroup.MODIS,
    }                                                       # el día 5 queda como hueco: TERRA no está calibrado
