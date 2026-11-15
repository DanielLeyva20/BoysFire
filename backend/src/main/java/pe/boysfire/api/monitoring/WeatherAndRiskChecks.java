package pe.boysfire.api.monitoring;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import pe.boysfire.api.risk.RiskProperties;

/** ¿El clima y el riesgo se están renovando y cubren todas las zonas? */
@Component
class WeatherAndRiskChecks implements CheckGroup {

    private final JdbcClient jdbc;
    private final Clock clock;
    private final RiskProperties properties;

    WeatherAndRiskChecks(JdbcClient jdbc, Clock clock, RiskProperties properties) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.properties = properties;
    }

    @Override
    public List<CheckResult> run() {
        return List.of(lastRefresh(), coverage());
    }

    private CheckResult lastRefresh() {
        String code = "WEATHER_REFRESH";
        String title = "Clima y riesgo actualizados";
        record Run(String status, LocalDateTime startedAt, String error) {
        }
        Run last = jdbc.sql("SELECT TOP (1) status, started_at, error_message FROM risk.refresh_run ORDER BY refresh_run_id DESC")
                .query((row, rowNumber) -> new Run(row.getString("status"), row.getObject("started_at", LocalDateTime.class),
                        row.getString("error_message")))
                .optional().orElse(null);
        if (last == null) {
            return CheckResult.warning(code, title, "Todavía no se calculó el riesgo; se hace al iniciar la API.");
        }
        if ("FAILED".equals(last.status())) {
            return CheckResult.error(code, title, "El último cálculo falló: " + last.error());
        }
        LocalDateTime nowUtc = LocalDateTime.now(clock.withZone(ZoneOffset.UTC));
        long minutes = Duration.between(last.startedAt(), nowUtc).toMinutes();
        String message = "Último cálculo hace %d min (se renueva cada %d h).".formatted(minutes, properties.refreshInterval().toHours());
        return minutes <= properties.refreshInterval().multipliedBy(2).toMinutes()
                ? CheckResult.ok(code, title, message)
                : CheckResult.warning(code, title, message + " Va atrasado: revisa la conexión con Open-Meteo.");
    }

    private CheckResult coverage() {
        String code = "RISK_COVERAGE";
        String title = "Zonas con riesgo calculado hoy";
        LocalDate today = LocalDate.now(clock);
        int regions = jdbc.sql("SELECT COUNT(*) FROM ref.region").query(Integer.class).single();
        int assessed = jdbc.sql("SELECT COUNT(*) FROM risk.assessment WHERE assessment_date = :today").param("today", today)
                .query(Integer.class).single();
        int withoutWeather = jdbc.sql("""
                        SELECT COUNT(*) FROM ref.region AS region
                        WHERE region.region_level_id = 3
                          AND NOT EXISTS (SELECT 1 FROM risk.weather_day AS weather
                                          WHERE weather.region_id = region.region_id AND weather.forecast_date = :today)
                        """)
                .param("today", today).query(Integer.class).single();
        String message = "%d de %d zonas evaluadas; %d provincias sin clima de hoy.".formatted(assessed, regions, withoutWeather);
        return assessed == regions && withoutWeather == 0 ? CheckResult.ok(code, title, message) : CheckResult.warning(code, title, message);
    }
}
