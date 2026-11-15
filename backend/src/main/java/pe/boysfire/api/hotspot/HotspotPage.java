package pe.boysfire.api.hotspot;

import java.util.List;

/**
 * Resultado de una consulta de focos.
 *
 * @param truncated {@code true} si había más focos que el límite: conviene acercar el mapa o acortar las fechas
 */
public record HotspotPage(int count, boolean truncated, List<Hotspot> items) {

    /** {@code found} puede traer un foco más que el límite; ese sobrante solo indica que hay más. */
    static HotspotPage of(List<Hotspot> found, int limit) {
        boolean truncated = found.size() > limit;
        List<Hotspot> items = truncated ? found.subList(0, limit) : found;
        return new HotspotPage(items.size(), truncated, items);
    }
}
