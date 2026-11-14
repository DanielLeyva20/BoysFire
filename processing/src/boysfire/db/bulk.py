"""Carga masiva de DataFrames.

Cada lote viaja como un solo documento JSON que SQL Server desarma con OPENJSON.
Es un único viaje de red por lote, mucho más rápido que enviar las filas como
parámetros, y no necesita compartir archivos con el servidor.
"""
from __future__ import annotations

import pandas as pd
import pyodbc

DEFAULT_BATCH_ROWS = 100_000

_COLUMN_TYPES_SQL = """
SELECT c.name, t.name, c.max_length, c.precision, c.scale
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(?)
"""


def insert_frame(
    cursor: pyodbc.Cursor,
    table: str,
    frame: pd.DataFrame,
    batch_rows: int = DEFAULT_BATCH_ROWS,
) -> int:
    """Inserta ``frame`` en ``table``. Los nombres de columna deben coincidir con la tabla."""
    if frame.empty:
        return 0
    statement = _insert_statement(table, list(frame.columns), _column_types(cursor, table))
    for start in range(0, len(frame), batch_rows):
        chunk = frame.iloc[start : start + batch_rows]
        # orient="values": una lista de filas, cada fila una lista en el orden de las columnas.
        document = chunk.to_json(orient="values", date_format="iso", date_unit="s", double_precision=10)
        cursor.execute(statement, document)
    return len(frame)


def _column_types(cursor: pyodbc.Cursor, table: str) -> dict[str, str]:
    """Tipo SQL de cada columna de la tabla, tal como hay que declararlo en OPENJSON."""
    cursor.execute(_COLUMN_TYPES_SQL, table)
    types = {name: _declaration(*rest) for name, *rest in cursor.fetchall()}
    if not types:
        raise ValueError(f"La tabla {table} no existe o no tiene columnas visibles.")
    return types


def _declaration(type_name: str, max_length: int, precision: int, scale: int) -> str:
    if type_name in ("decimal", "numeric"):
        return f"{type_name}({precision},{scale})"
    if type_name in ("varchar", "char"):
        return f"{type_name}({'max' if max_length == -1 else max_length})"
    if type_name in ("nvarchar", "nchar"):
        return f"{type_name}({'max' if max_length == -1 else max_length // 2})"
    if type_name in ("datetime2", "time", "datetimeoffset"):
        return f"{type_name}({scale})"
    return type_name


def _insert_statement(table: str, columns: list[str], types: dict[str, str]) -> str:
    unknown = [name for name in columns if name not in types]
    if unknown:
        raise ValueError(f"Columnas que no existen en {table}: {unknown}")
    column_list = ", ".join(f"[{name}]" for name in columns)
    schema = ", ".join(f"[{name}] {types[name]} '$[{position}]'" for position, name in enumerate(columns))
    return f"INSERT INTO {table} ({column_list}) SELECT {column_list} FROM OPENJSON(?) WITH ({schema})"
