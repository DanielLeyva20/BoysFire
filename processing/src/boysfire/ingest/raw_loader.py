"""Carga de los archivos de FIRMS a ``ingest.raw_hotspot`` (sin transformar)."""
from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import pyodbc

from boysfire.db.connection import transaction
from boysfire.db.ingest_repository import BatchInfo, IngestRepository
from boysfire.ingest import firms_api, firms_files

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestReport:
    files_found: int
    files_loaded: int
    rows_loaded: int


def load_raw_files(connection: pyodbc.Connection, raw_data_dir: Path) -> IngestReport:
    """Carga cada CSV nuevo de los .zip descargados. Los ya cargados se omiten por su hash."""
    files = firms_files.discover(raw_data_dir)
    if not files:
        logger.warning("No hay archivos .zip de FIRMS en %s", raw_data_dir)
    sources = ((item.source_name, item.data_kind, item.read_bytes()) for item in files)
    return _load_all(connection, sources, len(files))


RowFilter = Callable[[pd.DataFrame], pd.DataFrame]


def load_api_downloads(
    connection: pyodbc.Connection, downloads: list[firms_api.FirmsDownload], row_filter: RowFilter | None = None
) -> IngestReport:
    """Carga las respuestas de la API casi en tiempo real (siempre datos NRT)."""
    sources = ((download.source_name, "NRT", download.content) for download in downloads)
    return _load_all(connection, sources, len(downloads), row_filter)


def _load_all(
    connection: pyodbc.Connection,
    sources: Iterable[tuple[str, str, bytes]],
    found: int,
    row_filter: RowFilter | None = None,
) -> IngestReport:
    """Cada contenido nuevo se guarda en su propia transacción; uno repetido se omite por su hash.

    Las descargas de la API se solapan (piden los últimos días): los focos repetidos se
    descartan después, en la limpieza de la armonización.
    """
    repository = IngestRepository(connection)
    already_loaded = repository.loaded_hashes()
    files_loaded = rows_loaded = 0
    for source_name, data_kind, content in sources:
        content_hash = firms_files.sha256_of(content)
        if content_hash in already_loaded:
            logger.info("Ya cargado, se omite: %s", source_name)
            continue
        rows = firms_files.parse(content)
        if row_filter is not None:
            rows = row_filter(rows)
        batch = BatchInfo(
            source_name=source_name,
            content_sha256=content_hash,
            data_kind=data_kind,
            row_count=len(rows),
            min_acq_date=None if rows.empty else rows["acq_date"].min().date(),
            max_acq_date=None if rows.empty else rows["acq_date"].max().date(),
        )
        with transaction(connection) as cursor:
            # Una respuesta sin focos también se registra: prueba que se consultó y no había nada.
            inserted = repository.insert_batch(cursor, batch, rows)
        already_loaded.add(content_hash)
        files_loaded += 1
        rows_loaded += inserted
        logger.info("Cargado %s: %d filas", source_name, inserted)
    return IngestReport(files_found=found, files_loaded=files_loaded, rows_loaded=rows_loaded)

