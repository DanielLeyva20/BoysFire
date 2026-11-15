package pe.boysfire.api.report;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import pe.boysfire.api.report.ReportViews.CommunityReport;
import pe.boysfire.api.report.ReportViews.NewReport;

@Repository
class ReportRepository {

    /** Margen en grados del recuadro donde se busca el foco más cercano (~11 km). */
    private static final double SEARCH_BOX_DEGREES = 0.1;

    private static final String SELECT_REPORT = """
            SELECT report_id, report_type_id, CAST(latitude AS FLOAT) AS latitude, CAST(longitude AS FLOAT) AS longitude,
                   region_id, description, reporter_name, reporter_contact, status,
                   CAST(nearest_hotspot_km AS FLOAT) AS nearest_hotspot_km, created_at, updated_at
            FROM ops.community_report
            """;

    private final JdbcClient jdbc;

    ReportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    record NearestHotspot(long hotspotId, double distanceKm) {
    }

    int insert(NewReport report, Integer regionId, NearestHotspot nearest) {
        return jdbc.sql("""
                        INSERT INTO ops.community_report (report_type_id, latitude, longitude, region_id, description,
                                                          reporter_name, reporter_contact, nearest_hotspot_id, nearest_hotspot_km)
                        OUTPUT INSERTED.report_id
                        VALUES (:type, :latitude, :longitude, :regionId, :description, :name, :contact, :hotspotId, :distance)
                        """)
                .param("type", report.type().id())
                .param("latitude", report.latitude())
                .param("longitude", report.longitude())
                .param("regionId", regionId)
                .param("description", blankToNull(report.description()))
                .param("name", blankToNull(report.reporterName()))
                .param("contact", blankToNull(report.reporterContact()))
                .param("hotspotId", nearest == null ? null : nearest.hotspotId())
                .param("distance", nearest == null ? null : nearest.distanceKm())
                .query(Integer.class)
                .single();
    }

    /** El foco confiable más cercano al punto entre dos fechas, dentro de ~11 km. */
    Optional<NearestHotspot> findNearestHotspot(double latitude, double longitude, LocalDate from, LocalDate to) {
        return jdbc.sql("""
                        SELECT TOP (1) hotspot_id,
                               geom.STDistance(geography::Point(:latitude, :longitude, 4326)) / 1000.0 AS distance_km
                        FROM fire.hotspot
                        WHERE acq_date_local BETWEEN :from AND :to
                          AND confidence_level_id >= 2
                          AND latitude BETWEEN :latitude - :box AND :latitude + :box
                          AND longitude BETWEEN :longitude - :box AND :longitude + :box
                        ORDER BY distance_km
                        """)
                .param("latitude", latitude)
                .param("longitude", longitude)
                .param("from", from)
                .param("to", to)
                .param("box", SEARCH_BOX_DEGREES)
                .query((row, rowNumber) -> new NearestHotspot(row.getLong("hotspot_id"), row.getDouble("distance_km")))
                .optional();
    }

    List<CommunityReport> findAll(ReportStatus status, int limit) {
        return jdbc.sql("SELECT TOP (:limit) * FROM (" + SELECT_REPORT + ") AS report "
                        + "WHERE (:status IS NULL OR status = :status) ORDER BY created_at DESC")
                .param("limit", limit)
                .param("status", status == null ? null : status.name())
                .query(ReportRepository::toReport)
                .list();
    }

    Optional<CommunityReport> find(int reportId) {
        return jdbc.sql(SELECT_REPORT + " WHERE report_id = :id")
                .param("id", reportId)
                .query(ReportRepository::toReport)
                .optional();
    }

    void updateStatus(int reportId, ReportStatus status) {
        jdbc.sql("UPDATE ops.community_report SET status = :status, updated_at = SYSUTCDATETIME() WHERE report_id = :id")
                .param("status", status.name())
                .param("id", reportId)
                .update();
    }

    private static CommunityReport toReport(ResultSet row, int rowNumber) throws SQLException {
        ReportType type = ReportType.fromId(row.getInt("report_type_id"));
        return new CommunityReport(
                row.getInt("report_id"),
                type,
                type.label(),
                row.getDouble("latitude"),
                row.getDouble("longitude"),
                row.getObject("region_id", Integer.class),
                null,
                row.getString("description"),
                row.getString("reporter_name"),
                row.getString("reporter_contact"),
                ReportStatus.valueOf(row.getString("status")),
                row.getObject("nearest_hotspot_km", Double.class),
                row.getObject("created_at", LocalDateTime.class),
                row.getObject("updated_at", LocalDateTime.class));
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
