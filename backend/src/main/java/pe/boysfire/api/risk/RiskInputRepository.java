package pe.boysfire.api.risk;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Lo que el cálculo de riesgo necesita leer: dónde consultar el clima, la temporada y los focos recientes. */
@Repository
class RiskInputRepository {

    private static final int PROVINCE_LEVEL = 3;

    // El centro del rectángulo que envuelve la provincia; en 185 de 195 cae dentro de ella.
    private static final String FIND_PROVINCE_POINTS = """
            SELECT region_id, geom.EnvelopeCenter().Lat AS latitude, geom.EnvelopeCenter().Long AS longitude
            FROM ref.region
            WHERE region_level_id = :provinceLevel AND geom IS NOT NULL
            ORDER BY region_id
            """;

    // Actividad típica de cada día del año respecto del día más activo del año, por región.
    private static final String FIND_SEASON_SHARES = """
            SELECT climatology.region_id, climatology.day_of_year, climatology.mean_index, peak.peak_mean
            FROM fire.region_climatology AS climatology
            JOIN (
                SELECT region_id, MAX(mean_index) AS peak_mean
                FROM fire.region_climatology
                GROUP BY region_id
            ) AS peak ON peak.region_id = climatology.region_id
            WHERE climatology.day_of_year IN (:daysOfYear) AND peak.peak_mean >= :minPeak
            """;

    private static final String FIND_RECENT_DETECTIONS = """
            SELECT region_id, SUM(confident_count) AS detections
            FROM fire.daily_region_activity
            WHERE activity_date BETWEEN :from AND :to
            GROUP BY region_id
            """;

    private static final String FIND_LAST_OBSERVED_DATE = "SELECT MAX(activity_date) FROM fire.observation_day";

    private final JdbcClient jdbc;

    RiskInputRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<GeoPoint> findProvincePoints() {
        return jdbc.sql(FIND_PROVINCE_POINTS)
                .param("provinceLevel", PROVINCE_LEVEL)
                .query((row, rowNumber) -> new GeoPoint(row.getInt("region_id"), row.getDouble("latitude"), row.getDouble("longitude")))
                .list();
    }

    /**
     * Para cada región y día del año pedido, la fracción (0–1) de la actividad del día pico.
     * Solo regiones con historia de fuego; las demás no aparecen.
     */
    Map<Integer, Map<Integer, Double>> findSeasonShares(List<Integer> daysOfYear, double minPeak) {
        Map<Integer, Map<Integer, Double>> shares = new HashMap<>();
        jdbc.sql(FIND_SEASON_SHARES)
                .param("daysOfYear", daysOfYear)
                .param("minPeak", minPeak)
                .query(row -> {
                    double share = row.getDouble("mean_index") / row.getDouble("peak_mean");
                    shares.computeIfAbsent(row.getInt("region_id"), key -> new HashMap<>()).put(row.getInt("day_of_year"), share);
                });
        return shares;
    }

    Map<Integer, Integer> findRecentDetections(LocalDate from, LocalDate to) {
        Map<Integer, Integer> detections = new HashMap<>();
        jdbc.sql(FIND_RECENT_DETECTIONS)
                .param("from", from)
                .param("to", to)
                .query(row -> {
                    detections.put(row.getInt("region_id"), row.getInt("detections"));
                });
        return detections;
    }

    Optional<LocalDate> findLastObservedDate() {
        return Optional.ofNullable(jdbc.sql(FIND_LAST_OBSERVED_DATE).query(LocalDate.class).single());
    }
}
