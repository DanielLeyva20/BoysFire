package pe.boysfire.api.risk;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.risk.RiskViews.DayRisk;
import pe.boysfire.api.risk.RiskViews.RegionRisk;
import pe.boysfire.api.risk.RiskViews.RiskStatus;
import pe.boysfire.api.risk.RiskViews.ZoneRisk;

/** Sin {@code regionId} se responde para el país; sin {@code date}, para hoy (hora de Perú). */
@Tag(name = "Prevención", description = "Riesgo de incendio por zona, sus factores y qué hacer")
@RestController
@RequestMapping("/api/risk")
class RiskController {

    private final RiskService service;

    RiskController(RiskService service) {
        this.service = service;
    }

    @Operation(summary = "Riesgo de una zona en un día, con los factores que lo explican y las recomendaciones")
    @GetMapping
    ZoneRisk zone(
            @RequestParam(required = false) Integer regionId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate date) {
        return service.zone(regionId, date);
    }

    @Operation(summary = "Riesgo de cada región hija, de mayor a menor")
    @GetMapping("/children")
    List<RegionRisk> children(
            @RequestParam(required = false) Integer parentId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate date) {
        return service.children(parentId, date);
    }

    @Operation(summary = "Riesgo de los próximos días en una zona")
    @GetMapping("/forecast")
    List<DayRisk> forecast(@RequestParam(required = false) Integer regionId) {
        return service.forecast(regionId);
    }

    @Operation(summary = "Cuándo se calculó el riesgo por última vez y con qué datos")
    @GetMapping("/status")
    RiskStatus status() {
        return service.status();
    }
}
