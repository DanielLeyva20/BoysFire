package pe.boysfire.api.meta;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Qué datos hay cargados y qué tan bien quedó la armonización.
 *
 * @param firstDate         primer día de la serie
 * @param lastDate          último día de la serie
 * @param hotspotCount      focos limpios disponibles
 * @param lastHarmonizedUtc cuándo terminó la última armonización correcta
 * @param sourceDays        días que alimenta cada grupo de satélites (SNPP, MODIS, …)
 * @param metrics           métricas de la última armonización (validación contra VIIRS, filas excluidas, …)
 */
public record DataSummary(
        LocalDate firstDate,
        LocalDate lastDate,
        long hotspotCount,
        LocalDateTime lastHarmonizedUtc,
        Map<String, Integer> sourceDays,
        Map<String, Double> metrics) {
}
