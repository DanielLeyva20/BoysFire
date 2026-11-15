package pe.boysfire.api.risk;

/** Punto donde se consulta el clima de una región. */
public record GeoPoint(int regionId, double latitude, double longitude) {
}
