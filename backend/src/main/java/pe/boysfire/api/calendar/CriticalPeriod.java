package pe.boysfire.api.calendar;

import java.time.LocalDate;

/**
 * Racha de días críticos.
 *
 * @param criticalDays días críticos dentro del período (puede haber pausas breves entre ellos)
 * @param totalIndex   suma del índice armonizado de todos los días del período
 */
public record CriticalPeriod(
        LocalDate start,
        LocalDate end,
        int criticalDays,
        LocalDate peakDate,
        double peakIndex,
        double totalIndex) {
}
