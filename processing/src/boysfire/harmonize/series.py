"""Series diarias del índice armonizado por región: detectado + fondo.

Es el mismo cálculo que hacen las vistas ``fire.v_daily_region_index`` en la base, aquí en
memoria para la climatología y la validación.
"""
from __future__ import annotations

from collections.abc import Iterator

import numpy as np
import pandas as pd

from boysfire.domain.catalogs import SourceGroup


class RegionSeries:
    """Construye la serie diaria de cualquier región y grupo a partir de los agregados."""

    def __init__(
        self,
        region_detected: pd.DataFrame,
        region_background: pd.DataFrame,
        background_scale: pd.DataFrame,
        observation_days: pd.DataFrame,
    ) -> None:
        self._detected = {
            key: rows.set_index("activity_date")["detected_index"]
            for key, rows in region_detected.groupby(["region_id", "source_group_id"])
        }
        self._rates = {
            key: rows.set_index("month_of_year")["daily_rate"]
            for key, rows in region_background.groupby(["region_id", "source_group_id"])
        }
        self._scale = {
            group_id: rows.set_index("activity_date")["scale"]
            for group_id, rows in background_scale.groupby("source_group_id")
        }
        self._official_days = {
            SourceGroup(group_id): pd.DatetimeIndex(days)
            for group_id, days in observation_days.groupby("source_group_id")["activity_date"]
        }
        self._all_days = pd.DatetimeIndex(observation_days["activity_date"]).sort_values()
        self.region_ids = sorted({region_id for region_id, _ in self._detected} | {region_id for region_id, _ in self._rates})

    def for_group(self, region_id: int, group: SourceGroup, days: pd.DatetimeIndex) -> pd.Series:
        """Índice del grupo en la región para cada uno de ``days`` (0 si no hubo actividad)."""
        key = (region_id, int(group))
        values = np.zeros(len(days))
        if key in self._detected:
            values += self._detected[key].reindex(days, fill_value=0.0).to_numpy(dtype="float64")
        if key in self._rates and int(group) in self._scale:
            rate = self._rates[key].reindex(days.month, fill_value=0.0).to_numpy(dtype="float64")
            scale = self._scale[int(group)].reindex(days, fill_value=0.0).to_numpy(dtype="float64")
            values += rate * scale
        return pd.Series(values, index=days)

    def official(self, region_id: int) -> pd.Series:
        """Serie oficial: cada día observado toma la estimación del grupo elegido para ese día."""
        parts = [self.for_group(region_id, group, days) for group, days in self._official_days.items()]
        if not parts:
            return pd.Series(dtype="float64", index=self._all_days)
        return pd.concat(parts).sort_index()

    def official_by_region(self) -> Iterator[tuple[int, pd.Series]]:
        for region_id in self.region_ids:
            yield region_id, self.official(region_id)
