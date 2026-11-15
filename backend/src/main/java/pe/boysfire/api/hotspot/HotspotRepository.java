package pe.boysfire.api.hotspot;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import pe.boysfire.api.common.domain.ConfidenceLevel;
import pe.boysfire.api.common.domain.Satellite;

@Repository
class HotspotRepository {

    // La tabla está ordenada físicamente por fecha local: el filtro de fechas lee solo esos días.
    private static final String FIND = """
            SELECT TOP (:maxRows) hotspot_id, latitude, longitude, acq_datetime_utc, acq_date_local,
                   satellite_id, confidence_level_id, frp_mw, scan_km, track_km, is_daytime
            FROM fire.hotspot
            WHERE acq_date_local BETWEEN :from AND :to
              AND latitude BETWEEN :minLatitude AND :maxLatitude
              AND longitude BETWEEN :minLongitude AND :maxLongitude
              AND confidence_level_id >= :minConfidence
              AND satellite_id IN (:satelliteIds)
            ORDER BY acq_date_local, hotspot_id
            """;

    private final JdbcClient jdbc;

    HotspotRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Devuelve hasta {@code limit + 1} focos: el sobrante le dice al llamador que hay más. */
    List<Hotspot> find(HotspotQuery query) {
        List<Integer> satelliteIds =
                query.sensor() == null ? Satellite.allIds() : Satellite.idsOf(query.sensor());
        return jdbc.sql(FIND)
                .param("maxRows", query.limit() + 1)
                .param("from", query.dates().from())
                .param("to", query.dates().to())
                .param("minLatitude", query.area().minLatitude())
                .param("maxLatitude", query.area().maxLatitude())
                .param("minLongitude", query.area().minLongitude())
                .param("maxLongitude", query.area().maxLongitude())
                .param("minConfidence", query.minConfidence().id())
                .param("satelliteIds", satelliteIds)
                .query(HotspotRepository::toHotspot)
                .list();
    }

    private static Hotspot toHotspot(ResultSet row, int rowNumber) throws SQLException {
        Satellite satellite = Satellite.fromId(row.getInt("satellite_id"));
        return new Hotspot(
                row.getLong("hotspot_id"),
                row.getDouble("latitude"),
                row.getDouble("longitude"),
                row.getObject("acq_datetime_utc", LocalDateTime.class),
                row.getObject("acq_date_local", LocalDate.class),
                satellite,
                satellite.sensor(),
                ConfidenceLevel.fromId(row.getInt("confidence_level_id")),
                row.getObject("frp_mw", Double.class),
                row.getObject("scan_km", Double.class),
                row.getObject("track_km", Double.class),
                row.getBoolean("is_daytime"));
    }
}
