package pe.boysfire.api.region;

import java.util.List;

/**
 * Una región con su ubicación en la jerarquía.
 *
 * @param ancestors del país hacia abajo, sin incluir la propia región
 * @param path      nombre completo legible, p. ej. "San Vicente de Cañete, Cañete, Lima"
 */
public record RegionDetail(Region region, List<Region> ancestors, String path) {
}
