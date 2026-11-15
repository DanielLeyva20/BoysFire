package pe.boysfire.api.hotspot;

import java.time.LocalDate;
import org.springframework.stereotype.Service;
import pe.boysfire.api.common.config.ApiProperties;
import pe.boysfire.api.common.config.ApiProperties.Limits;
import pe.boysfire.api.common.domain.ConfidenceLevel;
import pe.boysfire.api.common.domain.Sensor;
import pe.boysfire.api.common.error.InvalidRequestException;
import pe.boysfire.api.common.query.BoundingBox;
import pe.boysfire.api.common.query.DateRange;

@Service
public class HotspotService {

    private final HotspotRepository repository;
    private final Limits limits;

    HotspotService(HotspotRepository repository, ApiProperties properties) {
        this.repository = repository;
        this.limits = properties.limits();
    }

    /**
     * Focos dentro de un área y un rango de fechas.
     *
     * @param sensor {@code null} para todos
     * @param limit  {@code null} para el límite por defecto
     */
    public HotspotPage search(
            BoundingBox area, LocalDate from, LocalDate to, Sensor sensor, ConfidenceLevel minConfidence, Integer limit) {
        DateRange dates = new DateRange(from, to).requireAtMost(limits.hotspotMaxDays());
        int effectiveLimit = resolveLimit(limit);
        HotspotQuery query = new HotspotQuery(area, dates, sensor, minConfidence, effectiveLimit);
        return HotspotPage.of(repository.find(query), effectiveLimit);
    }

    private int resolveLimit(Integer requested) {
        if (requested == null) {
            return limits.hotspotDefaultLimit();
        }
        if (requested < 1 || requested > limits.hotspotMaxLimit()) {
            throw new InvalidRequestException("El 'limit' debe estar entre 1 y %d.".formatted(limits.hotspotMaxLimit()));
        }
        return requested;
    }
}
