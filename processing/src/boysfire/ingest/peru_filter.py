"""Deja solo los focos de Perú y que todavía no están en la base."""
from __future__ import annotations

import pandas as pd

from boysfire.db.ingest_repository import IngestRepository
from boysfire.regions.catalog import RegionCatalog, find_containing

_KEY = ["satellite", "acq_date", "acq_time", "latitude", "longitude"]
_COORDINATE_DECIMALS = 5     # la base guarda DECIMAL(8, 5)


class PeruFilter:
    """Se usa como ``row_filter`` de la carga: descarta focos de países vecinos y repetidos."""

    def __init__(self, catalog: RegionCatalog, repository: IngestRepository) -> None:
        self._districts = catalog.districts
        self._repository = repository

    def __call__(self, rows: pd.DataFrame) -> pd.DataFrame:
        if rows.empty:
            return rows
        located = find_containing(rows["latitude"].to_numpy(), rows["longitude"].to_numpy(), self._districts)
        inside = rows.loc[~pd.isna(located)]
        return self._without_known(inside)

    def _without_known(self, rows: pd.DataFrame) -> pd.DataFrame:
        if rows.empty:
            return rows
        known = self._repository.read_hotspot_keys(rows["acq_date"].min().date(), rows["acq_date"].max().date())
        if known.empty:
            return rows
        keyed = rows.assign(
            latitude=rows["latitude"].round(_COORDINATE_DECIMALS), longitude=rows["longitude"].round(_COORDINATE_DECIMALS)
        )
        merged = keyed.merge(known.assign(_known=True), on=_KEY, how="left")
        return rows.loc[merged["_known"].isna().to_numpy()]
