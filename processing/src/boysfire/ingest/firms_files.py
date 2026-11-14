"""Lectura de las descargas de archivo de NASA FIRMS (un .zip con CSV dentro)."""
from __future__ import annotations

import hashlib
import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from boysfire.db.ingest_repository import RAW_COLUMNS

# El CSV NRT no trae la columna "type"; el resto es obligatorio.
_OPTIONAL_COLUMNS = frozenset({"type"})
_TEXT_COLUMNS = ("acq_time", "satellite", "instrument", "confidence", "version", "daynight")


@dataclass(frozen=True)
class FirmsFile:
    """Un CSV dentro de un .zip descargado de FIRMS."""

    archive_path: Path
    member_name: str

    @property
    def source_name(self) -> str:
        return f"{self.archive_path.name}/{self.member_name}"

    @property
    def data_kind(self) -> str:
        """FIRMS nombra los CSV ``fire_archive_*`` (ciencia) o ``fire_nrt_*`` (tiempo casi real)."""
        return "NRT" if "_nrt_" in self.member_name.lower() else "ARCHIVE"

    def read_bytes(self) -> bytes:
        with zipfile.ZipFile(self.archive_path) as archive:
            return archive.read(self.member_name)


def discover(raw_data_dir: Path) -> list[FirmsFile]:
    """Encuentra todos los CSV dentro de los .zip de ``raw_data_dir`` (recursivo)."""
    files: list[FirmsFile] = []
    for archive_path in sorted(raw_data_dir.rglob("*.zip")):
        with zipfile.ZipFile(archive_path) as archive:
            for member_name in sorted(archive.namelist()):
                if member_name.lower().endswith(".csv"):
                    files.append(FirmsFile(archive_path, member_name))
    return files


def sha256_of(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def parse(content: bytes) -> pd.DataFrame:
    """Convierte el CSV en un DataFrame con las columnas de ``ingest.raw_hotspot``."""
    frame = pd.read_csv(io.BytesIO(content), dtype={name: "string" for name in _TEXT_COLUMNS})

    missing = set(RAW_COLUMNS) - set(frame.columns) - _OPTIONAL_COLUMNS
    if missing:
        raise ValueError(f"Al CSV de FIRMS le faltan columnas: {sorted(missing)}")
    for name in _OPTIONAL_COLUMNS - set(frame.columns):
        frame[name] = pd.NA

    frame["acq_date"] = pd.to_datetime(frame["acq_date"], format="%Y-%m-%d")
    frame["acq_time"] = frame["acq_time"].str.zfill(4)
    frame["type"] = pd.to_numeric(frame["type"], errors="coerce").astype("Int64")
    return frame.loc[:, list(RAW_COLUMNS)]
