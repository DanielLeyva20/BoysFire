"""Línea de comandos: ``python -m boysfire <comando>``."""
from __future__ import annotations

import argparse
import logging

from boysfire.config import load_settings
from boysfire.pipeline import runner

_COMMANDS = {
    "ingest": "Carga a la base los .zip de FIRMS que estén en data/raw (omite los ya cargados).",
    "harmonize": "Reconstruye el modelo armonizado a partir de los focos crudos.",
    "run": "Hace las dos cosas: ingest y luego harmonize.",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="boysfire", description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name, help_text in _COMMANDS.items():
        subparsers.add_parser(name, help=help_text)
    arguments = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
    settings = load_settings()

    if arguments.command in ("ingest", "run"):
        runner.run_ingest(settings)
    if arguments.command in ("harmonize", "run"):
        metrics = runner.run_harmonize(settings)
        for code in sorted(metrics):
            logging.getLogger(__name__).info("  %-55s %14.4f", code, metrics[code])
    return 0
