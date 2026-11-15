package pe.boysfire.api.calendar;

import java.time.LocalDate;

/**
 * Actividad de una región en un rango de fechas, para comparar regiones hermanas
 * (ranking y mapa coloreado por región).
 *
 * @param peakDate  día más intenso del rango
 * @param peakIndex índice armonizado de ese día
 */
public record RegionActivity(
        int regionId,
        double harmonizedIndex,
        double detectedIndex,
        double backgroundIndex,
        int criticalDays,
        LocalDate peakDate,
        double peakIndex) {
}
