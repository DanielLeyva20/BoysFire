package pe.boysfire.api.mapcell;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.common.query.BoundingBox;

@Tag(name = "Mapa", description = "Actividad agregada en celdas hexagonales, para el mapa a zoom bajo y medio")
@RestController
@RequestMapping("/api/map")
class MapCellController {

    private final MapCellService service;

    MapCellController(MapCellService service) {
        this.service = service;
    }

    @Operation(summary = "Índice armonizado acumulado por celda H3 en un rango de fechas")
    @GetMapping("/cells")
    List<MapCell> cells(
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = ISO.DATE) LocalDate to,
            @Parameter(description = "minLon,minLat,maxLon,maxLat; sin valor, todo el país")
            @RequestParam(required = false) String bbox,
            @Parameter(description = "false = solo celdas con fuego detectado, sin el fondo estimado")
            @RequestParam(defaultValue = "true") boolean includeBackground) {
        BoundingBox area = bbox == null ? null : BoundingBox.parse(bbox);
        return service.cells(from, to, area, includeBackground);
    }
}
