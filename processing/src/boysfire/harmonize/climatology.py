"""Paso 8 · Climatología: lo normal para cada día del año, base de los períodos críticos."""
from __future__ import annotations

import numpy as np
import pandas as pd

from boysfire.config import HarmonizationSettings

CLIMATOLOGY_COLUMNS = [
    "region_id", "day_of_year", "sample_years",
    "mean_index", "p50_index", "p90_index", "p95_index", "critical_threshold",
]

_DAYS_IN_LEAP_YEAR = 366


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


def region_climatology(daily: pd.Series, settings: HarmonizationSettings) -> pd.DataFrame:
    """Estadísticos por día del año de una serie diaria (índice = fecha; solo días observados).

    Cada día del año se describe con los valores de ± ``climatology_window_days`` días
    de todos los años completos. Un día es crítico si supera su percentil 90, con un
    piso (un día de fuego típico) para que en época de lluvias un solo foco no dispare la alerta.
    """
    dates = pd.DatetimeIndex(daily.index)
    years = full_years(dates) or sorted(set(dates.year))
    in_baseline = np.isin(dates.year, years)
    baseline = daily[in_baseline]
    baseline_dates = dates[in_baseline]

    matrix = (
        pd.DataFrame(
            {"year": baseline_dates.year, "day": leap_day_of_year(baseline_dates), "value": baseline.to_numpy()}
        )
        .pivot(index="year", columns="day", values="value")
        .reindex(columns=range(1, _DAYS_IN_LEAP_YEAR + 1))
        .to_numpy(dtype="float64")
    )

    window = settings.climatology_window_days
    offsets = np.arange(-window, window + 1)
    neighbours = (np.arange(_DAYS_IN_LEAP_YEAR)[:, None] + offsets[None, :]) % _DAYS_IN_LEAP_YEAR
    # samples[día, año, vecino]
    samples = matrix[:, neighbours].transpose(1, 0, 2)
    flat = samples.reshape(_DAYS_IN_LEAP_YEAR, -1)

    positive = baseline[baseline > 0]
    floor = float(positive.median()) if not positive.empty else 0.0

    p50, p90, p95 = np.nanpercentile(flat, [50, 90, 95], axis=1)
    result = pd.DataFrame(
        {
            "day_of_year": np.arange(1, _DAYS_IN_LEAP_YEAR + 1),
            "sample_years": (~np.isnan(samples)).any(axis=2).sum(axis=1),
            "mean_index": np.nanmean(flat, axis=1),
            "p50_index": p50,
            "p90_index": p90,
            "p95_index": p95,
        }
    )
    result["critical_threshold"] = np.maximum(result["p90_index"], floor)
    value_columns = ["mean_index", "p50_index", "p90_index", "p95_index", "critical_threshold"]
    result[value_columns] = result[value_columns].round(4)
    return result


def build_climatology(official_series: pd.DataFrame, settings: HarmonizationSettings) -> pd.DataFrame:
    """Filas de ``fire.region_climatology`` para cada región de la serie oficial."""
    frames = []
    for region_id, rows in official_series.groupby("region_id"):
        daily = rows.set_index("activity_date")["harmonized_index"]
        frames.append(region_climatology(daily, settings).assign(region_id=region_id))
    if not frames:
        return pd.DataFrame(columns=CLIMATOLOGY_COLUMNS)
    return pd.concat(frames, ignore_index=True)[CLIMATOLOGY_COLUMNS]
