package pe.boysfire.api.monitoring;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** ¿Los datos satelitales están al día y son coherentes? */
@Component
class SatelliteDataChecks implements CheckGroup {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale.forLanguageTag("es-PE"));
    /** Los datos casi en tiempo real de FIRMS llegan con unas horas de retraso: dos días es lo normal. */
    private static final int FRESH_DAYS = 2;
    private static final int STALE_DAYS = 7;
    private static final int GAP_WINDOW_DAYS = 60;
    private static final int ACCEPTABLE_GAPS = 2;

    private final JdbcClient jdbc;
    private final Clock clock;
    private final boolean firmsKeyConfigured;

    SatelliteDataChecks(JdbcClient jdbc, Clock clock, @Value("${FIRMS_MAP_KEY:}") String firmsKey) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.firmsKeyConfigured = !firmsKey.isBlank();
    }

    @Override
    public List<CheckResult> run() {
        LocalDate today = LocalDate.now(clock);
        LocalDate lastObserved = jdbc.sql("SELECT MAX(activity_date) FROM fire.observation_day").query(LocalDate.class).single();
        return List.of(freshness(today, lastObserved), automaticIngest(), gaps(lastObserved), futureDetections(today), harmonization());
    }

    private CheckResult freshness(LocalDate today, LocalDate lastObserved) {
        String code = "HOTSPOT_FRESHNESS";
        String title = "Datos de focos al día";
        if (lastObserved == null) {
            return CheckResult.error(code, title, "No hay focos cargados. Ejecuta la ingesta y la armonización.");
        }
        long age = ChronoUnit.DAYS.between(lastObserved, today);
        String message = "Último día con datos: %s (hace %d día%s).".formatted(DAY.format(lastObserved), age, age == 1 ? "" : "s");
        if (age <= FRESH_DAYS) {
            return CheckResult.ok(code, title, message);
        }
        return age <= STALE_DAYS
                ? CheckResult.warning(code, title, message + " Las alertas por focos usan datos atrasados.")
                : CheckResult.error(code, title, message + " El factor «foco detectado» ya no se aplica al riesgo.");
    }

    private CheckResult automaticIngest() {
        String code = "FIRMS_INGEST";
        String title = "Actualización automática de focos (NASA FIRMS)";
        return firmsKeyConfigured
                ? CheckResult.ok(code, title, "La clave de FIRMS está configurada.")
                : CheckResult.warning(code, title, "Falta FIRMS_MAP_KEY en el .env: los focos nuevos se cargan solo a mano.");
    }

    private CheckResult gaps(LocalDate lastObserved) {
        String code = "OBSERVATION_GAPS";
        String title = "Días sin observación satelital";
        if (lastObserved == null) {
            return CheckResult.warning(code, title, "Sin datos para revisar.");
        }
        int observed = jdbc.sql("SELECT COUNT(*) FROM fire.observation_day WHERE activity_date BETWEEN :from AND :to")
                .param("from", lastObserved.minusDays(GAP_WINDOW_DAYS - 1L))
                .param("to", lastObserved)
                .query(Integer.class).single();
        int missing = GAP_WINDOW_DAYS - observed;
        String message = "%d de los últimos %d días no tienen observación de ningún satélite.".formatted(missing, GAP_WINDOW_DAYS);
        return missing <= ACCEPTABLE_GAPS ? CheckResult.ok(code, title, message)
                : CheckResult.warning(code, title, message + " En esos días el calendario muestra huecos, no calma.");
    }

    private CheckResult futureDetections(LocalDate today) {
        String code = "FUTURE_DETECTIONS";
        String title = "Focos con fecha imposible";
        int future = jdbc.sql("SELECT COUNT(*) FROM fire.hotspot WHERE acq_date_local > :today").param("today", today)
                .query(Integer.class).single();
        return future == 0
                ? CheckResult.ok(code, title, "Ningún foco tiene fecha posterior a hoy.")
                : CheckResult.error(code, title, "%d focos tienen fecha futura: revisa la zona horaria de la ingesta.".formatted(future));
    }

    private CheckResult harmonization() {
        String code = "HARMONIZATION_RUN";
        String title = "Última armonización MODIS + VIIRS";
        record Run(String status, LocalDateTime finishedAt, String error) {
        }
        Run run = jdbc.sql("SELECT TOP (1) status, finished_at, error_message FROM ingest.pipeline_run ORDER BY pipeline_run_id DESC")
                .query((row, rowNumber) -> new Run(row.getString("status"), row.getObject("finished_at", LocalDateTime.class),
                        row.getString("error_message")))
                .optional().orElse(null);
        if (run == null) {
            return CheckResult.error(code, title, "Nunca se ejecutó la armonización.");
        }
        return switch (run.status()) {
            case "SUCCESS" -> CheckResult.ok(code, title, "Terminó correctamente.");
            case "RUNNING" -> CheckResult.warning(code, title, "Está en curso o se interrumpió.");
            default -> CheckResult.error(code, title, "Falló: " + run.error());
        };
    }
}
