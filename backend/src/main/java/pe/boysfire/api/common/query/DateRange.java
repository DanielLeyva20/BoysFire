package pe.boysfire.api.common.query;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import pe.boysfire.api.common.error.InvalidRequestException;

/** Rango de fechas cerrado: incluye ambos extremos. */
public record DateRange(LocalDate from, LocalDate to) {

    public DateRange {
        if (from.isAfter(to)) {
            throw new InvalidRequestException("La fecha 'from' (%s) no puede ser posterior a 'to' (%s).".formatted(from, to));
        }
    }

    public long days() {
        return ChronoUnit.DAYS.between(from, to) + 1;
    }

    /** Devuelve el mismo rango, o falla si abarca más de {@code maxDays} días. */
    public DateRange requireAtMost(int maxDays) {
        if (days() > maxDays) {
            throw new InvalidRequestException(
                    "El rango de fechas abarca %d días; el máximo para esta consulta es %d.".formatted(days(), maxDays));
        }
        return this;
    }
}
