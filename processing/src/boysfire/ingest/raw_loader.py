"""Carga de los archivos de FIRMS a ``ingest.raw_hotspot`` (sin transformar)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import pyodbc

from boysfire.db.connection import transaction
from boysfire.db.ingest_repository import BatchInfo, IngestRepository
from boysfire.ingest import firms_files

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestReport:
    files_found: int
    files_loaded: int
    rows_loaded: int


def load_raw_files(connection: pyodbc.Connection, raw_data_dir: Path) -> IngestReport:
    """Carga cada CSV nuevo en su propia transacción. Los ya cargados se omiten por su hash."""
    repository = IngestRepository(connection)
    already_loaded = repository.loaded_hashes()
    files = firms_files.discover(raw_data_dir)
    if not files:
        logger.warning("No hay archivos .zip de FIRMS en %s", raw_data_dir)

    files_loaded = rows_loaded = 0
    for firms_file in files:
        content = firms_file.read_bytes()
        content_hash = firms_files.sha256_of(content)
        if content_hash in already_loaded:
            logger.info("Ya cargado, se omite: %s", firms_file.source_name)
            continue

        rows = firms_files.parse(content)
        batch = BatchInfo(
            source_name=firms_file.source_name,
            content_sha256=content_hash,
            data_kind=firms_file.data_kind,
            row_count=len(rows),
            min_acq_date=None if rows.empty else rows["acq_date"].min().date(),
            max_acq_date=None if rows.empty else rows["acq_date"].max().date(),
        )
        with transaction(connection) as cursor:
            inserted = repository.insert_batch(cursor, batch, rows)
        already_loaded.add(content_hash)
        files_loaded += 1
        rows_loaded += inserted
        logger.info("Cargado %s: %d filas", firms_file.source_name, inserted)

    return IngestReport(files_found=len(files), files_loaded=files_loaded, rows_loaded=rows_loaded)
