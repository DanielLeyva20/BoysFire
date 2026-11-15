"""Paso 9 · Climatología: lo normal para cada día del año, base de los períodos críticos."""
from __future__ import annotations

from collections.abc import Iterable

import numpy as np
import pandas as pd

from boysfire.config import HarmonizationSettings

CLIMATOLOGY_COLUMNS = [
    "region_id", "day_of_year", "sample_years",
    "mean_index", "p50_index", "p90_index", "p95_index", "critical_threshold",
]

_DAYS_IN_LEAP_YEAR = 366
_PERCENTILES = (50, 90, 95)
# Un "día con fuego" tiene al menos una celda activa equivalente. El fondo solo (fracciones
# de celda repartidas en cada día) no cuenta.
_MIN_FIRE_DAY_INDEX = 1.0


def leap_day_of_year(dates: pd.DatetimeIndex) -> np.ndarray:
    """Día del año contado sobre un año bisiesto (1–366): el 1 de marzo siempre es el 61."""
    return pd.to_datetime({"year": 2000, "month": dates.month, "day": dates.day}).dt.day_of_year.to_numpy()


def full_years(dates: pd.DatetimeIndex) -> list[int]:
    """Años cubiertos de enero a diciembre por la serie (los parciales sesgan la línea base)."""
    first, last = dates.min(), dates.max()
    return [
        year
        for year in range(first.year, last.year + 1)
        if pd.Timestamp(year, 1, 1) >= first and pd.Timestamp(year, 12, 31) <= last
    ]


class DayOfYearClimatology:
    """Estadísticos por día del año para series que comparten las mismas fechas.

    Cada día del año se describe con los valores de ± ``climatology_window_days`` días de
    todos los años completos. Un día es crítico si supera su percentil 90, con un piso (un
    día de fuego típico: la mediana de los días con al menos una celda activa) para que en
    época de lluvias un solo foco no dispare la alerta.

    Lo que depende solo de las fechas se prepara una vez; ``compute`` se llama por región.
    """

    def __init__(self, dates: pd.DatetimeIndex, settings: HarmonizationSettings) -> None:
        years = full_years(dates) or sorted(set(dates.year))
        self._in_baseline = np.isin(dates.year, years)
        baseline_dates = dates[self._in_baseline]
        self._year_position = np.searchsorted(years, baseline_dates.year)
        self._day_position = leap_day_of_year(baseline_dates) - 1
        self._shape = (len(years), _DAYS_IN_LEAP_YEAR)

        offsets = np.arange(-settings.climatology_window_days, settings.climatology_window_days + 1)
        self._neighbours = (np.arange(_DAYS_IN_LEAP_YEAR)[:, None] + offsets[None, :]) % _DAYS_IN_LEAP_YEAR

    def compute(self, values: np.ndarray) -> pd.DataFrame:
        """``values``: el índice diario, alineado con las fechas del constructor."""
        baseline = values[self._in_baseline]
        by_year_and_day = np.full(self._shape, np.nan)
        by_year_and_day[self._year_position, self._day_position] = baseline

        # samples[día, año, vecino] → una fila de muestras por día del año
        samples = by_year_and_day[:, self._neighbours].transpose(1, 0, 2)
        flat = samples.reshape(_DAYS_IN_LEAP_YEAR, -1)
        is_sample = ~np.isnan(flat)
        sample_count = is_sample.sum(axis=1)
        p50, p90, p95 = _row_percentiles(flat, sample_count, _PERCENTILES)

        fire_days = baseline[baseline >= _MIN_FIRE_DAY_INDEX]
        floor = float(np.median(fire_days)) if fire_days.size else _MIN_FIRE_DAY_INDEX

        result = pd.DataFrame(
            {
                "day_of_year": np.arange(1, _DAYS_IN_LEAP_YEAR + 1),
                "sample_years": (~np.isnan(samples)).any(axis=2).sum(axis=1),
                "mean_index": np.where(is_sample, flat, 0.0).sum(axis=1) / np.maximum(sample_count, 1),
                "p50_index": p50,
                "p90_index": p90,
                "p95_index": p95,
            }
        )
        result["critical_threshold"] = np.maximum(result["p90_index"], floor)
        value_columns = ["mean_index", "p50_index", "p90_index", "p95_index", "critical_threshold"]
        result[value_columns] = result[value_columns].round(4)
        return result


def _row_percentiles(samples: np.ndarray, sample_count: np.ndarray, percentiles: tuple[int, ...]) -> list[np.ndarray]:
    """Percentiles de cada fila ignorando los NaN, con interpolación lineal.

    Equivale a ``np.nanpercentile(samples, percentiles, axis=1)``, pero ordena todas las
    filas de una vez en lugar de recorrerlas una por una. Una fila sin muestras da 0.
    """
    ordered = np.sort(samples, axis=1)          # los NaN quedan al final de cada fila
    last = np.maximum(sample_count - 1, 0)
    results = []
    for percentile in percentiles:
        position = percentile / 100 * last
        lower = np.floor(position).astype(int)
        upper = np.minimum(lower + 1, last)
        low_value = np.take_along_axis(ordered, lower[:, None], axis=1)[:, 0]
        high_value = np.take_along_axis(ordered, upper[:, None], axis=1)[:, 0]
        value = low_value + (high_value - low_value) * (position - lower)
        results.append(np.where(sample_count > 0, value, 0.0))
    return results


def region_climatology(daily: pd.Series, settings: HarmonizationSettings) -> pd.DataFrame:
    """Climatología de una sola serie diaria (índice = fecha; solo días observados)."""
    return DayOfYearClimatology(pd.DatetimeIndex(daily.index), settings).compute(daily.to_numpy(dtype="float64"))


def build_climatology(
    official_by_region: Iterable[tuple[int, pd.Series]], settings: HarmonizationSettings
) -> pd.DataFrame:
    """Filas de ``fire.region_climatology`` a partir de la serie oficial de cada región.

    Todas las series deben traer las mismas fechas (los días observados).
    """
    calculator: DayOfYearClimatology | None = None
    frames = []
    for region_id, daily in official_by_region:
        if calculator is None:
            calculator = DayOfYearClimatology(pd.DatetimeIndex(daily.index), settings)
        frames.append(calculator.compute(daily.to_numpy(dtype="float64")).assign(region_id=region_id))
    if not frames:
        return pd.DataFrame(columns=CLIMATOLOGY_COLUMNS)
    return pd.concat(frames, ignore_index=True)[CLIMATOLOGY_COLUMNS]
