package pe.boysfire.api.meta;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Datos", description = "Cobertura de los datos y calidad de la armonización")
@RestController
@RequestMapping("/api/meta")
class MetaController {

    private final MetaService service;

    MetaController(MetaService service) {
        this.service = service;
    }

    @Operation(summary = "Rango de fechas disponible, volumen de datos y métricas de validación")
    @GetMapping
    DataSummary summary() {
        return service.summary();
    }
}
