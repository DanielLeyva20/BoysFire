import pandas as pd

from boysfire.config import HarmonizationSettings
from boysfire.harmonize.cleaning import clean

SETTINGS = HarmonizationSettings(static_source_min_detections=2)


def _hotspots(rows: list[tuple]) -> pd.DataFrame:
    frame = pd.DataFrame(rows, columns=["satellite_id", "minute", "latitude", "h3_cell", "detection_type"])
    frame["acq_datetime_utc"] = pd.Timestamp("2024-09-15") + pd.to_timedelta(frame.pop("minute"), unit="m")
    frame["longitude"] = -76.0
    return frame


def test_removes_non_vegetation_and_infers_static_sources_in_nrt():
    hotspots = _hotspots(
        [
            (3, 0, -12.00, 100, 0.0),     # incendio de vegetación → se queda
            (3, 1, -12.01, 200, 2.0),     # fuente fija → fuera
            (3, 2, -12.02, 200, 2.0),     # fuente fija → fuera (ya son 2 en la celda 200)
            (3, 3, -12.03, 200, None),    # NRT sin tipo en una celda de fuente fija → fuera
            (3, 4, -12.04, 300, None),    # NRT sin tipo en una celda limpia → se queda
            (3, 5, -12.05, 400, 1.0),     # volcán → fuera, pero una sola vez no marca la celda
            (3, 6, -12.06, 400, None),    # NRT en esa celda → se queda
        ]
    )

    kept, metrics = clean(hotspots, SETTINGS)

    assert kept["latitude"].tolist() == [-12.00, -12.04, -12.06]
    assert metrics["rows.excluded.non_vegetation_type"] == 3
    assert metrics["rows.excluded.static_source_inferred"] == 1


def test_removes_exact_duplicate_detections():
    hotspots = _hotspots([(1, 0, -12.0, 100, 0.0), (1, 0, -12.0, 100, 0.0), (2, 0, -12.0, 100, 0.0)])

    kept, metrics = clean(hotspots, SETTINGS)

    assert len(kept) == 2                       # el mismo punto visto por otro satélite no es duplicado
    assert metrics["rows.excluded.duplicate"] == 1
