package pe.boysfire.api.common.geo;

/** Entidad GeoJSON: una geometría con sus atributos. */
public record GeoJsonFeature<P>(String type, Integer id, GeoJsonGeometry geometry, P properties) {

    public GeoJsonFeature(Integer id, GeoJsonGeometry geometry, P properties) {
        this("Feature", id, geometry, properties);
    }
}
