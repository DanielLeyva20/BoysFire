"""Paso 5 · Deduplicación en la grilla común: de focos a "celdas activas".

Un incendio de 1 km² es un píxel para MODIS y unos siete para VIIRS. Si se cuentan
focos, VIIRS siempre "ve más fuego". Aquí se cuenta otra cosa: celdas de ~1 km con
fuego en un día. Varios focos del mismo grupo en la misma celda y día (píxeles
vecinos, varias pasadas, Terra y Aqua) valen una sola vez.
"""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import SOURCE_GROUP_MEMBERS, SourceGroup

LOCI_COLUMNS = ["source_group_id", "activity_date", "h3_cell", "map_cell", "calibration_cell"]


def build_loci(
    hotspots: pd.DataFrame,
    group_days: dict[SourceGroup, pd.DatetimeIndex],
    settings: HarmonizationSettings,
) -> pd.DataFrame:
    """Una fila por (grupo, día, celda locus) con fuego de confianza suficiente."""
    confident = hotspots.loc[hotspots["confidence_level_id"] >= int(settings.min_confidence)]
    frames = []
    for group, days in group_days.items():
        members = [int(satellite) for satellite in SOURCE_GROUP_MEMBERS[group]]
        selected = confident.loc[
            confident["satellite_id"].isin(members) & confident["activity_date"].isin(days),
            ["activity_date", "h3_cell", "map_cell", "calibration_cell"],
        ].drop_duplicates(subset=["activity_date", "h3_cell"])
        frames.append(selected.assign(source_group_id=int(group)))
    if not frames:
        return pd.DataFrame(columns=LOCI_COLUMNS)
    return pd.concat(frames, ignore_index=True)[LOCI_COLUMNS]
