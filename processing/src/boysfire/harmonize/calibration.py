"""Paso 6 · Calibración: cuánto hay que multiplicar cada grupo para igualar a la referencia.

Se mide en el período en que el grupo y la referencia (VIIRS S-NPP) observaron a la vez:

    factor = celdas activas de la referencia / celdas activas del grupo

por celda de calibración (r4) y mes del año, porque la diferencia entre sensores cambia
con el tipo de fuego (quemas pequeñas en la sierra, incendios grandes en la Amazonía) y
con la temporada. Donde hay pocas muestras el factor se acerca al nacional del mes
(contracción bayesiana), de modo que una celda con dos datos no produzca un factor absurdo.
"""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import REFERENCE_GROUP, SourceGroup

BASELINE_COLUMNS = ["source_group_id", "month_of_year", "source_loci", "reference_loci", "ratio"]
FACTOR_COLUMNS = ["source_group_id", "h3_cell", "month_of_year", "source_loci", "reference_loci", "ratio"]

_MONTHS = pd.RangeIndex(1, 13, name="month_of_year")


def shrunk_ratio(reference: pd.Series, source: pd.Series, prior_ratio: pd.Series | float, strength: float) -> pd.Series:
    """Razón referencia/grupo, atraída hacia ``prior_ratio`` con un peso de ``strength`` muestras."""
    return (reference + strength * prior_ratio) / (source + strength)


def calibrate(
    loci: pd.DataFrame,
    group_days: dict[SourceGroup, pd.DatetimeIndex],
    settings: HarmonizationSettings,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Devuelve (factores nacionales por mes, factores por celda y mes) de cada grupo calibrable."""
    loci = loci.assign(month_of_year=loci["activity_date"].dt.month)
    reference_loci = loci.loc[loci["source_group_id"] == int(REFERENCE_GROUP)]
    reference_days = group_days.get(REFERENCE_GROUP, pd.DatetimeIndex([]))

    baselines, factors = [], []
    for group, days in group_days.items():
        if group is REFERENCE_GROUP:
            continue
        overlap = days.intersection(reference_days)
        if group in settings.calibration_end:
            overlap = overlap[overlap <= pd.Timestamp(settings.calibration_end[group])]

        group_loci = loci.loc[loci["source_group_id"] == int(group)]
        source = group_loci.loc[group_loci["activity_date"].isin(overlap)]
        reference = reference_loci.loc[reference_loci["activity_date"].isin(overlap)]
        if source.empty or reference.empty:
            continue   # sin período común no se puede calibrar: el grupo no se usa

        # Nacional por mes, atraído hacia la razón global para los meses con pocos datos.
        national = pd.DataFrame(
            {
                "source_loci": source.groupby("month_of_year").size().reindex(_MONTHS, fill_value=0),
                "reference_loci": reference.groupby("month_of_year").size().reindex(_MONTHS, fill_value=0),
            }
        )
        overall_ratio = len(reference) / len(source)
        national["ratio"] = shrunk_ratio(
            national["reference_loci"], national["source_loci"], overall_ratio,
            settings.calibration_prior_strength,
        )

        # Por celda y mes, para toda celda donde el grupo detectó fuego alguna vez.
        keys = ["calibration_cell", "month_of_year"]
        cells = group_loci[keys].drop_duplicates().set_index(keys).sort_index()
        cells["source_loci"] = source.groupby(keys).size()
        cells["reference_loci"] = reference.groupby(keys).size()
        cells = cells.fillna(0).astype("int64").reset_index()

        prior = cells["month_of_year"].map(national["ratio"])
        ratio = shrunk_ratio(
            cells["reference_loci"], cells["source_loci"], prior, settings.calibration_prior_strength
        )
        deviation = settings.calibration_max_deviation
        cells["ratio"] = ratio.clip(lower=prior / deviation, upper=prior * deviation)

        baselines.append(national.reset_index().assign(source_group_id=int(group)))
        factors.append(cells.rename(columns={"calibration_cell": "h3_cell"}).assign(source_group_id=int(group)))

    if not baselines:
        return pd.DataFrame(columns=BASELINE_COLUMNS), pd.DataFrame(columns=FACTOR_COLUMNS)
    baseline = pd.concat(baselines, ignore_index=True)[BASELINE_COLUMNS]
    factor = pd.concat(factors, ignore_index=True)[FACTOR_COLUMNS]
    baseline["ratio"] = baseline["ratio"].round(4)
    factor["ratio"] = factor["ratio"].round(4)
    return baseline, factor


def calibrated_groups(baseline: pd.DataFrame) -> set[SourceGroup]:
    """Grupos que pueden alimentar la serie: la referencia y los que tienen factor."""
    return {REFERENCE_GROUP} | {SourceGroup(value) for value in baseline["source_group_id"].unique()}
