package pe.boysfire.api.calendar;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import pe.boysfire.api.common.domain.Sensor;
import pe.boysfire.api.common.query.DateRange;

@Repository
class CalendarRepository {

    private static final String FIND_DAYS = """
            SELECT day.activity_date, day.harmonized_index, day.detected_index, day.background_index,
                   day.expected_index, day.critical_threshold, day.is_critical, source.code AS source_code
            FROM fire.v_calendar_day AS day
            JOIN ref.source_group AS source ON source.source_group_id = day.source_group_id
            WHERE day.region_id = :regionId AND day.activity_date BETWEEN :from AND :to
            ORDER BY day.activity_date
            """;

    private static final String FIND_YEARS = """
            WITH harmonized AS (
                SELECT YEAR(activity_date) AS year,
                       COUNT(*) AS observed_days,
                       SUM(harmonized_index) AS harmonized_index,
                       SUM(detected_index) AS detected_index,
                       SUM(background_index) AS background_index,
                       MAX(harmonized_index) AS peak_index,
                       SUM(CAST(is_critical AS INT)) AS critical_days
                FROM fire.v_calendar_day
                WHERE region_id = :regionId
                GROUP BY YEAR(activity_date)
            ),
            observed AS (
                SELECT YEAR(activity.activity_date) AS year,
                       SUM(CASE WHEN sensor.code = 'MODIS' THEN activity.detection_count ELSE 0 END) AS modis_detections,
                       SUM(CASE WHEN sensor.code = 'VIIRS' THEN activity.detection_count ELSE 0 END) AS viirs_detections
                FROM fire.daily_region_activity AS activity
                JOIN ref.satellite AS satellite ON satellite.satellite_id = activity.satellite_id
                JOIN ref.sensor AS sensor ON sensor.sensor_id = satellite.sensor_id
                WHERE activity.region_id = :regionId
                GROUP BY YEAR(activity.activity_date)
            )
            SELECT harmonized.year, harmonized.observed_days, harmonized.harmonized_index, harmonized.detected_index,
                   harmonized.background_index, harmonized.peak_index, harmonized.critical_days,
                   COALESCE(observed.modis_detections, 0) AS modis_detections,
                   COALESCE(observed.viirs_detections, 0) AS viirs_detections
            FROM harmonized
            LEFT JOIN observed ON observed.year = harmonized.year
            ORDER BY harmonized.year
            """;

    private static final String FIND_SENSOR_DAYS = """
            SELECT activity.activity_date, sensor.code AS sensor_code,
                   SUM(activity.detection_count) AS detections,
                   SUM(activity.confident_count) AS confident_detections,
                   SUM(activity.frp_sum_mw) AS frp_sum_mw
            FROM fire.daily_region_activity AS activity
            JOIN ref.satellite AS satellite ON satellite.satellite_id = activity.satellite_id
            JOIN ref.sensor AS sensor ON sensor.sensor_id = satellite.sensor_id
            WHERE activity.region_id = :regionId AND activity.activity_date BETWEEN :from AND :to
            GROUP BY activity.activity_date, sensor.code
            ORDER BY activity.activity_date, sensor.code
            """;

    private static final String FIND_CLIMATOLOGY = """
            SELECT day_of_year, sample_years, mean_index, p50_index, p90_index, p95_index, critical_threshold
            FROM fire.region_climatology
            WHERE region_id = :regionId
            ORDER BY day_of_year
            """;

    // Actividad de cada región hija; el día pico es el de mayor índice (el más antiguo si empatan).
    private static final String FIND_CHILDREN_ACTIVITY = """
            WITH ranked AS (
                SELECT day.region_id, day.activity_date, day.harmonized_index, day.detected_index,
                       day.background_index, day.is_critical,
                       ROW_NUMBER() OVER (
                           PARTITION BY day.region_id ORDER BY day.harmonized_index DESC, day.activity_date
                       ) AS intensity_rank
                FROM fire.v_calendar_day AS day
                JOIN ref.region AS region ON region.region_id = day.region_id
                WHERE region.parent_region_id = :parentId AND day.activity_date BETWEEN :from AND :to
            )
            SELECT region_id,
                   SUM(harmonized_index) AS harmonized_index,
                   SUM(detected_index) AS detected_index,
                   SUM(background_index) AS background_index,
                   SUM(CAST(is_critical AS INT)) AS critical_days,
                   MAX(CASE WHEN intensity_rank = 1 THEN activity_date END) AS peak_date,
                   MAX(harmonized_index) AS peak_index
            FROM ranked
            GROUP BY region_id
            ORDER BY harmonized_index DESC
            """;

