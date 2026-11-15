"""Paso 6 · Calibración: llevar lo que ve cada grupo a "equivalente VIIRS S-NPP".

Se ajusta en el período en que el grupo y la referencia observaron a la vez. El modelo
tiene dos partes, porque los sensores difieren de dos maneras:

  · Respuesta. Donde el grupo ve fuego, la referencia ve más, pero la ventaja se reduce
    cuanto mayor es el fuego (un incendio grande lo ven todos). Para una celda de
    calibración y un día con ``n`` celdas activas del grupo:

        equivalentes = coefficient × n ^ exponent × ajuste_local(celda, mes)

  · Fondo. Más de la mitad de lo que ve la referencia ocurre donde el grupo no ve nada
    (fuegos pequeños). Se estima una tasa diaria por zona y mes, y se modula con la
    actividad del día: cuando el grupo ve mucho fuego en el país, también hay más
    fuego pequeño que no alcanza a ver.

Un factor único por celda y mes iguala los totales, pero carga todo el fondo sobre los
días con detecciones y exagera los picos diarios.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import REFERENCE_GROUP, SourceGroup

RESPONSE_COLUMNS = ["source_group_id", "coefficient", "exponent", "sample_cell_days"]
FACTOR_COLUMNS = ["source_group_id", "h3_cell", "month_of_year", "predicted_loci", "reference_loci", "ratio"]
BACKGROUND_COLUMNS = ["source_group_id", "h3_cell", "map_cell", "month_of_year", "daily_rate"]
SCALE_COLUMNS = ["activity_date", "source_group_id", "scale"]

_CELL_DAY = ["activity_date", "calibration_cell"]
_CELL_MONTH = ["calibration_cell", "month_of_year"]


@dataclass(frozen=True)
class Calibration:
    """Parámetros de todos los grupos calibrados. La referencia no aparece: vale 1 y no tiene fondo."""

    response: pd.DataFrame           # una fila por grupo
    factors: pd.DataFrame            # ajuste local por celda de calibración y mes
    background_rates: pd.DataFrame   # tasa diaria de fondo por celda locus y mes
    background_scale: pd.DataFrame   # peso del fondo por día

    @property
    def groups(self) -> set[SourceGroup]:
        """Grupos que pueden alimentar la serie: la referencia y los calibrados."""
        return {REFERENCE_GROUP} | {SourceGroup(value) for value in self.response["source_group_id"]}


def calibrate(
    loci: pd.DataFrame,
    group_days: dict[SourceGroup, pd.DatetimeIndex],
    settings: HarmonizationSettings,
) -> Calibration:
    loci = loci.assign(month_of_year=loci["activity_date"].dt.month)
    reference_loci = loci.loc[loci["source_group_id"] == int(REFERENCE_GROUP)]
    reference_days = group_days.get(REFERENCE_GROUP, pd.DatetimeIndex([]))

    parts: list[Calibration] = []
    for group, days in group_days.items():
        if group is REFERENCE_GROUP:
            continue
        overlap = days.intersection(reference_days)
        if group in settings.calibration_end:
            overlap = overlap[overlap <= pd.Timestamp(settings.calibration_end[group])]
        group_loci = loci.loc[loci["source_group_id"] == int(group)]
        part = _calibrate_group(group, group_loci, reference_loci, days, overlap, settings)
        if part is not None:
            parts.append(part)

    return Calibration(
        response=_concat([part.response for part in parts], RESPONSE_COLUMNS),
        factors=_concat([part.factors for part in parts], FACTOR_COLUMNS),
        background_rates=_concat([part.background_rates for part in parts], BACKGROUND_COLUMNS),
        background_scale=_concat([part.background_scale for part in parts], SCALE_COLUMNS),
    )


def _calibrate_group(
    group: SourceGroup,
    group_loci: pd.DataFrame,
    reference_loci: pd.DataFrame,
    days: pd.DatetimeIndex,
    overlap: pd.DatetimeIndex,
    settings: HarmonizationSettings,
) -> Calibration | None:
    """Ajusta un grupo. Devuelve None si no hay período común suficiente para calibrarlo."""
    source = group_loci.loc[group_loci["activity_date"].isin(overlap)]
    reference = reference_loci.loc[reference_loci["activity_date"].isin(overlap)]
    if source.empty or reference.empty:
        return None

    scale = daily_scale(group_loci, days, overlap, settings.background_activity_exponent)
    active = source.groupby(_CELL_DAY).size().rename("n").reset_index()
    active["month_of_year"] = active["activity_date"].dt.month
    active["scale"] = active["activity_date"].map(scale)

    rates = background_rates(reference, active, scale.loc[overlap])
    cell_rate = rates.groupby(_CELL_MONTH)["daily_rate"].sum()

    # Lo que la referencia vio por encima del fondo en las celdas y días con detecciones del grupo.
    reference_count = reference.groupby(_CELL_DAY).size().rename("m")
    active = active.join(reference_count, on=_CELL_DAY).fillna({"m": 0})
    expected_background = active.set_index(_CELL_MONTH).index.map(cell_rate).to_numpy(dtype="float64")
    active["excess"] = active["m"] - np.nan_to_num(expected_background) * active["scale"]

    fitted = fit_response(active["n"], active["excess"])
    if fitted is None:
        return None
    coefficient, exponent = fitted
    active["predicted"] = coefficient * active["n"] ** exponent

    factors = local_factors(group_loci, active, settings)
    as_group = {"source_group_id": int(group)}
    return Calibration(
        response=pd.DataFrame(
            {**as_group, "coefficient": [round(coefficient, 4)], "exponent": [round(exponent, 4)],
             "sample_cell_days": [len(active)]}
        ),
        factors=factors.assign(**as_group),
        background_rates=rates.assign(**as_group),
        background_scale=pd.DataFrame({"activity_date": scale.index, "scale": scale.round(4).to_numpy(), **as_group}),
    )


def daily_scale(
    group_loci: pd.DataFrame, days: pd.DatetimeIndex, overlap: pd.DatetimeIndex, exponent: float
) -> pd.Series:
    """Peso del fondo para cada día en que el grupo observa.

    Es la actividad nacional del grupo ese día respecto de lo normal para el mes, elevada a
    ``exponent`` y normalizada para que promedie 1 en cada mes del período común (así el
    fondo conserva su total).
    """
    national = group_loci.groupby("activity_date").size().reindex(days, fill_value=0).astype("float64")
    month = pd.Series(days.month, index=days)
    in_overlap = national.index.isin(overlap)

    typical = national[in_overlap].groupby(month[in_overlap]).mean()
    relative = (national / month.map(typical)).fillna(0.0) ** exponent
    normalizer = relative[in_overlap].groupby(month[in_overlap]).mean()
    scale = relative / month.map(normalizer)
    # Mes sin actividad del grupo en el período común: fondo constante.
    return scale.replace([np.inf, -np.inf], np.nan).fillna(1.0)


def background_rates(reference: pd.DataFrame, active: pd.DataFrame, overlap_scale: pd.Series) -> pd.DataFrame:
    """Tasa diaria de fondo por celda locus y mes.

    Reparte las celdas activas de la referencia, vistas donde el grupo no vio nada, entre los
    días (ponderados por su peso) en que la celda de calibración estuvo sin detecciones del grupo.
    """
    unseen = reference.merge(active[_CELL_DAY], on=_CELL_DAY, how="left", indicator=True)
    unseen = unseen.loc[unseen["_merge"] == "left_only"]

    month_weight = overlap_scale.groupby(overlap_scale.index.month).sum()
    active_weight = active.groupby(_CELL_MONTH)["scale"].sum()
    keys = unseen.set_index(_CELL_MONTH).index
    quiet_weight = (
        unseen["month_of_year"].map(month_weight).to_numpy(dtype="float64")
        - np.nan_to_num(keys.map(active_weight).to_numpy(dtype="float64"))
    )
    # Al menos un día-equivalente, para que una celda casi siempre activa no dispare la tasa.
    unseen = unseen.assign(daily_rate=1.0 / np.maximum(quiet_weight, 1.0))

    return unseen.groupby(
        ["h3_cell", "map_cell", "calibration_cell", "month_of_year"], as_index=False
    )["daily_rate"].sum()


def fit_response(n: pd.Series, excess: pd.Series) -> tuple[float, float] | None:
    """Ajusta ``excess ≈ coefficient × n ^ exponent`` sobre las medias por valor de ``n``.

    Trabajar con medias (ponderadas por cuántas celdas-día las forman) evita que los muchos
    casos con n = 1 y los pocos incendios enormes dominen el ajuste. Devuelve None si no
    hay al menos dos intensidades distintas con respuesta positiva.
    """
    by_intensity = excess.groupby(n).agg(["mean", "size"])
    by_intensity = by_intensity.loc[by_intensity["mean"] > 0]
    if len(by_intensity) < 2:
        return None
    exponent, log_coefficient = np.polyfit(
        np.log(by_intensity.index.to_numpy(dtype="float64")),
        np.log(by_intensity["mean"].to_numpy()),
        deg=1,
        w=np.sqrt(by_intensity["size"].to_numpy(dtype="float64")),
    )
    if exponent <= 0:
        return None
    return float(np.exp(log_coefficient)), float(exponent)


def local_factors(group_loci: pd.DataFrame, active: pd.DataFrame, settings: HarmonizationSettings) -> pd.DataFrame:
    """Corrección de la respuesta por celda de calibración y mes, atraída hacia 1.

    Cubre toda celda y mes donde el grupo detectó fuego alguna vez; donde no hubo datos en
    el período común la corrección queda en 1.
    """
    cells = group_loci[_CELL_MONTH].drop_duplicates().set_index(_CELL_MONTH).sort_index()
    observed = active.assign(excess=active["excess"].clip(lower=0)).groupby(_CELL_MONTH)
    cells["predicted_loci"] = observed["predicted"].sum()
    cells["reference_loci"] = observed["excess"].sum()
    cells = cells.fillna(0.0)

    strength, deviation = settings.calibration_prior_strength, settings.calibration_max_deviation
    ratio = (cells["reference_loci"] + strength) / (cells["predicted_loci"] + strength)
    cells["ratio"] = ratio.clip(lower=1 / deviation, upper=deviation).round(4)
    cells[["predicted_loci", "reference_loci"]] = cells[["predicted_loci", "reference_loci"]].round(2)
    return cells.reset_index().rename(columns={"calibration_cell": "h3_cell"})


def _concat(frames: list[pd.DataFrame], columns: list[str]) -> pd.DataFrame:
    if not frames:
        return pd.DataFrame(columns=columns)
    return pd.concat(frames, ignore_index=True)[columns]
