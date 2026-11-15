package pe.boysfire.api.region;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class RegionRepository {

    private static final String FIND_ALL = """
            SELECT region_id, code, name, region_level_id, parent_region_id
            FROM ref.region
            """;

    private static final String FIND_GEOMETRY = """
            SELECT geom.STAsText()
            FROM ref.region
            WHERE region_id = :regionId AND geom IS NOT NULL
            """;

    private static final String FIND_CHILDREN_GEOMETRY = """
            SELECT region_id, geom.STAsText() AS wkt
            FROM ref.region
            WHERE parent_region_id = :parentId AND geom IS NOT NULL
            """;

    // El distrito que contiene el punto; se apoya en el índice espacial de ref.region.
    private static final String FIND_DISTRICT_AT = """
            SELECT TOP (1) region_id
            FROM ref.region
            WHERE region_level_id = :districtLevel
              AND geom.STIntersects(geography::Point(:latitude, :longitude, 4326)) = 1
            """;

    private final JdbcClient jdbc;

    RegionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<Region> findAll() {
        return jdbc.sql(FIND_ALL).query(RegionRepository::toRegion).list();
    }

    /** Geometría en WKT; vacío si la región no existe o no tiene geometría (el país). */
    Optional<String> findGeometryWkt(int regionId) {
        return jdbc.sql(FIND_GEOMETRY).param("regionId", regionId).query(String.class).optional();
    }

    /** WKT de cada región hija, por identificador. */
    Map<Integer, String> findChildrenGeometryWkt(int parentId) {
        return jdbc.sql(FIND_CHILDREN_GEOMETRY)
                .param("parentId", parentId)
                .query((row, rowNumber) -> Map.entry(row.getInt("region_id"), row.getString("wkt")))
                .list()
                .stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    Optional<Integer> findDistrictIdAt(double latitude, double longitude) {
        return jdbc.sql(FIND_DISTRICT_AT)
                .param("districtLevel", RegionLevel.DISTRICT.id())
                .param("latitude", latitude)
                .param("longitude", longitude)
                .query(Integer.class)
                .optional();
    }

    private static Region toRegion(ResultSet row, int rowNumber) throws SQLException {
        return new Region(
                row.getInt("region_id"),
                row.getString("code"),
                row.getString("name"),
                RegionLevel.fromId(row.getInt("region_level_id")),
                row.getObject("parent_region_id", Integer.class));
    }
}
