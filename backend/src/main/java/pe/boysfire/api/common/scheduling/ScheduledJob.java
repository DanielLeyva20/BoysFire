package pe.boysfire.api.common.scheduling;

import java.time.Duration;

/**
 * Trabajo periódico. Cada módulo declara los suyos como beans y {@link SchedulingConfig}
 * los programa; así los intervalos salen de la configuración y no de anotaciones fijas.
 */
public interface ScheduledJob {

    String name();

    Duration interval();

    Duration initialDelay();

    void run();
}
