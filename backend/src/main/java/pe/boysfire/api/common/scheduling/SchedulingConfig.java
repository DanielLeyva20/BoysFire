package pe.boysfire.api.common.scheduling;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.annotation.SchedulingConfigurer;

/**
 * Programa todos los {@link ScheduledJob}. Cada trabajo corre con espera fija entre una
 * ejecución y la siguiente, y en su propio hilo: uno lento (el clima) no frena a uno rápido
 * (leer Telegram). Un error se registra y no detiene las ejecuciones siguientes.
 */
@Configuration
public class SchedulingConfig implements SchedulingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(SchedulingConfig.class);

    private final List<ScheduledJob> jobs;

    public SchedulingConfig(List<ScheduledJob> jobs) {
        this.jobs = jobs;
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(Math.max(2, jobs.size()));
        scheduler.setThreadNamePrefix("job-");
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);

        for (ScheduledJob job : jobs) {
            registrar.addFixedDelayTask(new FixedDelayTask(() -> runSafely(job), job.interval(), job.initialDelay()));
            log.info("Trabajo programado: {} cada {}", job.name(), job.interval());
        }
    }

    private static void runSafely(ScheduledJob job) {
        try {
            job.run();
        } catch (RuntimeException exception) {
            log.error("Falló el trabajo '{}'", job.name(), exception);
        }
    }
}
