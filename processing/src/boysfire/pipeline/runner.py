"""Orquestación: une la lectura de archivos, la armonización y la base de datos."""
from __future__ import annotations

import logging
import time

from boysfire.config import Settings
from boysfire.db.catalog_repository import CatalogRepository
from boysfire.db.connection import connect
from boysfire.db.fire_repository import FireRepository
from boysfire.db.ingest_repository import IngestRepository
from boysfire.db.region_repository import RegionRepository
from boysfire.db.run_repository import RunRepository
from boysfire.harmonize.service import harmonize
from boysfire.ingest import firms_api
from boysfire.ingest.peru_filter import PeruFilter
from boysfire.ingest.raw_loader import IngestReport, load_api_downloads, load_raw_files
from boysfire.regions import boundaries

logger = logging.getLogger(__name__)


def run_ingest(settings: Settings) -> IngestReport:
    """Carga a la base los archivos de FIRMS que aún no estén cargados."""
    connection = connect(settings.database)
    try:
        CatalogRepository(connection).verify()
        report = load_raw_files(connection, settings.raw_data_dir)
        logger.info(
            "Ingesta: %d archivos encontrados, %d nuevos, %d filas cargadas",
            report.files_found, report.files_loaded, report.rows_loaded,
        )
        return report
    finally:
        connection.close()


def run_nrt(settings: Settings) -> IngestReport:
    """Trae de la API de FIRMS los focos recientes de Perú y, si hay nuevos, vuelve a armonizar."""
    if not settings.firms_map_key:
        raise RuntimeError("Falta FIRMS_MAP_KEY en el .env. Pide una gratis en https://firms.modaps.eosdis.nasa.gov/api/map_key/")
    downloads = []
    for source in firms_api.NRT_SOURCES:
        try:
            downloads.append(firms_api.fetch(settings.firms_map_key, source, settings.firms_day_range))
        except firms_api.FirmsApiError as error:
            logger.warning("%s", error)
    if not downloads:
        raise RuntimeError("Ninguna fuente de FIRMS respondió. Revisa la clave y la conexión.")

    connection = connect(settings.database)
    try:
        CatalogRepository(connection).verify()
        peru_filter = PeruFilter(RegionRepository(connection).read_catalog(), IngestRepository(connection))
        report = load_api_downloads(connection, downloads, peru_filter)
        stale = RunRepository(connection).harmonization_is_stale()
    finally:
        connection.close()
    logger.info("FIRMS: %d respuestas nuevas, %d focos cargados", report.files_loaded, report.rows_loaded)
    if report.rows_loaded > 0 or stale:
        run_harmonize(settings)
    else:
        logger.info("Sin focos nuevos ni armonización pendiente.")
    return report


def run_regions(settings: Settings) -> int:
    """Carga (o actualiza) los límites de departamentos, provincias y distritos."""
    boundaries.download_missing(settings.boundaries_dir)
    regions = boundaries.read_boundaries(settings.boundaries_dir)
    connection = connect(settings.database)
    try:
        CatalogRepository(connection).verify()
        saved = RegionRepository(connection).upsert(regions)
        logger.info("Regiones guardadas: %s", regions.groupby("region_level_id").size().to_dict())
        return saved
    finally:
        connection.close()


def run_harmonize(settings: Settings) -> dict[str, float]:
    """Reconstruye todo el modelo armonizado a partir de los focos crudos."""
    connection = connect(settings.database)
    try:
        CatalogRepository(connection).verify()
        regions = RegionRepository(connection).read_catalog()
        if regions.districts.empty:
            logger.warning("No hay distritos cargados: solo habrá datos a nivel país. Ejecuta 'boysfire regions'.")
        runs = RunRepository(connection)
        run_id = runs.start()
        started = time.perf_counter()
        try:
            logger.info("Leyendo focos crudos de la base")
            raw = IngestRepository(connection).read_raw_hotspots()
            if raw.empty:
                raise RuntimeError("No hay focos crudos. Ejecuta primero la ingesta.")
            result = harmonize(raw, settings.harmonization, regions)
            logger.info("Guardando el modelo armonizado")
            FireRepository(connection).replace_all(result)
        except BaseException as error:
            connection.rollback()
            runs.fail(run_id, error)
            raise
        metrics = dict(result.metrics)
        metrics["duration_seconds"] = time.perf_counter() - started
        runs.finish(run_id, metrics)
        logger.info("Armonización terminada en %.0f s (ejecución #%d)", metrics["duration_seconds"], run_id)
        return metrics
    finally:
        connection.close()
