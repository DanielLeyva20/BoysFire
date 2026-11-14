"""Escritura del modelo armonizado (esquema ``fire``)."""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd
import pyodbc

from boysfire.db.bulk import insert_frame
from boysfire.db.connection import transaction
from boysfire.harmonize.result import HarmonizationResult

logger = logging.getLogger(__name__)

# Tablas derivadas, de la más dependiente a la menos. fire.grid_cell no se vacía:
# las celdas son permanentes y conservan su región asignada.
_TRUNCATE = (
    "fire.region_climatology",
    "fire.daily_region_harmonized",
    "fire.daily_region_activity",
    "fire.daily_cell_harmonized",
    "fire.daily_cell_activity",
    "fire.calibration_factor",
    "fire.observation_day",
    "fire.hotspot",
)
# Referenciada por una clave foránea: SQL Server no permite TRUNCATE.
_DELETE = ("fire.calibration_baseline",)


class FireRepository:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def replace_all(self, result: HarmonizationResult) -> None:
        """Reemplaza todo el modelo armonizado en una sola transacción."""
        with transaction(self._connection) as cursor:
            for table in _TRUNCATE:
                cursor.execute(f"TRUNCATE TABLE {table}")
            for table in _DELETE:
                cursor.execute(f"DELETE FROM {table}")

            self._insert_missing_grid_cells(cursor, result.grid_cells)
            loads = (
                ("fire.hotspot", result.hotspots),
                ("fire.observation_day", result.observation_days),
                ("fire.calibration_baseline", result.calibration_baseline),
                ("fire.calibration_factor", result.calibration_factors),
                ("fire.daily_cell_activity", result.daily_cell_activity),
                ("fire.daily_cell_harmonized", result.daily_cell_harmonized),
                ("fire.daily_region_activity", result.daily_region_activity),
                ("fire.daily_region_harmonized", result.daily_region_harmonized),
                ("fire.region_climatology", result.region_climatology),
            )
            for table, frame in loads:
                rows = insert_frame(cursor, table, frame)
                logger.info("  %-32s %9d filas", table, rows)

    @staticmethod
    def _insert_missing_grid_cells(cursor: pyodbc.Cursor, cells: pd.DataFrame) -> None:
        cursor.execute("SELECT h3_index FROM fire.grid_cell")
        existing = np.fromiter((row[0] for row in cursor.fetchall()), dtype=np.int64)
        missing = cells[~cells["h3_index"].isin(existing)]
        # Los padres (menor resolución) primero, para cumplir la clave foránea.
        missing = missing.sort_values("resolution", kind="stable")
        rows = insert_frame(cursor, "fire.grid_cell", missing)
        logger.info("  %-32s %9d filas nuevas", "fire.grid_cell", rows)
