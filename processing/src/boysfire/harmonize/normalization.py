"""Paso 1 · Normalización: satélite, fecha y hora, y confianza en una escala común."""
from __future__ import annotations

import numpy as np
import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import (
    FIRMS_SATELLITE_CODES,
    SATELLITE_SENSOR,
    VIIRS_CONFIDENCE_CODES,
    ConfidenceLevel,
    Satellite,
    Sensor,
)

MODIS_SATELLITE_IDS = [int(s) for s, sensor in SATELLITE_SENSOR.items() if sensor is Sensor.MODIS]


def normalize(raw: pd.DataFrame, settings: HarmonizationSettings) -> tuple[pd.DataFrame, dict[str, float]]:
    """Devuelve los focos con tipos y escalas comunes, y cuántas filas se descartaron."""
    satellite = raw["satellite"].map({code: int(sat) for code, sat in FIRMS_SATELLITE_CODES.items()})
    confidence = confidence_levels(raw["confidence"], satellite, settings)
    valid = satellite.notna() & confidence.notna()

    kept = raw.loc[valid]
    utc = acquisition_datetime(kept["acq_date"], kept["acq_time"])
    frp = kept["frp"].astype("float64")
    hotspots = pd.DataFrame(
        {
            "hotspot_id": kept["raw_hotspot_id"].astype("int64"),
            "satellite_id": satellite[valid].astype("int16"),
            "confidence_level_id": confidence[valid].astype("int16"),
            "acq_datetime_utc": utc,
            "activity_date": local_date(utc, settings.utc_offset_hours),
            "latitude": kept["latitude"].astype("float64"),
            "longitude": kept["longitude"].astype("float64"),
            "is_daytime": kept["daynight"].eq("D"),
            "frp_mw": frp.where(frp >= 0),   # una potencia negativa es un valor de relleno

            "scan_km": kept["scan"].astype("float64"),
            "track_km": kept["track"].astype("float64"),
            "detection_type": kept["type"].astype("float64"),
        }
    ).reset_index(drop=True)

    metrics = {
        "rows.raw": float(len(raw)),
        "rows.rejected.unknown_satellite": float(satellite.isna().sum()),
        "rows.rejected.invalid_confidence": float((satellite.notna() & confidence.isna()).sum()),
    }
    return hotspots, metrics


def acquisition_datetime(acq_date: pd.Series, acq_time: pd.Series) -> pd.Series:
    """Une la fecha y la hora HHMM (UTC) de FIRMS en un solo instante."""
    hours = acq_time.str.slice(0, 2).astype("int64")
    minutes = acq_time.str.slice(2, 4).astype("int64")
    return pd.to_datetime(acq_date) + pd.to_timedelta(hours * 60 + minutes, unit="m")


def local_date(utc: pd.Series, utc_offset_hours: int) -> pd.Series:
    """Fecha en hora de Perú. Un paso nocturno (≈01:30 local) cae en el día correcto."""
    return (utc + pd.Timedelta(hours=utc_offset_hours)).dt.normalize()


def confidence_levels(
    confidence: pd.Series, satellite_id: pd.Series, settings: HarmonizationSettings
) -> pd.Series:
    """Lleva la confianza de MODIS (0–100) y de VIIRS (l/n/h) a LOW / NOMINAL / HIGH.

    Devuelve NaN donde el valor no es válido para su sensor.
    """
    is_modis = satellite_id.isin(MODIS_SATELLITE_IDS)

    # float64 de NumPy: funciona igual si la columna llega como texto de Python o de pandas.
    percent = pd.to_numeric(confidence.where(is_modis), errors="coerce").astype("float64")
    percent = percent.where(percent.between(0, 100))
    modis_level = pd.Series(
        np.select(
            [percent < settings.modis_nominal_min, percent < settings.modis_high_min],
            [ConfidenceLevel.LOW, ConfidenceLevel.NOMINAL],
            default=ConfidenceLevel.HIGH,
        ),
        index=confidence.index,
        dtype="float64",
    ).where(percent.notna())

    viirs_codes = {code: float(level) for code, level in VIIRS_CONFIDENCE_CODES.items()}
    viirs_level = confidence.where(~is_modis).str.lower().map(viirs_codes)

    return modis_level.where(is_modis, viirs_level.astype("float64"))


def satellites_present(hotspots: pd.DataFrame) -> list[Satellite]:
    return [Satellite(value) for value in sorted(hotspots["satellite_id"].unique())]
