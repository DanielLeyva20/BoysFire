"""Acceso a ``ref.region``."""
from __future__ import annotations

import pandas as pd
import pyodbc

from boysfire.db.connection import transaction
from boysfire.domain.catalogs import RegionLevel
from boysfire.regions.catalog import RegionCatalog

# Inserta la región o, si su código ya existe, actualiza sus datos. El padre se busca por código.
_UPSERT_SQL = """
MERGE ref.region AS target
USING (
    SELECT ? AS region_level_id,
           ? AS code,
           ? AS name,
           (SELECT parent.region_id FROM ref.region AS parent WHERE parent.code = ?) AS parent_region_id,
           geography::STGeomFromText(?, 4326) AS geom
) AS source
ON target.code = source.code
WHEN MATCHED THEN UPDATE SET
    region_level_id = source.region_level_id,
    name = source.name,
    parent_region_id = source.parent_region_id,
    geom = source.geom
WHEN NOT MATCHED THEN INSERT (region_level_id, code, name, parent_region_id, geom)
    VALUES (source.region_level_id, source.code, source.name, source.parent_region_id, source.geom);
"""

_READ_SQL = """
SELECT region_id,
       region_level_id,
       parent_region_id,
       CASE WHEN region_level_id = ? THEN geom.STAsText() END AS wkt
FROM ref.region
"""


class RegionRepository:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def upsert(self, boundaries: pd.DataFrame) -> int:
        """Guarda las regiones nivel por nivel, para que cada una encuentre a su padre."""
        columns = ["region_level_id", "code", "name", "parent_code", "wkt"]
        with transaction(self._connection) as cursor:
            for _, level_rows in boundaries.sort_values("region_level_id").groupby("region_level_id", sort=True):
                cursor.executemany(_UPSERT_SQL, list(level_rows[columns].itertuples(index=False, name=None)))
        return len(boundaries)

    def read_catalog(self) -> RegionCatalog:
        cursor = self._connection.cursor()
        try:
            cursor.execute(_READ_SQL, int(RegionLevel.DISTRICT))
            rows = pd.DataFrame.from_records(
                cursor.fetchall(), columns=["region_id", "region_level_id", "parent_region_id", "wkt"]
            )
        finally:
            cursor.close()
        if rows.empty:
            raise RuntimeError("ref.region está vacía: faltan las migraciones de la base.")
        rows["parent_region_id"] = rows["parent_region_id"].astype("Int64")
        return RegionCatalog(
            hierarchy=rows[["region_id", "region_level_id", "parent_region_id"]],
            districts=rows.loc[rows["wkt"].notna(), ["region_id", "wkt"]].reset_index(drop=True),
        )