    private static final String FIND_OBSERVED_RANGE = """
            SELECT MIN(activity_date) AS first_date, MAX(activity_date) AS last_date
            FROM fire.observation_day
            """;

    private final JdbcClient jdbc;

    CalendarRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<CalendarDay> findDays(int regionId, DateRange range) {
        return jdbc.sql(FIND_DAYS)
                .param("regionId", regionId)
                .param("from", range.from())
                .param("to", range.to())
                .query(CalendarRepository::toCalendarDay)
                .list();
    }

    List<YearSummary> findYears(int regionId) {
        return jdbc.sql(FIND_YEARS)
                .param("regionId", regionId)
                .query((row, rowNumber) -> new YearSummary(
                        row.getInt("year"),
                        row.getInt("observed_days"),
                        row.getDouble("harmonized_index"),
                        row.getDouble("detected_index"),
                        row.getDouble("background_index"),
                        row.getDouble("peak_index"),
                        row.getInt("critical_days"),
                        row.getLong("modis_detections"),
                        row.getLong("viirs_detections")))
                .list();
    }

    List<SensorDay> findSensorDays(int regionId, DateRange range) {
        return jdbc.sql(FIND_SENSOR_DAYS)
                .param("regionId", regionId)
                .param("from", range.from())
                .param("to", range.to())
                .query((row, rowNumber) -> new SensorDay(
                        row.getObject("activity_date", LocalDate.class),
                        Sensor.valueOf(row.getString("sensor_code")),
                        row.getInt("detections"),
                        row.getInt("confident_detections"),
                        row.getDouble("frp_sum_mw")))
                .list();
    }

    List<ClimatologyDay> findClimatology(int regionId) {
        return jdbc.sql(FIND_CLIMATOLOGY)
                .param("regionId", regionId)
                .query((row, rowNumber) -> new ClimatologyDay(
                        row.getInt("day_of_year"),
                        row.getInt("sample_years"),
                        row.getDouble("mean_index"),
                        row.getDouble("p50_index"),
                        row.getDouble("p90_index"),
                        row.getDouble("p95_index"),
                        row.getDouble("critical_threshold")))
                .list();
    }

    List<RegionActivity> findChildrenActivity(int parentId, DateRange range) {
        return jdbc.sql(FIND_CHILDREN_ACTIVITY)
                .param("parentId", parentId)
                .param("from", range.from())
                .param("to", range.to())
                .query((row, rowNumber) -> new RegionActivity(
                        row.getInt("region_id"),
                        row.getDouble("harmonized_index"),
                        row.getDouble("detected_index"),
                        row.getDouble("background_index"),
                        row.getInt("critical_days"),
                        row.getObject("peak_date", LocalDate.class),
                        row.getDouble("peak_index")))
                .list();
    }

    /** Primer y último día con observación en toda la serie. */
    DateRange findObservedRange() {
        return jdbc.sql(FIND_OBSERVED_RANGE)
                .query((row, rowNumber) -> new DateRange(
                        row.getObject("first_date", LocalDate.class),
                        row.getObject("last_date", LocalDate.class)))
                .single();
    }

    private static CalendarDay toCalendarDay(ResultSet row, int rowNumber) throws SQLException {
        return new CalendarDay(
                row.getObject("activity_date", LocalDate.class),
                row.getDouble("harmonized_index"),
                row.getDouble("detected_index"),
                row.getDouble("background_index"),
                row.getObject("expected_index", Double.class),
                row.getObject("critical_threshold", Double.class),
                row.getBoolean("is_critical"),
                row.getString("source_code"));
    }
}
