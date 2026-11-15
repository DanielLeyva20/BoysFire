package pe.boysfire.api.region;

import java.util.List;
import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import pe.boysfire.api.common.config.ApiProperties;
import pe.boysfire.api.common.error.ResourceNotFoundException;
import pe.boysfire.api.common.geo.GeoJsonFeature;
import pe.boysfire.api.common.geo.GeoJsonFeatureCollection;
import pe.boysfire.api.common.geo.WktToGeoJson;

@Service
public class RegionService {

    private final RegionCatalogProvider catalog;
    private final RegionRepository repository;
    private final ApiProperties properties;

    RegionService(RegionCatalogProvider catalog, RegionRepository repository, ApiProperties properties) {
        this.catalog = catalog;
        this.repository = repository;
        this.properties = properties;
    }

    /** La región, o un error 404 si no existe. Lo usan los demás módulos para validar {@code regionId}. */
    public Region require(int regionId) {
        return catalog.get().find(regionId)
                .orElseThrow(() -> new ResourceNotFoundException("No existe la región " + regionId + "."));
    }

    public Region country() {
        return catalog.get().ofLevel(RegionLevel.COUNTRY).getFirst();
    }

    public RegionDetail detail(int regionId) {
        return catalog.get().detailOf(require(regionId));
    }

    public List<Region> children(int parentId) {
        require(parentId);
        return catalog.get().childrenOf(parentId);
    }

    public List<Region> ofLevel(RegionLevel level) {
        return catalog.get().ofLevel(level);
    }

    public List<RegionDetail> search(String text) {
        return catalog.get().search(text, properties.limits().regionSearchMaxResults());
    }

    /** Distrito, provincia y departamento que contienen un punto. */
    public RegionDetail locate(double latitude, double longitude) {
        int districtId = repository.findDistrictIdAt(latitude, longitude)
                .orElseThrow(() -> new ResourceNotFoundException("El punto no cae dentro de ningún distrito cargado."));
        return detail(districtId);
    }

    @Cacheable("regionGeometry")
    public GeoJsonFeature<Region> geometry(int regionId) {
        Region region = require(regionId);
        String wkt = repository.findGeometryWkt(regionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "La región '%s' no tiene geometría propia. Pide la de sus regiones hijas.".formatted(region.name())));
        return new GeoJsonFeature<>(region.id(), WktToGeoJson.convert(wkt), region);
    }

    /** Contorno de cada región hija, para pintar el mapa de un nivel completo. */
    @Cacheable("regionChildrenGeometry")
    public GeoJsonFeatureCollection<Region> childrenGeometry(int parentId) {
        Map<Integer, String> wktById = repository.findChildrenGeometryWkt(parentId);
        List<GeoJsonFeature<Region>> features = children(parentId).stream()
                .filter(child -> wktById.containsKey(child.id()))
                .map(child -> new GeoJsonFeature<>(child.id(), WktToGeoJson.convert(wktById.get(child.id())), child))
                .toList();
        return new GeoJsonFeatureCollection<>(features);
    }
}
