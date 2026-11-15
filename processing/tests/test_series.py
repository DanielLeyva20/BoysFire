import pandas as pd
import pytest

from boysfire.domain.catalogs import SourceGroup
from boysfire.harmonize.series import RegionSeries

SNPP, MODIS = int(SourceGroup.SNPP), int(SourceGroup.MODIS)
REGION = 1
SEPTEMBER_1, SEPTEMBER_2, SEPTEMBER_3 = pd.to_datetime(["2015-09-01", "2015-09-02", "2015-09-03"])


def _series() -> RegionSeries:
    detected = pd.DataFrame(
        {
            "activity_date": [SEPTEMBER_1, SEPTEMBER_2, SEPTEMBER_2],
            "region_id": REGION,
            "source_group_id": [MODIS, MODIS, SNPP],
            "detected_index": [10.0, 99.0, 50.0],
        }
    )
    background = pd.DataFrame({"source_group_id": [MODIS], "region_id": [REGION], "month_of_year": [9], "daily_rate": [4.0]})
    scale = pd.DataFrame(
        {"activity_date": [SEPTEMBER_1, SEPTEMBER_2, SEPTEMBER_3], "source_group_id": MODIS, "scale": [0.5, 1.0, 2.0]}
    )
    observation_days = pd.DataFrame(
        {"activity_date": [SEPTEMBER_1, SEPTEMBER_2, SEPTEMBER_3], "source_group_id": [MODIS, SNPP, MODIS]}
    )
    return RegionSeries(detected, background, scale, observation_days)


def test_group_index_is_detected_plus_scaled_background():
    days = pd.DatetimeIndex([SEPTEMBER_1, SEPTEMBER_2, SEPTEMBER_3])

    modis = _series().for_group(REGION, SourceGroup.MODIS, days)

    assert modis.tolist() == pytest.approx([10 + 4 * 0.5, 99 + 4 * 1.0, 0 + 4 * 2.0])


def test_official_series_takes_each_day_from_its_chosen_group():
    official = _series().official(REGION)

    assert official.index.tolist() == [SEPTEMBER_1, SEPTEMBER_2, SEPTEMBER_3]
    assert official.tolist() == pytest.approx([12.0, 50.0, 8.0])     # el día 2 manda la referencia, sin fondo
