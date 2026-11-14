"""Armonización completa: de focos crudos a las tablas del esquema ``fire``.

Función pura (DataFrames de entrada y de salida, sin base de datos) para poder probarla.
"""
from __future__ import annotations

import logging

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import SourceGroup
from boysfire.harmonize import aggregation, calibration, cleaning, climatology, coverage, grid, loci, validation
from boysfire.harmonize.normalization import normalize
from boysfire.harmonize.result import HarmonizationResult

logger = logging.getLogger(__name__)

_HOTSPOT_COLUMNS = [
    "hotspot_id", "satellite_id", "confidence_level_id", "acq_datetime_utc",
    "latitude", "longitude", "is_daytime", "frp_mw", "scan_km", "track_km", "h3_cell",
]


def harmonize(raw: pd.DataFrame, settings: HarmonizationSettings, country_region_id: int) -> HarmonizationResult:
    logger.info("1/9 Normalizando %d focos crudos", len(raw))
    normalized, metrics = normalize(raw, settings)

    logger.info("2/9 Asignando celdas H3")
    gridded = grid.assign_cells(normalized, settings)

    logger.info("3/9 Limpiando")
    hotspots, clean_metrics = cleaning.clean(gridded, settings)
    metrics |= clean_metrics

    logger.info("4/9 Calculando cobertura de cada satélite")
    # Con todos los focos válidos (también fuentes fijas): prueban que el satélite observaba.
    satellite_days = coverage.satellite_observing_days(normalized[["satellite_id", "activity_date"]], settings)
    group_days = coverage.group_available_days(satellite_days)

    logger.info("5/9 Deduplicando en la grilla común")
    active_loci = loci.build_loci(hotspots, group_days, settings)

    logger.info("6/9 Calibrando contra VIIRS S-NPP")
    baseline, factors = calibration.calibrate(active_loci, group_days, settings)
    observation_days = coverage.select_daily_source(group_days, calibration.calibrated_groups(baseline))

    logger.info("7/9 Agregando actividad diaria")
    loci_with_ratio = aggregation.attach_ratio(active_loci, factors)
    # Por ahora la única región es el país. Los departamentos, provincias y distritos
    # se añadirán asignando region_id a cada celda locus.
    region_loci = loci_with_ratio.assign(region_id=country_region_id)
    region_hotspots = hotspots.assign(region_id=country_region_id)

    cell_activity = aggregation.activity_by(hotspots, "map_cell", "h3_cell", settings)
    cell_harmonized = aggregation.harmonized_by(loci_with_ratio, "map_cell", "h3_cell")
    region_activity = aggregation.activity_by(region_hotspots, "region_id", "region_id", settings)
    region_harmonized = aggregation.harmonized_by(region_loci, "region_id", "region_id")

    logger.info("8/9 Calculando climatología y umbrales críticos")
    official = aggregation.official_series(region_harmonized, observation_days)
    region_climatology = climatology.build_climatology(official, settings)

    logger.info("9/9 Validando")
    metrics |= validation.calibration_fit(region_harmonized, group_days, settings)
    metrics |= validation.sensor_jump(region_activity, official)
    metrics["rows.loci"] = float(len(active_loci))
    for group_id, days in observation_days.groupby("source_group_id")["activity_date"]:
        metrics[f"observation_days.{SourceGroup(group_id).name}"] = float(len(days))

    return HarmonizationResult(
        grid_cells=grid.build_grid_cells(hotspots, settings),
        hotspots=hotspots.sort_values(["activity_date", "hotspot_id"])[_HOTSPOT_COLUMNS],
        observation_days=observation_days,
        calibration_baseline=baseline,
        calibration_factors=factors,
        daily_cell_activity=cell_activity,
        daily_cell_harmonized=cell_harmonized,
        daily_region_activity=region_activity,
        daily_region_harmonized=region_harmonized,
        region_climatology=region_climatology,
        metrics=metrics,
    )
