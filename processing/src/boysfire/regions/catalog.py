"""Catálogo de regiones en memoria: a qué distrito, provincia y departamento pertenece cada punto."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import shapely

from boysfire.domain.catalogs import RegionLevel

# Los límites simplificados dejan rendijas entre distritos y recortan la costa. Un punto
# que no cae en ningún distrito se asigna al más cercano si está a menos de esta distancia
# (grados; 0,05° ≈ 5 km).
SNAP_DISTANCE_DEGREES = 0.05


@dataclass(frozen=True)
class RegionCatalog:
    """Regiones cargadas en ``ref.region``.

    ``hierarchy``: region_id, region_level_id, parent_region_id (todas las regiones).
    ``districts``: region_id, wkt (solo el nivel más fino, el único que se busca por posición).
    """

    hierarchy: pd.DataFrame
    districts: pd.DataFrame

    @property
    def country_id(self) -> int:
        is_country = self.hierarchy["region_level_id"] == int(RegionLevel.COUNTRY)
        return int(self.hierarchy.loc[is_country, "region_id"].iloc[0])

    def locate(self, points: pd.DataFrame) -> pd.DataFrame:
        """Región de cada punto en cada nivel.

        ``points``: índice = identificador del punto; columnas ``latitude`` y ``longitude``.
        Devuelve una columna por nivel (``country``, ``department``, ``province``, ``district``)
        con el region_id, o vacío si el punto queda fuera de todo distrito. Todo punto
        pertenece al país.
        """
        district = pd.Series(
            find_containing(points["latitude"].to_numpy(), points["longitude"].to_numpy(), self.districts),
            index=points.index,
            dtype="Int64",
        )
        parent = self.hierarchy.set_index("region_id")["parent_region_id"].astype("Int64")
        province = district.map(parent).astype("Int64")
        department = province.map(parent).astype("Int64")
        return pd.DataFrame(
            {
                RegionLevel.COUNTRY.name.lower(): pd.Series(self.country_id, index=points.index, dtype="Int64"),
                RegionLevel.DEPARTMENT.name.lower(): department,
                RegionLevel.PROVINCE.name.lower(): province,
                RegionLevel.DISTRICT.name.lower(): district,
            }
        )


def find_containing(latitude: np.ndarray, longitude: np.ndarray, polygons: pd.DataFrame) -> np.ndarray:
    """region_id del polígono que contiene cada punto (el más cercano si cae en una rendija).

    Devuelve un arreglo de objetos con ``pd.NA`` donde no hay polígono a distancia razonable.
    """
    result = np.full(len(latitude), pd.NA, dtype=object)
    if polygons.empty or len(latitude) == 0:
        return result

    region_ids = polygons["region_id"].to_numpy()
    tree = shapely.STRtree(shapely.from_wkt(polygons["wkt"].to_numpy()))
    points = shapely.points(longitude, latitude)

    point_index, polygon_index = tree.query(points, predicate="intersects")
    result[point_index] = region_ids[polygon_index]     # si toca dos distritos, queda uno de ellos

    missing = np.flatnonzero(pd.isna(result))
    if len(missing):
        point_index, polygon_index = tree.query_nearest(
            points[missing], max_distance=SNAP_DISTANCE_DEGREES, all_matches=False
        )
        result[missing[point_index]] = region_ids[polygon_index]
    return result
