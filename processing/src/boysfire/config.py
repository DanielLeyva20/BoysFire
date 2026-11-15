"""Configuración: conexión a la base (variables de entorno) y parámetros de armonización."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

from boysfire.domain.catalogs import ConfidenceLevel, Sensor, SourceGroup

# processing/src/boysfire/config.py → raíz del repositorio
PROJECT_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class DatabaseSettings:
    host: str
    port: int
    name: str
    user: str
    password: str
    driver: str = "ODBC Driver 18 for SQL Server"


@dataclass(frozen=True)
class HarmonizationSettings:
    # Perú usa UTC−5 todo el año. La misma constante está en fire.hotspot.acq_date_local.
    utc_offset_hours: int = -5

    # Grilla H3. r8 ≈ 0,7 km² (tamaño de un píxel MODIS), r5 ≈ 250 km², r4 ≈ 1 770 km².
    locus_resolution: int = 8
    map_resolution: int = 5
    calibration_resolution: int = 4

    # Confianza de MODIS (0–100) llevada a la escala de VIIRS.
    modis_nominal_min: int = 30
    modis_high_min: int = 80

    # Solo los focos desde este nivel entran al índice armonizado.
    min_confidence: ConfidenceLevel = ConfidenceLevel.NOMINAL

    # Una celda locus con al menos estas detecciones "no vegetación" en el archivo
    # histórico se trata como fuente fija también en los datos NRT (que no traen tipo).
    static_source_min_detections: int = 3

    # Días seguidos sin ninguna detección en todo el país para considerar que el
    # satélite no estaba observando. MODIS detecta poco en época de lluvias, por eso
    # su umbral es más alto.
    outage_min_days: dict[Sensor, int] = field(
        default_factory=lambda: {Sensor.VIIRS: 3, Sensor.MODIS: 10}
    )

    # Fin del período usado para calibrar cada grupo contra la referencia.
    # MODIS: desde 2022 las órbitas de Terra y Aqua derivan y cambia su hora de paso.
    calibration_end: dict[SourceGroup, date] = field(
        default_factory=lambda: {
            SourceGroup.MODIS: date(2021, 12, 31),
            SourceGroup.AQUA: date(2021, 12, 31),
            SourceGroup.TERRA: date(2021, 12, 31),
        }
    )

    # Ajuste local de la respuesta (por celda de calibración y mes). Con pocas muestras
    # queda cerca de 1; este es el peso, en celdas-día, de ese "1" inicial.
    calibration_prior_strength: float = 50.0
    # El ajuste local no puede corregir más de N veces en ningún sentido.
    calibration_max_deviation: float = 4.0
    # Cuánto sigue el fondo (fuego que el grupo no ve) a la actividad nacional del día:
    # 0 = fondo constante, 1 = proporcional. Elegido comparando con VIIRS real: con 0,5 los
    # días extremos (percentil 99) quedan sin sesgo; valores mayores los exageran y
    # menores los aplastan.
    background_activity_exponent: float = 0.5

    # Climatología: ventana de ± días alrededor de cada día del año.
    climatology_window_days: int = 7


@dataclass(frozen=True)
class Settings:
    database: DatabaseSettings
    raw_data_dir: Path
    boundaries_dir: Path
    harmonization: HarmonizationSettings = field(default_factory=HarmonizationSettings)


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Falta la variable de entorno {name}. Revisa el archivo .env.")
    return value


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env")
    database = DatabaseSettings(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "14330")),
        name=os.environ.get("DB_NAME", "boysfire"),
        user=_required("DB_APP_USER"),
        password=_required("DB_APP_PASSWORD"),
    )
    data_dir = PROJECT_ROOT / "data"
    return Settings(
        database=database,
        raw_data_dir=Path(os.environ.get("RAW_DATA_DIR", data_dir / "raw")),
        boundaries_dir=Path(os.environ.get("BOUNDARIES_DIR", data_dir / "boundaries")),
    )
