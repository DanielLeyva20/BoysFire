"""Paso 2 · Grilla común H3: cada foco cae en una celda, sin importar el tamaño de su píxel."""
from __future__ import annotations

import h3.api.numpy_int as h3
import numpy as np
import pandas as pd

from boysfire.config import HarmonizationSettings


def cells_for_points(latitude: np.ndarray, longitude: np.ndarray, resolution: int) -> np.ndarray:
    """Índice H3 (entero de 64 bits con signo, apto para BIGINT) de cada punto."""
    cells = np.fromiter(
        (h3.latlng_to_cell(lat, lng, resolution) for lat, lng in zip(latitude.tolist(), longitude.tolist())),
        dtype=np.uint64,
        count=len(latitude),
    )
    return cells.astype(np.int64)


def parent_cells(cells: np.ndarray, resolution: int) -> np.ndarray:
    """Celda padre de cada celda. Solo se consulta H3 una vez por celda distinta."""
    unique, inverse = np.unique(cells, return_inverse=True)
    parents = np.fromiter(
        (h3.cell_to_parent(int(cell), resolution) for cell in unique), dtype=np.uint64, count=len(unique)
    ).astype(np.int64)
    return parents[inverse]


def assign_cells(hotspots: pd.DataFrame, settings: HarmonizationSettings) -> pd.DataFrame:
    """Añade la celda locus (~1 km), la de mapa y la de calibración de cada foco."""
    locus = cells_for_points(
        hotspots["latitude"].to_numpy(), hotspots["longitude"].to_numpy(), settings.locus_resolution
    )
    map_cell = parent_cells(locus, settings.map_resolution)
    return hotspots.assign(
        h3_cell=locus,
        map_cell=map_cell,
        calibration_cell=parent_cells(map_cell, settings.calibration_resolution),
    )


def build_grid_cells(hotspots: pd.DataFrame, settings: HarmonizationSettings) -> pd.DataFrame:
    """Filas de ``fire.grid_cell`` para las celdas usadas, con la jerarquía locus → mapa → calibración."""
    levels = (
        ("h3_cell", settings.locus_resolution, "map_cell"),
        ("map_cell", settings.map_resolution, "calibration_cell"),
        ("calibration_cell", settings.calibration_resolution, None),
    )
    frames = []
    for column, resolution, parent_column in levels:
        columns = [column] + ([parent_column] if parent_column else [])
        cells = hotspots[columns].drop_duplicates(subset=column)
        index = cells[column].to_numpy()
        centers = np.array([h3.cell_to_latlng(int(cell)) for cell in index]).reshape(-1, 2)
        frames.append(
            pd.DataFrame(
                {
                    "h3_index": index,
                    "resolution": resolution,
                    "parent_h3_index": cells[parent_column].to_numpy() if parent_column else None,
                    "center_latitude": centers[:, 0].round(5),
                    "center_longitude": centers[:, 1].round(5),
                }
            )
        )
    grid = pd.concat(frames, ignore_index=True)
    grid["parent_h3_index"] = grid["parent_h3_index"].astype("Int64")
    return grid
