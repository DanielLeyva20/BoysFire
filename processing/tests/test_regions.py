import pandas as pd
import shapely

from boysfire.domain.catalogs import RegionLevel
from boysfire.regions import boundaries
from boysfire.regions.catalog import RegionCatalog, find_containing

SQUARE_A = "POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))"
SQUARE_B = "POLYGON ((1 0, 2 0, 2 1, 1 1, 1 0))"


def _catalog() -> RegionCatalog:
    hierarchy = pd.DataFrame(
        {
            "region_id": [1, 10, 100, 1000, 1001],
            "region_level_id": [
                RegionLevel.COUNTRY, RegionLevel.DEPARTMENT, RegionLevel.PROVINCE,
                RegionLevel.DISTRICT, RegionLevel.DISTRICT,
            ],
            "parent_region_id": pd.array([pd.NA, 1, 10, 100, 100], dtype="Int64"),
        }
    )
    districts = pd.DataFrame({"region_id": [1000, 1001], "wkt": [SQUARE_A, SQUARE_B]})
    return RegionCatalog(hierarchy=hierarchy, districts=districts)


def test_parent_code_is_the_ubigeo_without_its_last_two_digits():
    assert boundaries.parent_code("150501") == "1505"
    assert boundaries.parent_code("1505") == "15"
    assert boundaries.parent_code("15") == "PE"


def test_display_name_keeps_connectors_in_lowercase():
    assert boundaries.display_name("SAN VICENTE DE CAÑETE") == "San Vicente de Cañete"
    assert boundaries.display_name("LA LIBERTAD") == "La Libertad"


def test_wkt_has_counter_clockwise_exterior_as_sql_server_requires():
    clockwise = {"type": "Polygon", "coordinates": [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]}

    polygon = shapely.from_wkt(boundaries.to_wkt(clockwise))

    assert polygon.exterior.is_ccw
    assert boundaries.to_wkt(None) is None


def test_point_is_assigned_to_the_polygon_that_contains_it():
    polygons = _catalog().districts

    found = find_containing(latitude=pd.Series([0.5, 0.5]).to_numpy(), longitude=pd.Series([0.5, 1.5]).to_numpy(), polygons=polygons)

    assert found.tolist() == [1000, 1001]


def test_point_in_a_gap_snaps_to_the_nearest_polygon_and_a_far_point_stays_unassigned():
    polygons = _catalog().districts
    near_gap, far_away = (0.5, 2.01), (0.5, 9.0)        # (latitud, longitud)

    found = find_containing(
        latitude=pd.Series([near_gap[0], far_away[0]]).to_numpy(),
        longitude=pd.Series([near_gap[1], far_away[1]]).to_numpy(),
        polygons=polygons,
    )

    assert found[0] == 1001
    assert pd.isna(found[1])


def test_locate_returns_every_level_and_keeps_far_points_in_the_country():
    points = pd.DataFrame({"latitude": [0.5, 0.5], "longitude": [0.5, 9.0]}, index=[77, 88])

    located = _catalog().locate(points)

    assert located.loc[77].tolist() == [1, 10, 100, 1000]
    assert located.loc[88, "country"] == 1
    assert located.loc[88, ["department", "province", "district"]].isna().all()
