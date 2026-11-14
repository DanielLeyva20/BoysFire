"""Paso 7 · Agregados diarios: actividad observada por satélite e índice armonizado por grupo."""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import REFERENCE_GROUP


def attach_ratio(loci: pd.DataFrame, factors: pd.DataFrame) -> pd.DataFrame:
    """Añade a cada celda activa el factor de su grupo, celda de calibración y mes.

    La referencia vale 1. Las filas de grupos sin calibrar se descartan.
    """
    keyed = loci.assign(month_of_year=loci["activity_date"].dt.month)
    merged = keyed.merge(
        factors.rename(columns={"h3_cell": "calibration_cell"})[
            ["source_group_id", "calibration_cell", "month_of_year", "ratio"]
        ],
        on=["source_group_id", "calibration_cell", "month_of_year"],
        how="left",
    )
    is_reference = merged["source_group_id"] == int(REFERENCE_GROUP)
    merged["ratio"] = merged["ratio"].where(~is_reference, 1.0)
    return merged.dropna(subset=["ratio"]).drop(columns="month_of_year")


def harmonized_by(loci_with_ratio: pd.DataFrame, key: str, key_name: str) -> pd.DataFrame:
    """Índice armonizado por día, ``key`` y grupo: suma de (celdas activas × factor)."""
    grouped = loci_with_ratio.groupby(["activity_date", key, "source_group_id"], sort=True)["ratio"]
    result = grouped.agg(active_loci="size", harmonized_index="sum").reset_index()
    result["harmonized_index"] = result["harmonized_index"].round(4)
    return result.rename(columns={key: key_name})


def activity_by(
    hotspots: pd.DataFrame, key: str, key_name: str, settings: HarmonizationSettings
) -> pd.DataFrame:
    """Actividad observada por día, ``key`` y satélite, sin calibrar."""
    frame = hotspots.assign(
        is_confident=hotspots["confidence_level_id"] >= int(settings.min_confidence),
        frp=hotspots["frp_mw"].fillna(0.0),
    )
    result = (
        frame.groupby(["activity_date", key, "satellite_id"], sort=True)
        .agg(
            detection_count=("hotspot_id", "size"),
            confident_count=("is_confident", "sum"),
            frp_sum_mw=("frp", "sum"),
            frp_max_mw=("frp", "max"),
        )
        .reset_index()
    )
    result["confident_count"] = result["confident_count"].astype("int64")
    result["frp_sum_mw"] = result["frp_sum_mw"].round(2)
    return result.rename(columns={key: key_name})


def official_series(region_harmonized: pd.DataFrame, observation_days: pd.DataFrame) -> pd.DataFrame:
    """Serie oficial por región: un valor por día observado (0 si no hubo fuego).

    Toma de cada día la estimación del grupo elegido en ``observation_days``.
    Columnas: region_id, activity_date, harmonized_index.
    """
    chosen = region_harmonized.merge(observation_days, on=["activity_date", "source_group_id"])
    series = []
    for region_id, rows in chosen.groupby("region_id"):
        values = (
            rows.set_index("activity_date")["harmonized_index"]
            .reindex(pd.DatetimeIndex(observation_days["activity_date"]), fill_value=0.0)
        )
        series.append(
            pd.DataFrame(
                {"region_id": region_id, "activity_date": values.index, "harmonized_index": values.to_numpy()}
            )
        )
    if not series:
        return pd.DataFrame(columns=["region_id", "activity_date", "harmonized_index"])
    return pd.concat(series, ignore_index=True)
