package pe.boysfire.api.region;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.common.geo.GeoJsonFeature;
import pe.boysfire.api.common.geo.GeoJsonFeatureCollection;

@Tag(name = "Regiones", description = "País, departamentos, provincias y distritos")
@RestController
@RequestMapping("/api/regions")
class RegionController {

    private final RegionService service;

    RegionController(RegionService service) {
        this.service = service;
    }

    @Operation(summary = "Lista regiones: las hijas de 'parentId', o todas las de un 'level'. Sin parámetros, el país.")
    @GetMapping
    List<Region> list(
            @RequestParam(required = false) Integer parentId,
            @RequestParam(required = false) RegionLevel level) {
        if (parentId != null) {
            return service.children(parentId);
        }
        return service.ofLevel(level != null ? level : RegionLevel.COUNTRY);
    }

    @Operation(summary = "Busca regiones por nombre, sin distinguir mayúsculas ni tildes")
    @GetMapping("/search")
    List<RegionDetail> search(@RequestParam @NotBlank String q) {
        return service.search(q);
    }

    @Operation(summary = "Distrito, provincia y departamento que contienen un punto")
    @GetMapping("/locate")
    RegionDetail locate(
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double latitude,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double longitude) {
        return service.locate(latitude, longitude);
    }

    @Operation(summary = "Una región con sus ancestros")
    @GetMapping("/{regionId}")
    RegionDetail detail(@PathVariable int regionId) {
        return service.detail(regionId);
    }

    @Operation(summary = "Contorno de la región en GeoJSON")
    @GetMapping(value = "/{regionId}/geometry", produces = "application/geo+json")
    GeoJsonFeature<Region> geometry(@PathVariable int regionId) {
        return service.geometry(regionId);
    }

    @Operation(summary = "Contorno de cada región hija en GeoJSON (p. ej. todos los departamentos del país)")
    @GetMapping(value = "/{regionId}/children/geometry", produces = "application/geo+json")
    GeoJsonFeatureCollection<Region> childrenGeometry(@PathVariable int regionId) {
        return service.childrenGeometry(regionId);
    }
}
