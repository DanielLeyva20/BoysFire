import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import ConfidenceLevel, Satellite
from boysfire.harmonize.normalization import acquisition_datetime, confidence_levels, local_date, normalize

SETTINGS = HarmonizationSettings()


def test_modis_confidence_uses_percent_thresholds():
    confidence = pd.Series(["0", "29", "30", "79", "80", "100"])
    satellite = pd.Series([int(Satellite.TERRA)] * 6)

    levels = confidence_levels(confidence, satellite, SETTINGS)

    assert levels.tolist() == [
        ConfidenceLevel.LOW, ConfidenceLevel.LOW,
        ConfidenceLevel.NOMINAL, ConfidenceLevel.NOMINAL,
        ConfidenceLevel.HIGH, ConfidenceLevel.HIGH,
    ]


def test_viirs_confidence_uses_letter_codes():
    confidence = pd.Series(["l", "n", "h", "N"])
    satellite = pd.Series([int(Satellite.SNPP)] * 4)

    levels = confidence_levels(confidence, satellite, SETTINGS)

    assert levels.tolist() == [
        ConfidenceLevel.LOW, ConfidenceLevel.NOMINAL, ConfidenceLevel.HIGH, ConfidenceLevel.NOMINAL,
    ]


def test_confidence_from_the_wrong_scale_is_invalid():
    confidence = pd.Series(["n", "150", "55"])
    satellite = pd.Series([int(Satellite.AQUA), int(Satellite.AQUA), int(Satellite.NOAA20)])

    assert confidence_levels(confidence, satellite, SETTINGS).isna().all()


def test_night_pass_after_utc_midnight_belongs_to_previous_local_day():
    utc = acquisition_datetime(pd.Series(["2024-09-15"]), pd.Series(["0416"]))

    assert utc[0] == pd.Timestamp("2024-09-15 04:16")
    assert local_date(utc, SETTINGS.utc_offset_hours)[0] == pd.Timestamp("2024-09-14")


def test_normalize_rejects_unknown_satellite_and_keeps_the_rest():
    raw = pd.DataFrame(
        {
            "raw_hotspot_id": [1, 2],
            "latitude": [-12.0, -12.1],
            "longitude": [-76.0, -76.1],
            "acq_date": ["2024-09-15", "2024-09-15"],
            "acq_time": ["1830", "1830"],
            "satellite": ["Aqua", "Sputnik"],
            "confidence": ["85", "85"],
            "frp": [-1.0, 5.0],
            "scan": [1.0, 1.0],
            "track": [1.0, 1.0],
            "daynight": ["D", "D"],
            "type": [0.0, 0.0],
        }
    )

    hotspots, metrics = normalize(raw, SETTINGS)

    assert hotspots["hotspot_id"].tolist() == [1]
    assert hotspots["satellite_id"][0] == Satellite.AQUA
    assert hotspots["confidence_level_id"][0] == ConfidenceLevel.HIGH
    assert pd.isna(hotspots["frp_mw"][0])          # una potencia negativa no es un dato
    assert metrics["rows.rejected.unknown_satellite"] == 1
