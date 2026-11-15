package pe.boysfire.api.mapcell;

import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import pe.boysfire.api.common.config.ApiProperties;
import pe.boysfire.api.common.query.BoundingBox;
import pe.boysfire.api.common.query.DateRange;

@Service
public class MapCellService {

    private static final BoundingBox WHOLE_WORLD = new BoundingBox(-180, -90, 180, 90);

    private final MapCellRepository repository;
    private final int maxDays;

    MapCellService(MapCellRepository repository, ApiProperties properties) {
        this.repository = repository;
        this.maxDays = properties.limits().mapCellMaxDays();
    }

    /**
     * Actividad acumulada por celda del mapa.
     *
     * @param area              {@code null} para todo el país
     * @param includeBackground si es {@code false}, solo las celdas con fuego detectado
     */
    public List<MapCell> cells(LocalDate from, LocalDate to, BoundingBox area, boolean includeBackground) {
        DateRange dates = new DateRange(from, to).requireAtMost(maxDays);
        BoundingBox effectiveArea = area != null ? area : WHOLE_WORLD;
        return includeBackground
                ? repository.findHarmonized(dates, effectiveArea)
                : repository.findDetected(dates, effectiveArea);
    }
}
