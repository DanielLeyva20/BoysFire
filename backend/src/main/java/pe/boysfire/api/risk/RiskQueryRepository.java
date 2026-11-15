package pe.boysfire.api.risk;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import pe.boysfire.api.risk.RiskViews.DayRisk;
import pe.boysfire.api.risk.RiskViews.FactorReading;
import pe.boysfire.api.risk.RiskViews.RegionRisk;
import pe.boysfire.api.risk.RiskViews.WeatherView;

/** Lectura de las evaluaciones de riesgo ya calculadas. */
@Repository
class RiskQueryRepository {

    private final JdbcClient jdbc;

    RiskQueryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    record StoredAssessment(RiskLevel level, int score, Integer weatherRegionId, LocalDateTime computedAt) {
    }

    record StoredFactor(String code, String name, String description, String unit, int points, Double observedValue,
                        Double affectedShare) {
    }

    record Recommendation(String factorCode, Integer minLevelId, String text) {
    }

    record LastRun(LocalDateTime startedAt, String status) {
    }

    Optional<StoredAssessment> findAssessment(int regionId, LocalDate date) {
        return jdbc.sql("""
                        SELECT risk_level_id, score, weather_region_id, computed_at
                        FROM risk.assessment WHERE region_id = :regionId AND assessment_date = :date
                        """)
                .param("regionId", regionId)
                .param("date", date)
                .query((row, rowNumber) -> new StoredAssessment(
                        RiskLevel.fromId(row.getInt("risk_level_id")),
                        row.getInt("score"),
                        row.getObject("weather_region_id", Integer.class),
                        row.getObject("computed_at", LocalDateTime.class)))
                .optional();
    }

    List<StoredFactor> findFactors(int regionId, LocalDate date) {
        return jdbc.sql("""
                        SELECT factor.code, factor.name_es, factor.description_es, factor.unit, active.points,
                               CAST(active.observed_value AS FLOAT) AS observed_value,
                               CAST(active.affected_share AS FLOAT) AS affected_share
                        FROM risk.assessment_factor AS active
                        JOIN ref.risk_factor AS factor ON factor.risk_factor_id = active.risk_factor_id
                        WHERE active.region_id = :regionId AND active.assessment_date = :date
                        ORDER BY active.points DESC, factor.risk_factor_id
                        """)
                .param("regionId", regionId)
                .param("date", date)
                .query((row, rowNumber) -> new StoredFactor(
                        row.getString("code"),
                        row.getString("name_es"),
                        row.getString("description_es"),
                        row.getString("unit"),
                        row.getInt("points"),
                        row.getObject("observed_value", Double.class),
                        row.getObject("affected_share", Double.class)))
                .list();
    }

    Optional<WeatherView> findWeather(int regionId, LocalDate date) {
        return jdbc.sql("""
                        SELECT CAST(temperature_max_c AS FLOAT) AS temperature, humidity_min_pct, CAST(wind_max_kmh AS FLOAT) AS wind,
                               CAST(gust_max_kmh AS FLOAT) AS gust, CAST(precipitation_mm AS FLOAT) AS rain, days_without_rain
                        FROM risk.weather_day WHERE region_id = :regionId AND forecast_date = :date
                        """)
                .param("regionId", regionId)
                .param("date", date)
                .query((row, rowNumber) -> new WeatherView(
                        row.getDouble("temperature"), row.getInt("humidity_min_pct"), row.getDouble("wind"),
                        row.getDouble("gust"), row.getDouble("rain"), row.getInt("days_without_rain")))
                .optional();
    }

    List<RegionRisk> findChildren(int parentId, LocalDate date) {
        return jdbc.sql("""
                        SELECT assessment.region_id, assessment.risk_level_id, assessment.score
                        FROM risk.assessment AS assessment
                        JOIN ref.region AS region ON region.region_id = assessment.region_id
                        WHERE region.parent_region_id = :parentId AND assessment.assessment_date = :date
                        ORDER BY assessment.score DESC, assessment.region_id
                        """)
                .param("parentId", parentId)
                .param("date", date)
                .query((row, rowNumber) -> new RegionRisk(
                        row.getInt("region_id"), RiskLevel.fromId(row.getInt("risk_level_id")), row.getInt("score")))
                .list();
    }

