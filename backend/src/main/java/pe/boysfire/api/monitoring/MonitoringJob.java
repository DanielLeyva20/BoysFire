package pe.boysfire.api.monitoring;

import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;
import pe.boysfire.api.common.scheduling.ScheduledJob;

/** Revisa periódicamente los datos satelitales, el clima y la operación. */
@Component
class MonitoringJob implements ScheduledJob {

    /** Espera para que el primer cálculo de riesgo termine antes de la primera revisión. */
    private static final Duration FIRST_RUN_DELAY = Duration.ofMinutes(1);

    private final MonitoringService service;
    private final MonitoringProperties properties;

    MonitoringJob(MonitoringService service, MonitoringProperties properties) {
        this.service = service;
        this.properties = properties;
    }

    @Validated
    @ConfigurationProperties("boysfire.monitoring")
    record MonitoringProperties(@NotNull Duration interval) {
    }

    @Override
    public String name() {
        return "revisiones de monitoreo";
    }

    @Override
    public Duration interval() {
        return properties.interval();
    }

    @Override
    public Duration initialDelay() {
        return FIRST_RUN_DELAY;
    }

    @Override
    public void run() {
        service.runChecks();
    }
}
