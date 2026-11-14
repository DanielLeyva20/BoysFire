"""Bitácora de ejecuciones del pipeline (``ingest.pipeline_run``)."""
from __future__ import annotations

from collections.abc import Mapping

import pyodbc

_MAX_ERROR_CHARS = 2000


class RunRepository:
    def __init__(self, connection: pyodbc.Connection) -> None:
        self._connection = connection

    def start(self) -> int:
        cursor = self._connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO ingest.pipeline_run OUTPUT INSERTED.pipeline_run_id DEFAULT VALUES"
            )
            run_id = int(cursor.fetchone()[0])
            self._connection.commit()
            return run_id
        finally:
            cursor.close()

    def finish(self, run_id: int, metrics: Mapping[str, float]) -> None:
        cursor = self._connection.cursor()
        try:
            rows = [(run_id, code[:80], round(float(value), 4)) for code, value in metrics.items()]
            if rows:
                cursor.executemany(
                    "INSERT INTO ingest.pipeline_run_metric (pipeline_run_id, metric_code, metric_value) "
                    "VALUES (?, ?, ?)",
                    rows,
                )
            cursor.execute(
                "UPDATE ingest.pipeline_run SET status = 'SUCCESS', finished_at = SYSUTCDATETIME() "
                "WHERE pipeline_run_id = ?",
                run_id,
            )
            self._connection.commit()
        finally:
            cursor.close()

    def fail(self, run_id: int, error: BaseException) -> None:
        cursor = self._connection.cursor()
        try:
            cursor.execute(
                "UPDATE ingest.pipeline_run SET status = 'FAILED', finished_at = SYSUTCDATETIME(), "
                "error_message = ? WHERE pipeline_run_id = ?",
                f"{type(error).__name__}: {error}"[:_MAX_ERROR_CHARS], run_id,
            )
            self._connection.commit()
        finally:
            cursor.close()
