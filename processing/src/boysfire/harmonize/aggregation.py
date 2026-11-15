"""Paso 7 · Agregados diarios: actividad observada por satélite e índice armonizado por grupo.

Todas las funciones agregan por una columna ``key`` (celda de mapa o región), de modo que
el mismo código sirve para cualquier nivel.
"""
from __future__ import annotations

import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.domain.catalogs import REFERENCE_GROUP
from boysfire.harmonize.calibration import Calibration

_CELL_DAY = ["source_group_id", "activity_date", "calibration_cell"]


def attach_weight(loci: pd.DataFrame, calibration: Calibration) -> pd.DataFrame:
    """Añade a cada celda activa su peso en "equivalente de la referencia".

    La respuesta se calcula por celda de calibración y día (``coefficient × n ^ exponent ×
    ajuste local``) y se reparte por igual entre sus ``n`` celdas activas, para que el
    índice se pueda sumar por cualquier zona. La referencia pesa 1. Las celdas activas
    de grupos sin calibrar se descartan.
    """
    frame = loci.assign(month_of_year=loci["activity_date"].dt.month)
    frame["n"] = frame.groupby(_CELL_DAY)["h3_cell"].transform("size")
    frame = frame.merge(calibration.response[["source_group_id", "coefficient", "exponent"]], on="source_group_id", how="left")
    frame = frame.merge(
        calibration.factors.rename(columns={"h3_cell": "calibration_cell"})[
            ["source_group_id", "calibration_cell", "month_of_year", "ratio"]
        ],
        on=["source_group_id", "calibration_cell", "month_of_year"],
        how="left",
    )
    weight = frame["coefficient"] * frame["n"] ** (frame["exponent"] - 1) * frame["ratio"].fillna(1.0)
    frame["weight"] = weight.where(frame["source_group_id"] != int(REFERENCE_GROUP), 1.0)
    return frame.dropna(subset=["weight"]).drop(columns=["month_of_year", "n", "coefficient", "exponent", "ratio"])


def detected_by(weighted_loci: pd.DataFrame, key: str, key_name: str) -> pd.DataFrame:
    """Parte detectada del índice por día, ``key`` y grupo: suma de los pesos de sus celdas activas."""
    grouped = weighted_loci.groupby(["activity_date", key, "source_group_id"], sort=True)["weight"]
    result = grouped.agg(active_loci="size", detected_index="sum").reset_index()
    result["detected_index"] = result["detected_index"].round(4)
    return result.rename(columns={key: key_name})


def background_by(background_rates: pd.DataFrame, key: str, key_name: str) -> pd.DataFrame:
    """Tasa diaria de fondo por grupo, ``key`` y mes."""
    result = background_rates.groupby(["source_group_id", key, "month_of_year"], as_index=False)["daily_rate"].sum()
    result["daily_rate"] = result["daily_rate"].round(6)
    return result.loc[result["daily_rate"] > 0].rename(columns={key: key_name})


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
