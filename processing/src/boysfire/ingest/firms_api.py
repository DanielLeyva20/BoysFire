"""Focos casi en tiempo real desde la API de NASA FIRMS.

Pide la caja que envuelve a Perú (``/api/area/csv/{clave}/{fuente}/{caja}/{días}``). La caja
incluye partes de países vecinos: ``PeruFilter`` descarta esos focos antes de guardarlos.
Los datos llegan unas horas después de cada pasada del satélite.
"""
from __future__ import annotations

import urllib.error
import urllib.request
from dataclasses import dataclass

API_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
PERU_BBOX = "-81.4,-18.4,-68.6,0.5"   # oeste, sur, este, norte
TIMEOUT_SECONDS = 90

# Fuentes casi en tiempo real. S-NPP dejó de enviar datos el 2 de noviembre de 2026 (se sigue
# consultando por si se restablece). NOAA-21 no se consulta: la serie no la tiene calibrada contra
# la referencia y sus focos no se usarían.
NRT_SOURCES: tuple[str, ...] = ("VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "MODIS_NRT")


class FirmsApiError(RuntimeError):
    """La API respondió algo que no es un CSV de focos (clave inválida, límite superado…)."""


@dataclass(frozen=True)
class FirmsDownload:
    source: str
    content: bytes

    @property
    def source_name(self) -> str:
        return f"FIRMS API {self.source} Peru"


def fetch(map_key: str, source: str, day_range: int) -> FirmsDownload:
    """Descarga los focos de los últimos ``day_range`` días (1 a 10) de una fuente."""
    url = f"{API_BASE}/{map_key}/{source}/{PERU_BBOX}/{day_range}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (URL fija, https)
            content = response.read()
    except urllib.error.URLError as error:
        raise FirmsApiError(f"No se pudo conectar con FIRMS ({source}): {redact(str(error), map_key)}") from error

    first_line = content.split(b"\n", 1)[0].decode("utf-8", errors="replace")
    if "latitude" not in first_line:
        raise FirmsApiError(f"FIRMS no devolvió focos para {source}: {redact(first_line[:200], map_key)}")
    return FirmsDownload(source, content)


def redact(text: str, map_key: str) -> str:
    """Quita la clave de un mensaje antes de mostrarlo o registrarlo."""
    return text.replace(map_key, "***") if map_key else text
