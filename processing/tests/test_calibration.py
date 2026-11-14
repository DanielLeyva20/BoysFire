import pandas as pd
import pytest

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import ConfidenceLevel, Satellite, SourceGroup
from boysfire.harmonize import aggregation, calibration, loci

SNPP, MODIS = int(SourceGroup.SNPP), int(SourceGroup.MODIS)


def _loci(group: int, day: str, cells: range, calibration_cell: int = 9) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "source_group_id": group,
            "activity_date": pd.Timestamp(day),
            "h3_cell": list(cells),
            "map_cell": 90,
            "calibration_cell": calibration_cell,
        }
    )


def test_many_hotspots_in_one_cell_and_day_count_once():
    hotspots = pd.DataFrame(
        {
            "satellite_id": [int(Satellite.SNPP)] * 4,
            "confidence_level_id": [ConfidenceLevel.HIGH, ConfidenceLevel.NOMINAL, ConfidenceLevel.HIGH, ConfidenceLevel.LOW],
            "activity_date": pd.Timestamp("2024-09-15"),
            "h3_cell": [1, 1, 2, 3],          # dos focos en la celda 1; el de la celda 3 es de confianza baja
            "map_cell": 90,
            "calibration_cell": 9,
        }
    )
    group_days = {SourceGroup.SNPP: pd.DatetimeIndex(["2024-09-15"])}

    result = loci.build_loci(hotspots, group_days, HarmonizationSettings())

    assert sorted(result["h3_cell"]) == [1, 2]


def test_factor_is_reference_over_source_when_there_is_plenty_of_data():
    days = pd.date_range("2015-09-01", periods=30)
    frames = []
    for day in days:
        frames.append(_loci(SNPP, day, range(40)))    # la referencia ve 40 celdas al día
        frames.append(_loci(MODIS, day, range(10)))   # MODIS ve 10 → factor esperado 4
    all_loci = pd.concat(frames, ignore_index=True)
    group_days = {SourceGroup.SNPP: days, SourceGroup.MODIS: days}

    baseline, factors = calibration.calibrate(all_loci, group_days, HarmonizationSettings())

    september = factors.loc[factors["month_of_year"] == 9, "ratio"].iloc[0]
    assert september == pytest.approx(4.0, rel=0.01)
    assert calibration.calibrated_groups(baseline) == {SourceGroup.SNPP, SourceGroup.MODIS}


def test_cell_with_little_data_falls_back_to_the_national_factor():
    days = pd.date_range("2015-09-01", periods=30)
    frames = []
    for day in days:
        frames.append(_loci(SNPP, day, range(40), calibration_cell=9))
        frames.append(_loci(MODIS, day, range(10), calibration_cell=9))
    # Celda 7: MODIS vio un solo fuego y la referencia veinte. Sin contracción el factor sería 20.
    frames.append(_loci(MODIS, "2015-09-10", range(100, 101), calibration_cell=7))
    frames.append(_loci(SNPP, "2015-09-10", range(100, 120), calibration_cell=7))
    all_loci = pd.concat(frames, ignore_index=True)
    group_days = {SourceGroup.SNPP: days, SourceGroup.MODIS: days}

    _, factors = calibration.calibrate(all_loci, group_days, HarmonizationSettings())

    sparse = factors.loc[factors["h3_cell"] == 7, "ratio"].iloc[0]
    assert 4.0 < sparse < 5.0


def test_group_without_common_period_is_not_calibrated():
    all_loci = pd.concat([_loci(MODIS, "2005-09-01", range(10)), _loci(SNPP, "2015-09-01", range(40))])
    group_days = {
        SourceGroup.MODIS: pd.DatetimeIndex(["2005-09-01"]),
        SourceGroup.SNPP: pd.DatetimeIndex(["2015-09-01"]),
    }

    baseline, _ = calibration.calibrate(all_loci, group_days, HarmonizationSettings())

    assert calibration.calibrated_groups(baseline) == {SourceGroup.SNPP}


def test_harmonized_index_is_loci_times_factor_and_reference_counts_as_one():
    all_loci = pd.concat([_loci(SNPP, "2015-09-01", range(40)), _loci(MODIS, "2005-09-01", range(10))])
    factors = pd.DataFrame(
        {"source_group_id": [MODIS], "h3_cell": [9], "month_of_year": [9], "ratio": [4.0]}
    )

    with_ratio = aggregation.attach_ratio(all_loci, factors)
    daily = aggregation.harmonized_by(with_ratio, "map_cell", "h3_cell").set_index("source_group_id")

    assert daily.loc[SNPP, "harmonized_index"] == 40
    assert daily.loc[MODIS, "active_loci"] == 10
    assert daily.loc[MODIS, "harmonized_index"] == 40     # 10 celdas × 4 = lo mismo que vería VIIRS
