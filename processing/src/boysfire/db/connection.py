"""Conexión a SQL Server."""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import pyodbc

from boysfire.config import DatabaseSettings


def connect(settings: DatabaseSettings) -> pyodbc.Connection:
    connection_string = (
        f"DRIVER={{{settings.driver}}};"
        f"SERVER={settings.host},{settings.port};"
        f"DATABASE={settings.name};"
        f"UID={settings.user};PWD={{{settings.password}}};"
        "Encrypt=yes;TrustServerCertificate=yes;"
    )
    return pyodbc.connect(connection_string, autocommit=False)


@contextmanager
def transaction(connection: pyodbc.Connection) -> Iterator[pyodbc.Cursor]:
    """Entrega un cursor; confirma al salir o revierte si algo falla."""
    cursor = connection.cursor()
    try:
        yield cursor
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        cursor.close()
