package pe.boysfire.api.mapcell;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;
import org.springframework.stereotype.Repository;
import pe.boysfire.api.common.query.BoundingBox;
import pe.boysfire.api.common.query.DateRange;

@Repository
class MapCellRepository {

    /** Detectado + fondo: incluye celdas sin focos pero con fuego estimado. */
    private static final String FIND_HARMONIZED = """
            SELECT daily.h3_cell, cell.center_latitude, cell.center_longitude,
                   SUM(daily.active_loci) AS active_loci,
                   SUM(daily.detected_index) AS detected_index,
                   SUM(daily.background_index) AS background_index,
                   SUM(daily.harmonized_index) AS harmonized_index
            FROM fire.v_daily_cell_index AS daily
            JOIN fire.grid_cell AS cell ON cell.h3_index = daily.h3_cell
            WHERE daily.activity_date BETWEEN :from AND :to
              AND cell.center_latitude BETWEEN :minLatitude AND :maxLatitude
              AND cell.center_longitude BETWEEN :minLongitude AND :maxLongitude
            GROUP BY daily.h3_cell, cell.center_latitude, cell.center_longitude
            """;

    /** Solo lo detectado: únicamente las celdas donde algún satélite vio fuego. */
    private static final String FIND_DETECTED = """
            SELECT daily.h3_cell, cell.center_latitude, cell.center_longitude,
                   SUM(daily.active_loci) AS active_loci,
                   SUM(daily.detected_index) AS detected_index,
                   CAST(0 AS DECIMAL(12, 4)) AS background_index,
                   SUM(daily.detected_index) AS harmonized_index
            FROM fire.daily_cell_harmonized AS daily
            JOIN fire.observation_day AS official
              ON official.activity_date = daily.activity_date
             AND official.source_group_id = daily.source_group_id
            JOIN fire.grid_cell AS cell ON cell.h3_index = daily.h3_cell
            WHERE daily.activity_date BETWEEN :from AND :to
              AND cell.center_latitude BETWEEN :minLatitude AND :maxLatitude
              AND cell.center_longitude BETWEEN :minLongitude AND :maxLongitude
            GROUP BY daily.h3_cell, cell.center_latitude, cell.center_longitude
            """;

    private final JdbcClient jdbc;

    MapCellRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<MapCell> findHarmonized(DateRange dates, BoundingBox area) {
        return bind(jdbc.sql(FIND_HARMONIZED), dates, area).query(MapCellRepository::toMapCell).list();
    }

    List<MapCell> findDetected(DateRange dates, BoundingBox area) {
        return bind(jdbc.sql(FIND_DETECTED), dates, area).query(MapCellRepository::toMapCell).list();
    }

    private static StatementSpec bind(StatementSpec statement, DateRange dates, BoundingBox area) {
        return statement
                .param("from", dates.from())
                .param("to", dates.to())
                .param("minLatitude", area.minLatitude())
                .param("maxLatitude", area.maxLatitude())
                .param("minLongitude", area.minLongitude())
                .param("maxLongitude", area.maxLongitude());
    }

    private static MapCell toMapCell(ResultSet row, int rowNumber) throws SQLException {
        return new MapCell(
                Long.toHexString(row.getLong("h3_cell")),
                row.getDouble("center_latitude"),
                row.getDouble("center_longitude"),
                row.getLong("active_loci"),
                row.getDouble("detected_index"),
                row.getDouble("background_index"),
                row.getDouble("harmonized_index"));
    }
}
