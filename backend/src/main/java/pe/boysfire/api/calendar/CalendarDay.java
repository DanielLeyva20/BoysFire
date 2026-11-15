package pe.boysfire.api.calendar;

import java.time.LocalDate;

/**
 * Un día del calendario de una región.
 *
 * @param harmonizedIndex   actividad del día en "celdas activas equivalentes de VIIRS S-NPP" (detectado + fondo)
 * @param detectedIndex     parte que viene de focos detectados
 * @param backgroundIndex   parte estimada: fuego pequeño que el sensor de ese día no alcanza a ver
 * @param expectedIndex     lo normal para ese día del año en la región
 * @param criticalThreshold valor a partir del cual el día se considera crítico
 * @param source            grupo de satélites que alimenta el día (SNPP, NOAA20, MODIS, AQUA, TERRA)
 */
public record CalendarDay(
        LocalDate date,
        double harmonizedIndex,
        double detectedIndex,
        double backgroundIndex,
        Double expectedIndex,
        Double criticalThreshold,
        boolean critical,
        String source) {
}
