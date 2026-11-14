"""Catálogos del dominio.

Reflejan las tablas del esquema ``ref`` (db/migrations/V4__seed_reference_data.sql).
Los identificadores deben coincidir; ``CatalogRepository.verify`` lo comprueba al arrancar.
"""
from enum import IntEnum


class Sensor(IntEnum):
    MODIS = 1
    VIIRS = 2


class Satellite(IntEnum):
    TERRA = 1
    AQUA = 2
    SNPP = 3
    NOAA20 = 4
    NOAA21 = 5


class ConfidenceLevel(IntEnum):
    LOW = 1
    NOMINAL = 2
    HIGH = 3


class SourceGroup(IntEnum):
    """Conjunto de satélites que puede alimentar la serie armonizada en un día."""

    SNPP = 1
    NOAA20 = 2
    NOAA21 = 3
    MODIS = 4
    AQUA = 5
    TERRA = 6


SATELLITE_SENSOR: dict[Satellite, Sensor] = {
    Satellite.TERRA: Sensor.MODIS,
    Satellite.AQUA: Sensor.MODIS,
    Satellite.SNPP: Sensor.VIIRS,
    Satellite.NOAA20: Sensor.VIIRS,
    Satellite.NOAA21: Sensor.VIIRS,
}

# Valores de la columna "satellite" en los archivos de FIRMS (cambian según la época).
FIRMS_SATELLITE_CODES: dict[str, Satellite] = {
    "Terra": Satellite.TERRA,
    "T": Satellite.TERRA,
    "Aqua": Satellite.AQUA,
    "A": Satellite.AQUA,
    "SNPP": Satellite.SNPP,
    "N": Satellite.SNPP,
    "N20": Satellite.NOAA20,
    "1": Satellite.NOAA20,
    "N21": Satellite.NOAA21,
    "2": Satellite.NOAA21,
}

# Códigos de confianza de VIIRS.
VIIRS_CONFIDENCE_CODES: dict[str, ConfidenceLevel] = {
    "l": ConfidenceLevel.LOW,
    "n": ConfidenceLevel.NOMINAL,
    "h": ConfidenceLevel.HIGH,
}

REFERENCE_GROUP = SourceGroup.SNPP

# Orden de preferencia: el primero disponible alimenta la serie del día.
SOURCE_GROUP_PRIORITY: tuple[SourceGroup, ...] = (
    SourceGroup.SNPP,
    SourceGroup.NOAA20,
    SourceGroup.NOAA21,
    SourceGroup.MODIS,
    SourceGroup.AQUA,
    SourceGroup.TERRA,
)

SOURCE_GROUP_MEMBERS: dict[SourceGroup, frozenset[Satellite]] = {
    SourceGroup.SNPP: frozenset({Satellite.SNPP}),
    SourceGroup.NOAA20: frozenset({Satellite.NOAA20}),
    SourceGroup.NOAA21: frozenset({Satellite.NOAA21}),
    SourceGroup.MODIS: frozenset({Satellite.TERRA, Satellite.AQUA}),
    SourceGroup.AQUA: frozenset({Satellite.AQUA}),
    SourceGroup.TERRA: frozenset({Satellite.TERRA}),
}

# Tipo de detección de FIRMS que corresponde a un incendio de vegetación.
VEGETATION_FIRE_TYPE = 0

COUNTRY_REGION_CODE = "PE"
