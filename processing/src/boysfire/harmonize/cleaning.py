"""Paso 3 · Limpieza: fuera lo que no es incendio de vegetación y las detecciones repetidas."""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import VEGETATION_FIRE_TYPE

_DETECTION_KEY = ["satellite_id", "acq_datetime_utc", "latitude", "longitude"]


def clean(hotspots: pd.DataFrame, settings: HarmonizationSettings) -> tuple[pd.DataFrame, dict[str, float]]:
    """Requiere la columna ``h3_cell``. Devuelve los focos válidos y cuántos se excluyeron."""
    detection_type = hotspots["detection_type"]
    is_untyped = detection_type.isna()                       # datos NRT
    is_non_vegetation = ~is_untyped & detection_type.ne(VEGETATION_FIRE_TYPE)

    static_cells = static_source_cells(hotspots.loc[is_non_vegetation, "h3_cell"], settings)
    is_inferred_static = is_untyped & hotspots["h3_cell"].isin(static_cells)

    kept = hotspots.loc[~is_non_vegetation & ~is_inferred_static]
    is_duplicate = kept.duplicated(subset=_DETECTION_KEY, keep="first")
    kept = kept.loc[~is_duplicate].reset_index(drop=True)

    metrics = {
        "rows.excluded.non_vegetation_type": float(is_non_vegetation.sum()),
        "rows.excluded.static_source_inferred": float(is_inferred_static.sum()),
        "rows.excluded.duplicate": float(is_duplicate.sum()),
        "rows.clean": float(len(kept)),
        "static_source_cells": float(len(static_cells)),
    }
    return kept, metrics


def static_source_cells(non_vegetation_cells: pd.Series, settings: HarmonizationSettings) -> pd.Index:
    """Celdas donde FIRMS ya marcó varias veces un volcán, una industria o un mechero.

    El archivo histórico trae ese tipo; los datos NRT no. Se usa esta máscara para
    aplicar el mismo criterio a ambos.
    """
    counts = non_vegetation_cells.value_counts()
    return counts.index[counts >= settings.static_source_min_detections]
