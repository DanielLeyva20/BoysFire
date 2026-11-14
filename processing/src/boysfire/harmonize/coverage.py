"""Paso 4 · Cobertura: qué días estaba observando cada satélite y cada grupo.

Distinguir "no hubo fuego" de "el satélite no miró" es clave: los huecos no deben
contarse como días tranquilos ni entrar a la calibración.
"""
from __future__ import annotations

from collections.abc import Collection

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import (
    SATELLITE_SENSOR,
    SOURCE_GROUP_MEMBERS,
    SOURCE_GROUP_PRIORITY,
    Satellite,
    SourceGroup,
)

_EMPTY_DAYS = pd.DatetimeIndex([])


def observing_days(detection_days: pd.DatetimeIndex, outage_min_days: int) -> pd.DatetimeIndex:
    """Días en que el satélite observaba, a partir de los días en que detectó algo.

    Se asume operativo entre su primera y su última detección. Una racha de
    ``outage_min_days`` o más días seguidos sin ninguna detección se toma como una caída.
    """
    present = pd.DatetimeIndex(detection_days.unique()).sort_values()
    if present.empty:
        return _EMPTY_DAYS
    calendar = pd.date_range(present[0], present[-1], freq="D")
    is_present = pd.Series(calendar.isin(present), index=calendar)

    run_id = is_present.ne(is_present.shift()).cumsum()
    run_length = is_present.groupby(run_id).transform("size")
    in_outage = ~is_present & (run_length >= outage_min_days)
    return calendar[~in_outage.to_numpy()]


def satellite_observing_days(
    detections: pd.DataFrame, settings: HarmonizationSettings
) -> dict[Satellite, pd.DatetimeIndex]:
    """``detections``: columnas ``satellite_id`` y ``activity_date`` de TODOS los focos crudos válidos."""
    result: dict[Satellite, pd.DatetimeIndex] = {}
    for satellite_id, days in detections.groupby("satellite_id")["activity_date"]:
        satellite = Satellite(satellite_id)
        threshold = settings.outage_min_days[SATELLITE_SENSOR[satellite]]
        result[satellite] = observing_days(pd.DatetimeIndex(days), threshold)
    return result


def group_available_days(
    satellite_days: dict[Satellite, pd.DatetimeIndex],
) -> dict[SourceGroup, pd.DatetimeIndex]:
    """Un grupo está disponible un día si todos sus satélites observaban ese día."""
    result: dict[SourceGroup, pd.DatetimeIndex] = {}
    for group, members in SOURCE_GROUP_MEMBERS.items():
        days: pd.DatetimeIndex | None = None
        for satellite in members:
            satellite_index = satellite_days.get(satellite, _EMPTY_DAYS)
            days = satellite_index if days is None else days.intersection(satellite_index)
        if days is not None and not days.empty:
            result[group] = days
    return result


def select_daily_source(
    group_days: dict[SourceGroup, pd.DatetimeIndex], usable_groups: Collection[SourceGroup]
) -> pd.DataFrame:
    """Elige para cada día el grupo usable de mayor prioridad. Filas de ``fire.observation_day``."""
    chosen: pd.Series | None = None
    # Se recorre de menor a mayor prioridad: el más prioritario escribe al final y gana.
    for group in reversed(SOURCE_GROUP_PRIORITY):
        if group not in usable_groups or group not in group_days:
            continue
        candidate = pd.Series(int(group), index=group_days[group])
        chosen = candidate if chosen is None else candidate.combine_first(chosen)
    if chosen is None:
        return pd.DataFrame({"activity_date": _EMPTY_DAYS, "source_group_id": pd.Series(dtype="int64")})
    chosen = chosen.sort_index().astype("int64")
    return pd.DataFrame({"activity_date": chosen.index, "source_group_id": chosen.to_numpy()})
