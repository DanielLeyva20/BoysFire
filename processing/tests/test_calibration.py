import numpy as np
import pandas as pd
import pytest

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import ConfidenceLevel, Satellite, SourceGroup
from boysfire.harmonize import aggregation, calibration, loci
from boysfire.harmonize.calibration import Calibration

SNPP, MODIS = int(SourceGroup.SNPP), int(SourceGroup.MODIS)
SETTINGS = HarmonizationSettings()


def _loci(group: int, day, cells: range, calibration_cell: int = 9) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "source_group_id": group,
            "activity_date": pd.Timestamp(day),
            "h3_cell": list(cells),
            "map_cell": 90,
            "calibration_cell": calibration_cell,
        }
    )


def _calibration(response=None, factors=None) -> Calibration:
    return Calibration(
        response=response if response is not None else pd.DataFrame(columns=calibration.RESPONSE_COLUMNS),
        factors=factors if factors is not None else pd.DataFrame(columns=calibration.FACTOR_COLUMNS),
        background_rates=pd.DataFrame(columns=calibration.BACKGROUND_COLUMNS),
        background_scale=pd.DataFrame(columns=calibration.SCALE_COLUMNS),
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

    result = loci.build_loci(hotspots, group_days, SETTINGS)

    assert sorted(result["h3_cell"]) == [1, 2]


def test_response_fit_recovers_a_power_law():
    n = pd.Series(np.repeat([1, 2, 4, 8, 16], 20))
    excess = 3.0 * n**0.8

    coefficient, exponent = calibration.fit_response(n, excess)

    assert coefficient == pytest.approx(3.0, rel=1e-6)
    assert exponent == pytest.approx(0.8, rel=1e-6)


def test_response_needs_two_intensities_with_positive_excess():
    assert calibration.fit_response(pd.Series([1, 1, 1]), pd.Series([2.0, 2.0, 2.0])) is None
    assert calibration.fit_response(pd.Series([1, 2]), pd.Series([-1.0, -2.0])) is None


def test_daily_scale_follows_activity_and_averages_one_within_each_month():
    days = pd.date_range("2015-09-01", "2015-09-30")
    quiet, busy = days[:20], days[20:]
    group_loci = pd.concat([_loci(MODIS, day, range(2)) for day in quiet] + [_loci(MODIS, day, range(20)) for day in busy])

    scale = calibration.daily_scale(group_loci, days, overlap=days, exponent=0.75)

    assert scale.mean() == pytest.approx(1.0)
    assert scale[busy].iloc[0] > 1 > scale[quiet].iloc[0]


def test_daily_scale_is_zero_on_a_day_without_any_detection():
    days = pd.date_range("2015-09-01", "2015-09-10")
    group_loci = pd.concat([_loci(MODIS, day, range(5)) for day in days[1:]])

    scale = calibration.daily_scale(group_loci, days, overlap=days, exponent=0.75)

    assert scale[days[0]] == 0


def test_background_spreads_unseen_reference_fire_over_the_quiet_days():
    days = pd.date_range("2015-09-01", "2015-09-10")
    # El grupo detecta algo en la celda de calibración solo 2 de los 10 días.
    active = pd.DataFrame({"activity_date": days[:2], "calibration_cell": 9, "month_of_year": 9, "scale": 1.0, "n": 1})
    # En los otros 8 días la referencia ve 16 celdas activas, siempre en la celda locus 500.
    reference = pd.concat([_loci(SNPP, day, [500, 501]) for day in days[2:]]).assign(month_of_year=9)
    reference["h3_cell"] = 500

    rates = calibration.background_rates(reference, active, overlap_scale=pd.Series(1.0, index=days))

    assert len(rates) == 1
    assert rates["daily_rate"].iloc[0] == pytest.approx(16 / 8)


def test_calibrate_fits_response_and_group_becomes_usable():
    days = pd.date_range("2015-09-01", periods=30)
    frames = []
    for position, day in enumerate(days):
        n = 1 + position % 5                              # intensidades 1…5
        frames.append(_loci(MODIS, day, range(n)))
        frames.append(_loci(SNPP, day, range(3 * n)))     # la referencia ve el triple
    group_days = {SourceGroup.SNPP: days, SourceGroup.MODIS: days}

    result = calibration.calibrate(pd.concat(frames, ignore_index=True), group_days, SETTINGS)

    response = result.response.iloc[0]
    assert result.groups == {SourceGroup.SNPP, SourceGroup.MODIS}
    assert response["coefficient"] == pytest.approx(3.0, rel=0.01)
    assert response["exponent"] == pytest.approx(1.0, rel=0.01)
    assert result.background_rates.empty                  # el grupo nunca dejó de ver la celda


def test_group_without_common_period_is_not_calibrated():
    all_loci = pd.concat([_loci(MODIS, "2005-09-01", range(10)), _loci(SNPP, "2015-09-01", range(40))])
    group_days = {
        SourceGroup.MODIS: pd.DatetimeIndex(["2005-09-01"]),
        SourceGroup.SNPP: pd.DatetimeIndex(["2015-09-01"]),
    }

    result = calibration.calibrate(all_loci, group_days, SETTINGS)

    assert result.groups == {SourceGroup.SNPP}


def test_weights_add_up_to_the_response_and_reference_counts_as_one():
    all_loci = pd.concat([_loci(SNPP, "2015-09-01", range(40)), _loci(MODIS, "2005-09-01", range(16))])
    calibrated = _calibration(
        response=pd.DataFrame({"source_group_id": [MODIS], "coefficient": [3.0], "exponent": [0.5]}),
        factors=pd.DataFrame({"source_group_id": [MODIS], "h3_cell": [9], "month_of_year": [9], "ratio": [2.0]}),
    )

    weighted = aggregation.attach_weight(all_loci, calibrated)
    daily = aggregation.detected_by(weighted, "map_cell", "h3_cell").set_index("source_group_id")

    assert daily.loc[SNPP, "detected_index"] == 40
    assert daily.loc[MODIS, "active_loci"] == 16
    assert daily.loc[MODIS, "detected_index"] == pytest.approx(3.0 * 16**0.5 * 2.0)   # respuesta × ajuste local


def test_loci_of_uncalibrated_groups_are_dropped():
    all_loci = pd.concat([_loci(SNPP, "2015-09-01", range(4)), _loci(MODIS, "2005-09-01", range(3))])

    weighted = aggregation.attach_weight(all_loci, _calibration())

    assert set(weighted["source_group_id"]) == {SNPP}