    /** Las regiones de un nivel con mayor riesgo en un día, de mayor a menor. */
    List<RegionRisk> findTop(int levelId, LocalDate date, RiskLevel minLevel, int limit) {
        return jdbc.sql("""
                        SELECT TOP (:limit) assessment.region_id, assessment.risk_level_id, assessment.score
                        FROM risk.assessment AS assessment
                        JOIN ref.region AS region ON region.region_id = assessment.region_id
                        WHERE region.region_level_id = :levelId AND assessment.assessment_date = :date
                          AND assessment.risk_level_id >= :minLevel
                        ORDER BY assessment.score DESC, assessment.region_id
                        """)
                .param("limit", limit)
                .param("levelId", levelId)
                .param("date", date)
                .param("minLevel", minLevel.id())
                .query((row, rowNumber) -> new RegionRisk(
                        row.getInt("region_id"), RiskLevel.fromId(row.getInt("risk_level_id")), row.getInt("score")))
                .list();
    }

    /** Regiones de un nivel cuyo factor tiene, en un día, al menos el valor indicado. */
    List<FactorReading> findWithFactor(int levelId, LocalDate date, RiskFactor factor, double minValue) {
        return jdbc.sql("""
                        SELECT active.region_id, CAST(active.observed_value AS FLOAT) AS observed_value
                        FROM risk.assessment_factor AS active
                        JOIN ref.region AS region ON region.region_id = active.region_id
                        WHERE region.region_level_id = :levelId AND active.assessment_date = :date
                          AND active.risk_factor_id = :factorId AND active.observed_value >= :minValue
                        ORDER BY active.observed_value DESC
                        """)
                .param("levelId", levelId)
                .param("date", date)
                .param("factorId", factor.id())
                .param("minValue", minValue)
                .query((row, rowNumber) -> new FactorReading(row.getInt("region_id"), row.getDouble("observed_value")))
                .list();
    }

    List<DayRisk> findForecast(int regionId, LocalDate from) {
        return jdbc.sql("""
                        SELECT assessment_date, risk_level_id, score FROM risk.assessment
                        WHERE region_id = :regionId AND assessment_date >= :from
                        ORDER BY assessment_date
                        """)
                .param("regionId", regionId)
                .param("from", from)
                .query((row, rowNumber) -> new DayRisk(
                        row.getObject("assessment_date", LocalDate.class),
                        RiskLevel.fromId(row.getInt("risk_level_id")),
                        row.getInt("score")))
                .list();
    }

    List<Recommendation> findRecommendations() {
        return jdbc.sql("""
                        SELECT factor.code AS factor_code, recommendation.min_risk_level_id, recommendation.text_es
                        FROM ref.recommendation AS recommendation
                        LEFT JOIN ref.risk_factor AS factor ON factor.risk_factor_id = recommendation.risk_factor_id
                        ORDER BY recommendation.sort_order, recommendation.recommendation_id
                        """)
                .query((row, rowNumber) -> new Recommendation(
                        row.getString("factor_code"), row.getObject("min_risk_level_id", Integer.class), row.getString("text_es")))
                .list();
    }

    Optional<LastRun> findLastRun(boolean successfulOnly) {
        return jdbc.sql("""
                        SELECT TOP (1) started_at, status FROM risk.refresh_run
                        WHERE (:successfulOnly = 0 OR status = 'SUCCESS')
                        ORDER BY refresh_run_id DESC
                        """)
                .param("successfulOnly", successfulOnly ? 1 : 0)
                .query((row, rowNumber) -> new LastRun(row.getObject("started_at", LocalDateTime.class), row.getString("status")))
                .optional();
    }

    Optional<LocalDate> findLastObservedDate() {
        return Optional.ofNullable(jdbc.sql("SELECT MAX(activity_date) FROM fire.observation_day").query(LocalDate.class).single());
    }
}
