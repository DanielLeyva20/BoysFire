"""Escritura del modelo armonizado (esquema ``fire``)."""
from __future__ import annotations

import logging

import pandas as pd
import pyodbc

from boysfire.db.bulk import DEFAULT_BATCH_ROWS, insert_frame
from boysfire.db.connection import transaction
from boysfire.harmonize.result import HarmonizationResult

logger = logging.getLogger(__name__)

# Tablas derivadas, de la más dependiente a la menos. fire.grid_cell no se vacía:
# las celdas son permanentes.
_TRUNCATE = (
    "fire.region_climatology",
    "fire.daily_region_harmonized",
    "fire.daily_region_activity",
    "fire.daily_cell_harmonized",
    "fire.daily_cell_activity",
    "fire.background_region_rate",
    "fire.background_cell_rate",
    "fire.daily_background_scale",
    "fire.calibration_factor",
    "fire.observation_day",
    "fire.hotspot",
)
# Referenciada por claves foráneas: SQL Server no permite TRUNCATE.
_DELETE = ("fire.calibration_response",)

_READ_CELL_REGIONS_SQL = "SELECT h3_index, region_id FROM fire.grid_cell"

_UPDATE_CELL_REGIONS_SQL = """
UPDATE cell
SET region_id = changed.region_id
FROM fire.grid_cell AS cell
JOIN OPENJSON(?) WITH (h3_index BIGINT '$[0]', region_id INT '$[1]') AS changed
  ON changed.h3_index = cell.h3_index
"""


class FireRepository:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def replace_all(self, result: HarmonizationResult) -> None:
        """Reemplaza todo el modelo armonizado en una sola transacción."""
        with transaction(self._connection) as cursor:
            # TRUNCATE es mucho más rápido que DELETE con millones de filas. Mientras dura el
            # reemplazo (unos 4 minutos) las consultas de la API esperan; los datos no se pierden.
            for table in _TRUNCATE:
                cursor.execute(f"TRUNCATE TABLE {table}")
            for table in _DELETE:
                cursor.execute(f"DELETE FROM {table}")

            self._sync_grid_cells(cursor, result.grid_cells)
            loads = (
                ("fire.hotspot", result.hotspots),
                ("fire.observation_day", result.observation_days),
                ("fire.calibration_response", result.calibration_response),
                ("fire.calibration_factor", result.calibration_factors),
                ("fire.daily_background_scale", result.daily_background_scale),
                ("fire.background_cell_rate", result.background_cell_rates),
                ("fire.background_region_rate", result.background_region_rates),
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
    def _sync_grid_cells(cursor: pyodbc.Cursor, cells: pd.DataFrame) -> None:
        """Inserta las celdas nuevas y corrige la región de las que cambiaron."""
        cursor.execute(_READ_CELL_REGIONS_SQL)
        stored = pd.DataFrame.from_records(cursor.fetchall(), columns=["h3_index", "stored_region_id"])
        stored["stored_region_id"] = stored["stored_region_id"].astype("Int64")

        merged = cells.merge(stored, on="h3_index", how="left", indicator=True)
        is_new = merged["_merge"] == "left_only"
        # Los padres (menor resolución) primero, para cumplir la clave foránea.
        new_cells = merged.loc[is_new, cells.columns].sort_values("resolution", kind="stable")
        inserted = insert_frame(cursor, "fire.grid_cell", new_cells)

        region_changed = ~is_new & (merged["region_id"].fillna(-1) != merged["stored_region_id"].fillna(-1))
        changed = merged.loc[region_changed, ["h3_index", "region_id"]]
        for start in range(0, len(changed), DEFAULT_BATCH_ROWS):
            chunk = changed.iloc[start : start + DEFAULT_BATCH_ROWS]
            cursor.execute(_UPDATE_CELL_REGIONS_SQL, chunk.to_json(orient="values"))
        logger.info("  %-32s %9d filas nuevas, %d con región actualizada", "fire.grid_cell", inserted, len(changed))
