"""Paso 9 · Validación: ¿la serie armonizada se parece a la referencia donde se puede comprobar?"""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import REFERENCE_GROUP, SourceGroup

# Años completos de cada era, para medir el "salto falso" al entrar VIIRS en 2012.
MODIS_ERA_YEARS = (2003, 2011)
VIIRS_ERA_YEARS = (2013, 2021)


def _monthly_totals(region_harmonized: pd.DataFrame, group: SourceGroup, days: pd.DatetimeIndex) -> pd.Series:
    rows = region_harmonized.loc[
        (region_harmonized["source_group_id"] == int(group)) & region_harmonized["activity_date"].isin(days)
    ]
    totals = rows.groupby(rows["activity_date"].dt.to_period("M"))["harmonized_index"].sum()
    return totals.reindex(days.to_period("M").unique(), fill_value=0.0)


def calibration_fit(
    national_harmonized: pd.DataFrame,
    group_days: dict[SourceGroup, pd.DatetimeIndex],
    settings: HarmonizationSettings,
) -> dict[str, float]:
    """Compara, mes a mes, la estimación de cada grupo con la referencia en los días comunes.

    ``fit`` usa los años con los que se calibró; ``holdout`` los años posteriores, que
    el factor no vio: es la comprobación honesta.
    """
    metrics: dict[str, float] = {}
    reference_days = group_days.get(REFERENCE_GROUP, pd.DatetimeIndex([]))
    for group in national_harmonized["source_group_id"].unique():
        group = SourceGroup(group)
        if group is REFERENCE_GROUP:
            continue
        common = group_days[group].intersection(reference_days)
        periods = {"fit": common}
        if group in settings.calibration_end:
            cutoff = pd.Timestamp(settings.calibration_end[group])
            periods = {"fit": common[common <= cutoff], "holdout": common[common > cutoff]}

        for label, days in periods.items():
            if days.empty:
                continue
            estimate = _monthly_totals(national_harmonized, group, days)
            reference = _monthly_totals(national_harmonized, REFERENCE_GROUP, days)
            if reference.sum() <= 0 or len(estimate) < 3:
                continue
            prefix = f"validation.{group.name}.{label}"
            metrics[f"{prefix}.months"] = float(len(estimate))
            metrics[f"{prefix}.monthly_correlation"] = float(estimate.corr(reference))
            metrics[f"{prefix}.total_bias_pct"] = float((estimate.sum() / reference.sum() - 1) * 100)
    return metrics


def sensor_jump(national_activity: pd.DataFrame, official_national: pd.DataFrame) -> dict[str, float]:
    """Cuánto "sube" el fuego entre la era MODIS y la era VIIRS, con y sin armonizar.

    Sin armonizar, el promedio anual se multiplica solo porque entró un sensor más
    sensible. Armonizada, la razón debe quedar cerca de 1.
    """
    raw_per_year = national_activity.groupby(national_activity["activity_date"].dt.year)["detection_count"].sum()
    harmonized_per_year = official_national.groupby(official_national["activity_date"].dt.year)[
        "harmonized_index"
    ].sum()

    def era_mean(per_year: pd.Series, era: tuple[int, int]) -> float:
        return float(per_year.reindex(range(era[0], era[1] + 1)).mean())

    metrics: dict[str, float] = {}
    for name, per_year in (("raw", raw_per_year), ("harmonized", harmonized_per_year)):
        before, after = era_mean(per_year, MODIS_ERA_YEARS), era_mean(per_year, VIIRS_ERA_YEARS)
        if before > 0:
            metrics[f"jump.{name}.viirs_era_over_modis_era"] = after / before
    return metrics
