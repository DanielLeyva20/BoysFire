package pe.boysfire.api.common.geo;

/**
 * Geometría GeoJSON.
 *
 * @param type        "Polygon" o "MultiPolygon"
 * @param coordinates anillos de posiciones [longitud, latitud], anidados según el tipo
 */
public record GeoJsonGeometry(String type, Object coordinates) {
}
