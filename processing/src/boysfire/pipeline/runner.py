"""Orquestación: une la lectura de archivos, la armonización y la base de datos."""
from __future__ import annotations

import logging
import time

from boysfire.config import Settings
from boysfire.db.catalog_repository import CatalogRepository
from boysfire.db.connection import connect
from boysfire.db.fire_repository import FireRepository
from boysfire.db.ingest_repository import IngestRepository
from boysfire.db.run_repository import RunRepository
from boysfire.harmonize.service import harmonize
from boysfire.ingest.raw_loader import IngestReport, load_raw_files

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


def run_harmonize(settings: Settings) -> dict[str, float]:
    """Reconstruye todo el modelo armonizado a partir de los focos crudos."""
    connection = connect(settings.database)
    try:
        catalogs = CatalogRepository(connection)
        catalogs.verify()
        runs = RunRepository(connection)
        run_id = runs.start()
        started = time.perf_counter()
        try:
            logger.info("Leyendo focos crudos de la base")
            raw = IngestRepository(connection).read_raw_hotspots()
            if raw.empty:
                raise RuntimeError("No hay focos crudos. Ejecuta primero la ingesta.")
            result = harmonize(raw, settings.harmonization, catalogs.country_region_id())
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
