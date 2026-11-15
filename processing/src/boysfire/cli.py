"""Línea de comandos: ``python -m boysfire <comando>``."""
from __future__ import annotations

import argparse
import logging
import time

from boysfire.config import load_settings
from boysfire.pipeline import runner

_COMMANDS = {
    "regions": "Descarga y carga los límites de departamentos, provincias y distritos.",
    "ingest": "Carga a la base los .zip de FIRMS que estén en data/raw (omite los ya cargados).",
    "harmonize": "Reconstruye el modelo armonizado a partir de los focos crudos.",
    "run": "Hace las dos cosas: ingest y luego harmonize.",
    "nrt": "Trae de la API de FIRMS los focos recientes de Perú y vuelve a armonizar si hay nuevos.",
    "watch": "Repite 'nrt' cada cierto tiempo (por defecto, cada 180 minutos). Detener con Ctrl+C.",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="boysfire", description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name, help_text in _COMMANDS.items():
        command = subparsers.add_parser(name, help=help_text)
        if name == "watch":
            command.add_argument("--every", type=int, default=180, help="minutos entre consultas (mínimo 15)")
    arguments = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
    settings = load_settings()

    if arguments.command == "nrt":
        runner.run_nrt(settings)
    if arguments.command == "watch":
        _watch(settings, max(15, arguments.every))
    if arguments.command == "regions":
        runner.run_regions(settings)
    if arguments.command in ("ingest", "run"):
        runner.run_ingest(settings)
    if arguments.command in ("harmonize", "run"):
        metrics = runner.run_harmonize(settings)
        for code in sorted(metrics):
            logging.getLogger(__name__).info("  %-55s %14.4f", code, metrics[code])
    return 0


def _watch(settings, minutes: int) -> None:
    """Consulta FIRMS periódicamente. Un fallo se registra y se reintenta en la siguiente vuelta."""
    log = logging.getLogger(__name__)
    log.info("Vigilando FIRMS cada %d minutos", minutes)
    while True:
        try:
            runner.run_nrt(settings)
        except Exception:  # noqa: BLE001 (un error de red no debe detener la vigilancia)
            log.exception("Falló la consulta a FIRMS; se reintenta en %d minutos", minutes)
        time.sleep(minutes * 60)
