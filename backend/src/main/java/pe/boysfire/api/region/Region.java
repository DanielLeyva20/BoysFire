package pe.boysfire.api.region;

/**
 * Región administrativa.
 *
 * @param code     "PE" para el país; ubigeo del INEI para el resto
 * @param parentId región que la contiene; {@code null} solo en el país
 */
public record Region(int id, String code, String name, RegionLevel level, Integer parentId) {
}
