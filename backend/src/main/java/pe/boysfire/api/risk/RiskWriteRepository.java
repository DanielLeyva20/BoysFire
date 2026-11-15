package pe.boysfire.api.risk;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import pe.boysfire.api.risk.Assessment.FactorScore;

/** Guarda el resultado de cada cálculo de riesgo y la bitácora de ejecuciones. */
@Repository
class RiskWriteRepository {

    private static final int BATCH_SIZE = 2_000;

    private static final String INSERT_WEATHER = """
            INSERT INTO risk.weather_day (region_id, forecast_date, temperature_max_c, humidity_min_pct, wind_max_kmh,
                                          gust_max_kmh, precipitation_mm, days_without_rain, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String INSERT_ASSESSMENT = """
            INSERT INTO risk.assessment (region_id, assessment_date, risk_level_id, score, weather_region_id, computed_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """;

    private static final String INSERT_FACTOR = """
            INSERT INTO risk.assessment_factor (region_id, assessment_date, risk_factor_id, points, observed_value, affected_share)
            VALUES (?, ?, ?, ?, ?, ?)
            """;

    private final JdbcClient jdbc;
    private final JdbcTemplate batch;

    RiskWriteRepository(JdbcClient jdbc, JdbcTemplate batch) {
        this.jdbc = jdbc;
        this.batch = batch;
    }

    /** Una evaluación lista para guardar. */
    record RegionAssessment(int regionId, LocalDate date, Assessment assessment, Integer weatherRegionId) {
    }

    int startRun() {
        return jdbc.sql("INSERT INTO risk.refresh_run OUTPUT INSERTED.refresh_run_id DEFAULT VALUES").query(Integer.class).single();
    }

    void finishRun(int runId, int weatherPoints, int assessments) {
        jdbc.sql("""
                UPDATE risk.refresh_run
                SET status = 'SUCCESS', finished_at = SYSUTCDATETIME(), weather_points = :points, assessments = :assessments
                WHERE refresh_run_id = :runId
                """)
                .param("points", weatherPoints)
                .param("assessments", assessments)
                .param("runId", runId)
                .update();
    }

    void failRun(int runId, String error) {
        jdbc.sql("""
                UPDATE risk.refresh_run SET status = 'FAILED', finished_at = SYSUTCDATETIME(), error_message = :error
                WHERE refresh_run_id = :runId
                """)
                .param("error", error.length() > 2000 ? error.substring(0, 2000) : error)
                .param("runId", runId)
                .update();
    }

    /**
     * Reemplaza el clima y el riesgo desde {@code from} en adelante. Lo anterior a esa fecha
     * se conserva como historia.
     */
    @Transactional
    void replaceFrom(LocalDate from, Map<Integer, List<WeatherDay>> weather, List<RegionAssessment> assessments,
                     LocalDateTime computedAt) {
        jdbc.sql("DELETE FROM risk.weather_day WHERE forecast_date >= :from").param("from", from).update();
        jdbc.sql("DELETE FROM risk.assessment WHERE assessment_date >= :from").param("from", from).update();

        Timestamp now = Timestamp.valueOf(computedAt);
        List<Object[]> weatherRows = new ArrayList<>();
        weather.forEach((regionId, days) -> days.forEach(day -> weatherRows.add(new Object[] {
                regionId, Date.valueOf(day.date()), day.temperatureMaxC(), day.humidityMinPct(), day.windMaxKmh(),
                day.gustMaxKmh(), day.precipitationMm(), day.daysWithoutRain(), now})));

        List<Object[]> assessmentRows = new ArrayList<>();
        List<Object[]> factorRows = new ArrayList<>();
        for (RegionAssessment entry : assessments) {
            Date date = Date.valueOf(entry.date());
            assessmentRows.add(new Object[] {
                    entry.regionId(), date, entry.assessment().level().id(), entry.assessment().score(),
                    entry.weatherRegionId(), now});
            for (FactorScore factor : entry.assessment().factors()) {
                factorRows.add(new Object[] {
                        entry.regionId(), date, factor.factor().id(), factor.points(), factor.observedValue(),
                        factor.affectedShare()});
            }
        }
        insertInBatches(INSERT_WEATHER, weatherRows);
        insertInBatches(INSERT_ASSESSMENT, assessmentRows);
        insertInBatches(INSERT_FACTOR, factorRows);
    }

    private void insertInBatches(String sql, List<Object[]> rows) {
        for (int start = 0; start < rows.size(); start += BATCH_SIZE) {
            batch.batchUpdate(sql, rows.subList(start, Math.min(rows.size(), start + BATCH_SIZE)));
        }
    }
}
