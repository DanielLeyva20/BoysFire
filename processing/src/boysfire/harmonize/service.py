"""Armonización completa: de focos crudos a las tablas del esquema ``fire``.

Función pura (DataFrames de entrada y de salida, sin base de datos) para poder probarla.
"""
from __future__ import annotations

import logging
from collections.abc import Callable

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import SourceGroup
from boysfire.harmonize import aggregation, calibration, cleaning, climatology, coverage, grid, loci, validation
from boysfire.harmonize.normalization import normalize
from boysfire.harmonize.result import HarmonizationResult
from boysfire.harmonize.series import RegionSeries
from boysfire.regions.catalog import RegionCatalog

logger = logging.getLogger(__name__)

_HOTSPOT_COLUMNS = [
    "hotspot_id", "satellite_id", "confidence_level_id", "acq_datetime_utc",
    "latitude", "longitude", "is_daytime", "frp_mw", "scan_km", "track_km", "h3_cell",
]


def harmonize(raw: pd.DataFrame, settings: HarmonizationSettings, regions: RegionCatalog) -> HarmonizationResult:
    logger.info("1/10 Normalizando %d focos crudos", len(raw))
    normalized, metrics = normalize(raw, settings)

    logger.info("2/10 Asignando celdas H3")
    gridded = grid.assign_cells(normalized, settings)

    logger.info("3/10 Limpiando")
    hotspots, clean_metrics = cleaning.clean(gridded, settings)
    metrics |= clean_metrics

    logger.info("4/10 Ubicando cada celda en su distrito, provincia y departamento")
    grid_cells = grid.build_grid_cells(hotspots, settings)
    locus_cells = grid_cells.loc[grid_cells["resolution"] == settings.locus_resolution].set_index("h3_index")
    cell_regions = regions.locate(
        locus_cells.rename(columns={"center_latitude": "latitude", "center_longitude": "longitude"})
    )
    finest_level = cell_regions.columns[-1]
    grid_cells["region_id"] = grid_cells["h3_index"].map(cell_regions[finest_level]).astype("Int64")
    metrics["cells.without_district"] = float(cell_regions[finest_level].isna().sum())

    logger.info("5/10 Calculando cobertura de cada satélite")
    # Con todos los focos válidos (también fuentes fijas): prueban que el satélite observaba.
    satellite_days = coverage.satellite_observing_days(normalized[["satellite_id", "activity_date"]], settings)
    group_days = coverage.group_available_days(satellite_days)

    logger.info("6/10 Deduplicando en la grilla común")
    active_loci = loci.build_loci(hotspots, group_days, settings)

    logger.info("7/10 Calibrando contra VIIRS S-NPP")
    calibrated = calibration.calibrate(active_loci, group_days, settings)
    observation_days = coverage.select_daily_source(group_days, calibrated.groups)

    logger.info("8/10 Agregando actividad diaria por celda y por región")
    weighted_loci = aggregation.attach_weight(active_loci, calibrated)
    cell_activity = aggregation.activity_by(hotspots, "map_cell", "h3_cell", settings)
    cell_detected = aggregation.detected_by(weighted_loci, "map_cell", "h3_cell")
    cell_background = aggregation.background_by(calibrated.background_rates, "map_cell", "h3_cell")

    region_activity = _by_region_level(
        hotspots, cell_regions, lambda rows: aggregation.activity_by(rows, "region_id", "region_id", settings)
    )
    region_detected = _by_region_level(
        weighted_loci, cell_regions, lambda rows: aggregation.detected_by(rows, "region_id", "region_id")
    )
    region_background = _by_region_level(
        calibrated.background_rates, cell_regions,
        lambda rows: aggregation.background_by(rows, "region_id", "region_id"),
    )

    logger.info("9/10 Calculando climatología y umbrales críticos de %d regiones", region_detected["region_id"].nunique())
    series = RegionSeries(region_detected, region_background, calibrated.background_scale, observation_days)
    region_climatology = climatology.build_climatology(series.official_by_region(), settings)

    logger.info("10/10 Validando")
    country = regions.country_id
    metrics |= validation.calibration_fit(series, country, calibrated.groups, group_days, settings)
    metrics |= validation.sensor_jump(
        region_activity.loc[region_activity["region_id"] == country], series.official(country)
    )
    metrics["rows.loci"] = float(len(active_loci))
    for group_id, days in observation_days.groupby("source_group_id")["activity_date"]:
        metrics[f"observation_days.{SourceGroup(group_id).name}"] = float(len(days))

    return HarmonizationResult(
        grid_cells=grid_cells,
        hotspots=hotspots.sort_values(["activity_date", "hotspot_id"])[_HOTSPOT_COLUMNS],
        observation_days=observation_days,
        calibration_response=calibrated.response,
        calibration_factors=calibrated.factors,
        daily_background_scale=calibrated.background_scale,
        background_cell_rates=cell_background,
        background_region_rates=region_background,
        daily_cell_activity=cell_activity,
        daily_cell_harmonized=cell_detected,
        daily_region_activity=region_activity,
        daily_region_harmonized=region_detected,
        region_climatology=region_climatology,
        metrics=metrics,
    )


def _by_region_level(
    rows: pd.DataFrame, cell_regions: pd.DataFrame, aggregate: Callable[[pd.DataFrame], pd.DataFrame]
) -> pd.DataFrame:
    """Aplica ``aggregate`` una vez por nivel administrativo y une los resultados.

    ``rows`` debe tener la celda locus en ``h3_cell``; a cada fila se le pone el ``region_id``
    de su celda en ese nivel. Las filas fuera de todo distrito solo cuentan para el país.
    """
    parts = []
    for level in cell_regions.columns:
        region_id = rows["h3_cell"].map(cell_regions[level])
        located = rows.assign(region_id=region_id).dropna(subset=["region_id"])
        parts.append(aggregate(located.astype({"region_id": "int64"})))
    return pd.concat(parts, ignore_index=True)
