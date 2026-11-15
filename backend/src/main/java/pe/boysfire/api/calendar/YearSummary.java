package pe.boysfire.api.calendar;

/**
 * Resumen de un año en una región. Junta la serie armonizada con los focos crudos por
 * sensor, para mostrar el "salto falso" de 2012 junto a la serie corregida.
 *
 * @param observedDays    días con algún satélite observando
 * @param peakIndex       índice del día más intenso del año
 * @param modisDetections focos limpios de MODIS, sin armonizar
 * @param viirsDetections focos limpios de VIIRS, sin armonizar
 */
public record YearSummary(
        int year,
        int observedDays,
        double harmonizedIndex,
        double detectedIndex,
        double backgroundIndex,
        double peakIndex,
        int criticalDays,
        long modisDetections,
        long viirsDetections) {
}
