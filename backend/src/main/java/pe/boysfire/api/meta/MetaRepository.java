package pe.boysfire.api.meta;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class MetaRepository {

    private static final String COUNT_HOTSPOTS = "SELECT COUNT_BIG(*) FROM fire.hotspot";

    private static final String FIND_SOURCE_DAYS = """
            SELECT source.code, COUNT(*) AS days
            FROM fire.observation_day AS day
            JOIN ref.source_group AS source ON source.source_group_id = day.source_group_id
            GROUP BY source.code, source.priority
            ORDER BY source.priority
            """;

    private static final String FIND_LAST_RUN = """
            SELECT TOP (1) pipeline_run_id, finished_at
            FROM ingest.pipeline_run
            WHERE status = 'SUCCESS'
            ORDER BY finished_at DESC
            """;

    private static final String FIND_RUN_METRICS = """
            SELECT metric_code, metric_value
            FROM ingest.pipeline_run_metric
            WHERE pipeline_run_id = :runId
            ORDER BY metric_code
            """;

    private final JdbcClient jdbc;

    MetaRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    record PipelineRun(int id, LocalDateTime finishedAt) {
    }

    long countHotspots() {
        return jdbc.sql(COUNT_HOTSPOTS).query(Long.class).single();
    }

    Map<String, Integer> findSourceDays() {
        Map<String, Integer> days = new LinkedHashMap<>();
        jdbc.sql(FIND_SOURCE_DAYS).query(row -> {
            days.put(row.getString("code"), row.getInt("days"));
        });
        return days;
    }

    Optional<PipelineRun> findLastSuccessfulRun() {
        return jdbc.sql(FIND_LAST_RUN)
                .query((row, rowNumber) -> new PipelineRun(
                        row.getInt("pipeline_run_id"), row.getObject("finished_at", LocalDateTime.class)))
                .optional();
    }

    Map<String, Double> findRunMetrics(int runId) {
        Map<String, Double> metrics = new LinkedHashMap<>();
        jdbc.sql(FIND_RUN_METRICS).param("runId", runId).query(row -> {
            metrics.put(row.getString("metric_code"), row.getDouble("metric_value"));
        });
        return metrics;
    }
}
