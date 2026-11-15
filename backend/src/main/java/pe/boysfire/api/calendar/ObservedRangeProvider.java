package pe.boysfire.api.calendar;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import pe.boysfire.api.common.query.DateRange;

/**
 * Primer y último día de la serie, en caché.
 * Está en su propio componente porque {@code @Cacheable} solo actúa en llamadas entre beans.
 */
@Component
public class ObservedRangeProvider {

    private final CalendarRepository repository;

    ObservedRangeProvider(CalendarRepository repository) {
        this.repository = repository;
    }

    @Cacheable("observedRange")
    public DateRange get() {
        return repository.findObservedRange();
    }
}
