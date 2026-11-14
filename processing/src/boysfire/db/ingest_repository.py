"""Acceso a las tablas de aterrizaje (esquema ``ingest``)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd
import pyodbc

from boysfire.db.bulk import insert_frame

RAW_COLUMNS: tuple[str, ...] = (
    "latitude", "longitude", "brightness", "scan", "track", "acq_date", "acq_time",
    "satellite", "instrument", "confidence", "version", "bright_t31", "frp", "daynight", "type",
)

_READ_CHUNK_ROWS = 250_000

# Los DECIMAL se leen como FLOAT para que pandas reciba números y no objetos Decimal.
_READ_RAW_SQL = """
SELECT raw_hotspot_id,
       CAST(latitude AS FLOAT)  AS latitude,
       CAST(longitude AS FLOAT) AS longitude,
       acq_date,
       acq_time,
       satellite,
       confidence,
       CAST(frp AS FLOAT)   AS frp,
       CAST(scan AS FLOAT)  AS scan,
       CAST(track AS FLOAT) AS track,
       daynight,
       CAST(type AS FLOAT)  AS type
FROM ingest.raw_hotspot
"""


@dataclass(frozen=True)
class BatchInfo:
    source_name: str
    content_sha256: str
    data_kind: str
    row_count: int
    min_acq_date: date | None
    max_acq_date: date | None


class IngestRepository:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def loaded_hashes(self) -> set[str]:
        cursor = self._connection.cursor()
        try:
            cursor.execute("SELECT content_sha256 FROM ingest.ingest_batch")
            return {row[0] for row in cursor.fetchall()}
        finally:
            cursor.close()

    def insert_batch(self, cursor: pyodbc.Cursor, batch: BatchInfo, rows: pd.DataFrame) -> int:
        """Registra el lote y sus filas crudas. Debe llamarse dentro de una transacción."""
        cursor.execute(
            """
            INSERT INTO ingest.ingest_batch
                (source_name, content_sha256, data_kind, row_count, min_acq_date, max_acq_date)
            OUTPUT INSERTED.batch_id
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            batch.source_name, batch.content_sha256, batch.data_kind,
            batch.row_count, batch.min_acq_date, batch.max_acq_date,
        )
        batch_id = int(cursor.fetchone()[0])
        frame = rows.loc[:, list(RAW_COLUMNS)].copy()
        frame.insert(0, "batch_id", batch_id)
        return insert_frame(cursor, "ingest.raw_hotspot", frame)

    def read_raw_hotspots(self) -> pd.DataFrame:
        """Lee todos los focos crudos con las columnas que necesita la armonización."""
        cursor = self._connection.cursor()
        try:
            cursor.execute(_READ_RAW_SQL)
            names = [column[0] for column in cursor.description]
            chunks: list[pd.DataFrame] = []
            while True:
                rows = cursor.fetchmany(_READ_CHUNK_ROWS)
                if not rows:
                    break
                chunks.append(pd.DataFrame.from_records(rows, columns=names))
        finally:
            cursor.close()
        if not chunks:
            return pd.DataFrame(columns=names)
        return pd.concat(chunks, ignore_index=True)
