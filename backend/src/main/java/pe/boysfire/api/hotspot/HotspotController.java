package pe.boysfire.api.hotspot;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.common.domain.ConfidenceLevel;
import pe.boysfire.api.common.domain.Sensor;
import pe.boysfire.api.common.query.BoundingBox;

@Tag(name = "Focos", description = "Focos de calor individuales, para el mapa a zoom alto")
@RestController
@RequestMapping("/api/hotspots")
class HotspotController {

    private final HotspotService service;

    HotspotController(HotspotService service) {
        this.service = service;
    }

    @Operation(summary = "Focos dentro de un área y un rango de fechas (hora de Perú)")
    @GetMapping
    HotspotPage search(
            @Parameter(description = "minLon,minLat,maxLon,maxLat", example = "-77,-13.5,-75.5,-12")
            @RequestParam String bbox,
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate to,
            @Parameter(description = "MODIS o VIIRS; sin valor, ambos")
            @RequestParam(required = false) Sensor sensor,
            @RequestParam(defaultValue = "LOW") ConfidenceLevel minConfidence,
            @RequestParam(required = false) Integer limit) {
        return service.search(BoundingBox.parse(bbox), from, to, sensor, minConfidence, limit);
    }
}
