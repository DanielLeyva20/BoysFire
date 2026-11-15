"""Paso 9 · Validación: ¿la serie armonizada se parece a la referencia donde se puede comprobar?"""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import REFERENCE_GROUP, SourceGroup
from boysfire.harmonize.series import RegionSeries

# Años completos de cada era, para medir el "salto falso" al entrar VIIRS en 2012.
MODIS_ERA_YEARS = (2003, 2011)
VIIRS_ERA_YEARS = (2013, 2021)

# Percentiles diarios que se comparan: día tranquilo, día fuerte y día extremo.
_DAILY_PERCENTILES = (50, 90, 99)
_MIN_DAYS = 60


def calibration_fit(
    series: RegionSeries,
    region_id: int,
    calibrated_groups: set[SourceGroup],
    group_days: dict[SourceGroup, pd.DatetimeIndex],
    settings: HarmonizationSettings,
) -> dict[str, float]:
    """Compara la estimación de cada grupo con la referencia en los días en que ambos observaron.

    ``fit`` usa los años con los que se calibró; ``holdout`` los años posteriores, que la
    calibración no vio: es la comprobación honesta. Se mide el acuerdo mensual, el diario y
    si la distribución de días (tranquilos, fuertes, extremos) coincide.
    """
    metrics: dict[str, float] = {}
    reference_days = group_days.get(REFERENCE_GROUP, pd.DatetimeIndex([]))
    for group in sorted(calibrated_groups - {REFERENCE_GROUP}):
        common = group_days[group].intersection(reference_days)
        periods = {"fit": common}
        if group in settings.calibration_end:
            cutoff = pd.Timestamp(settings.calibration_end[group])
            periods = {"fit": common[common <= cutoff], "holdout": common[common > cutoff]}

        for label, days in periods.items():
            if len(days) < _MIN_DAYS:
                continue
            estimate = series.for_group(region_id, group, days)
            reference = series.for_group(region_id, REFERENCE_GROUP, days)
            if reference.sum() <= 0:
                continue
            prefix = f"validation.{group.name}.{label}"
            metrics[f"{prefix}.days"] = float(len(days))
            metrics[f"{prefix}.monthly_correlation"] = float(
                _monthly_totals(estimate).corr(_monthly_totals(reference))
            )
            metrics[f"{prefix}.daily_correlation"] = float(estimate.corr(reference))
            metrics[f"{prefix}.daily_mean_abs_error"] = float((estimate - reference).abs().mean())
            metrics[f"{prefix}.total_bias_pct"] = float((estimate.sum() / reference.sum() - 1) * 100)
            for percentile in _DAILY_PERCENTILES:
                expected = reference.quantile(percentile / 100)
                if expected > 0:
                    metrics[f"{prefix}.daily_p{percentile}_bias_pct"] = float(
                        (estimate.quantile(percentile / 100) / expected - 1) * 100
                    )
    return metrics


def _monthly_totals(daily: pd.Series) -> pd.Series:
    return daily.groupby(daily.index.to_period("M")).sum()


def sensor_jump(national_activity: pd.DataFrame, official_national: pd.Series) -> dict[str, float]:
    """Cuánto "sube" el fuego entre la era MODIS y la era VIIRS, con y sin armonizar.

    Sin armonizar, el promedio anual se multiplica solo porque entró un sensor más
    sensible. Armonizada, la razón debe quedar cerca de 1.
    """
    raw_per_year = national_activity.groupby(national_activity["activity_date"].dt.year)["detection_count"].sum()
    harmonized_per_year = official_national.groupby(official_national.index.year).sum()

    def era_mean(per_year: pd.Series, era: tuple[int, int]) -> float:
        return float(per_year.reindex(range(era[0], era[1] + 1)).mean())

    metrics: dict[str, float] = {}
    for name, per_year in (("raw", raw_per_year), ("harmonized", harmonized_per_year)):
        before, after = era_mean(per_year, MODIS_ERA_YEARS), era_mean(per_year, VIIRS_ERA_YEARS)
        if before > 0:
            metrics[f"jump.{name}.viirs_era_over_modis_era"] = after / before
    return metrics
