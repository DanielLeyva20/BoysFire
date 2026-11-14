"""Resultado de la armonización: un DataFrame por tabla del esquema ``fire``."""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass(frozen=True)
class HarmonizationResult:
    """Las columnas de cada DataFrame llevan el mismo nombre que en su tabla."""

    grid_cells: pd.DataFrame
    hotspots: pd.DataFrame
    observation_days: pd.DataFrame
    calibration_baseline: pd.DataFrame
    calibration_factors: pd.DataFrame
    daily_cell_activity: pd.DataFrame
    daily_cell_harmonized: pd.DataFrame
    daily_region_activity: pd.DataFrame
    daily_region_harmonized: pd.DataFrame
    region_climatology: pd.DataFrame
    metrics: dict[str, float] = field(default_factory=dict)
