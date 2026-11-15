package pe.boysfire.api.monitoring;

import java.util.List;

/**
 * Un grupo de revisiones relacionadas. Agregar una revisión es agregar un resultado a un
 * grupo, o un grupo nuevo: {@link MonitoringService} los encuentra todos.
 */
interface CheckGroup {

    List<CheckResult> run();
}
