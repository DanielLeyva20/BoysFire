package pe.boysfire.api.common.geo;

import java.util.List;

/** Colección GeoJSON, lista para pasarla a una capa del mapa. */
public record GeoJsonFeatureCollection<P>(String type, List<GeoJsonFeature<P>> features) {

    public GeoJsonFeatureCollection(List<GeoJsonFeature<P>> features) {
        this("FeatureCollection", features);
    }
}
