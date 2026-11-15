package pe.boysfire.api.mapcell;

/**
 * Actividad acumulada de una celda hexagonal del mapa (H3 resolución 5, ~250 km²) en un rango de fechas.
 *
 * @param h3              índice H3 en texto, como lo esperan h3-js y deck.gl
 * @param latitude        centro de la celda
 * @param activeLoci      celdas de ~1 km con fuego detectado, sumadas por día
 * @param harmonizedIndex detectado + fondo
 */
public record MapCell(
        String h3,
        double latitude,
        double longitude,
        long activeLoci,
        double detectedIndex,
        double backgroundIndex,
        double harmonizedIndex) {
}
