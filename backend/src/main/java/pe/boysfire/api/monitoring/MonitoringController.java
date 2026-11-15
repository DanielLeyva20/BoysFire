package pe.boysfire.api.monitoring;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.monitoring.MonitoringService.Overview;

@Tag(name = "Operación: monitoreo", description = "Estado de los datos y zonas en vigilancia")
@RestController
@RequestMapping("/api/ops/monitoring")
class MonitoringController {

    private final MonitoringService service;

    MonitoringController(MonitoringService service) {
        this.service = service;
    }

    @Operation(summary = "Estado de cada revisión, zonas en vigilancia y pendientes")
    @GetMapping
    Overview overview() {
        return service.overview();
    }

    @Operation(summary = "Correr ahora todas las revisiones")
    @PostMapping("/run")
    List<CheckResult> run() {
        return service.runChecks();
    }
}
