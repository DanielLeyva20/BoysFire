"""Lectura de catálogos y comprobación de que el código y la base coinciden."""
from __future__ import annotations

from enum import IntEnum

import pyodbc

from boysfire.domain.catalogs import (
    COUNTRY_REGION_CODE,
    ConfidenceLevel,
    Satellite,
    Sensor,
    SourceGroup,
)

_CATALOGS: tuple[tuple[str, str, type[IntEnum]], ...] = (
    ("ref.sensor", "sensor_id", Sensor),
    ("ref.satellite", "satellite_id", Satellite),
    ("ref.confidence_level", "confidence_level_id", ConfidenceLevel),
    ("ref.source_group", "source_group_id", SourceGroup),
)


class CatalogRepository:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def verify(self) -> None:
        """Falla si algún catálogo de la base difiere de los enums de Python."""
        cursor = self._connection.cursor()
        try:
            for table, id_column, enum in _CATALOGS:
                cursor.execute(f"SELECT {id_column}, code FROM {table}")
                in_database = {code: identifier for identifier, code in cursor.fetchall()}
                in_code = {member.name: member.value for member in enum}
                if in_database != in_code:
                    raise RuntimeError(
                        f"El catálogo {table} no coincide con {enum.__name__}: "
                        f"base={in_database} código={in_code}"
                    )
        finally:
            cursor.close()

    def country_region_id(self) -> int:
        cursor = self._connection.cursor()
        try:
            cursor.execute("SELECT region_id FROM ref.region WHERE code = ?", COUNTRY_REGION_CODE)
            row = cursor.fetchone()
        finally:
            cursor.close()
        if row is None:
            raise RuntimeError(f"No existe la región país '{COUNTRY_REGION_CODE}' en ref.region.")
        return int(row[0])
