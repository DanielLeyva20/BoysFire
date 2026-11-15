"""Límites de departamentos, provincias y distritos de Perú.

Fuente: cartografía del INEI en GeoJSON simplificado, publicada en
https://github.com/juaneladio/peru-geojson. Cada región se identifica por su ubigeo
(2 dígitos el departamento, 4 la provincia, 6 el distrito), y el ubigeo del padre es
el mismo código sin sus dos últimos dígitos.
"""
from __future__ import annotations

import json
import logging
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import shapely
from shapely.geometry import shape

from boysfire.domain.catalogs import COUNTRY_REGION_CODE, RegionLevel

logger = logging.getLogger(__name__)

SOURCE_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/"
BOUNDARY_COLUMNS = ["region_level_id", "code", "name", "parent_code", "wkt"]

_WKT_DECIMALS = 5          # ≈ 1 m: de sobra para límites simplificados
_LOWERCASE_WORDS = frozenset({"de", "del", "la", "las", "los", "y"})


@dataclass(frozen=True)
class BoundaryFile:
    level: RegionLevel
    file_name: str
    code_property: str
    name_property: str


# Del nivel más amplio al más fino: cada nivel necesita que su padre ya exista.
BOUNDARY_FILES: tuple[BoundaryFile, ...] = (
    BoundaryFile(RegionLevel.DEPARTMENT, "peru_departamental_simple.geojson", "FIRST_IDDP", "NOMBDEP"),
    BoundaryFile(RegionLevel.PROVINCE, "peru_provincial_simple.geojson", "FIRST_IDPR", "NOMBPROV"),
    BoundaryFile(RegionLevel.DISTRICT, "peru_distrital_simple.geojson", "IDDIST", "NOMBDIST"),
)


def download_missing(directory: Path) -> None:
    """Descarga a ``directory`` los archivos de límites que todavía no estén."""
    directory.mkdir(parents=True, exist_ok=True)
    for boundary_file in BOUNDARY_FILES:
        target = directory / boundary_file.file_name
        if target.exists():
            continue
        logger.info("Descargando %s", boundary_file.file_name)
        urllib.request.urlretrieve(SOURCE_URL + boundary_file.file_name, target)  # noqa: S310 (URL fija, https)


def read_boundaries(directory: Path) -> pd.DataFrame:
    """Lee los tres niveles. Una fila por región, con su geometría en WKT lista para SQL Server."""
    frames = [_read_level(directory / boundary_file.file_name, boundary_file) for boundary_file in BOUNDARY_FILES]
    boundaries = pd.concat(frames, ignore_index=True)

    known_codes = set(boundaries["code"]) | {COUNTRY_REGION_CODE}
    orphan = ~boundaries["parent_code"].isin(known_codes)
    if orphan.any():
        logger.warning("Se omiten %d regiones cuyo padre no existe: %s", orphan.sum(), boundaries.loc[orphan, "code"].tolist())
    return boundaries.loc[~orphan, BOUNDARY_COLUMNS].reset_index(drop=True)


def _read_level(path: Path, boundary_file: BoundaryFile) -> pd.DataFrame:
    with path.open(encoding="utf-8") as stream:
        features = json.load(stream)["features"]

    rows = []
    for feature in features:
        code = str(feature["properties"][boundary_file.code_property])
        wkt = to_wkt(feature["geometry"])
        if wkt is None:
            logger.warning("La región %s no trae geometría y se omite", code)
            continue
        rows.append(
            {
                "region_level_id": int(boundary_file.level),
                "code": code,
                "name": display_name(feature["properties"][boundary_file.name_property]),
                "parent_code": parent_code(code),
                "wkt": wkt,
            }
        )
    # El archivo puede traer un ubigeo partido en varias piezas: se conserva la primera.
    return pd.DataFrame(rows, columns=BOUNDARY_COLUMNS).drop_duplicates(subset="code")


def parent_code(code: str) -> str:
    return code[:-2] if len(code) > 2 else COUNTRY_REGION_CODE


def display_name(name: str) -> str:
    """"SAN VICENTE DE CAÑETE" → "San Vicente de Cañete"."""
    words = name.strip().lower().split()
    return " ".join(
        word if position > 0 and word in _LOWERCASE_WORDS else word.capitalize()
        for position, word in enumerate(words)
    )


def to_wkt(geometry: dict | None) -> str | None:
    """Geometría GeoJSON → WKT válido para el tipo ``geography`` de SQL Server.

    SQL Server exige anillos exteriores en sentido antihorario; con el sentido contrario
    interpreta el polígono como "todo el planeta menos esta región".
    """
    if geometry is None:
        return None
    polygon = _polygonal(shapely.make_valid(shape(geometry)))
    if polygon is None or polygon.is_empty:
        return None
    return shapely.to_wkt(shapely.orient_polygons(polygon), rounding_precision=_WKT_DECIMALS)


def _polygonal(geometry: shapely.Geometry) -> shapely.Geometry | None:
    """Conserva solo la parte poligonal (``make_valid`` puede devolver además líneas o puntos)."""
    if geometry.geom_type in ("Polygon", "MultiPolygon"):
        return geometry
    parts = [part for part in getattr(geometry, "geoms", []) if part.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else None
