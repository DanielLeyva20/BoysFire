package pe.boysfire.api.hotspot;

import pe.boysfire.api.common.domain.ConfidenceLevel;
import pe.boysfire.api.common.domain.Sensor;
import pe.boysfire.api.common.query.BoundingBox;
import pe.boysfire.api.common.query.DateRange;

/**
 * Filtros de una consulta de focos.
 *
 * @param sensor {@code null} para incluir todos los sensores
 * @param limit  máximo de focos a devolver
 */
record HotspotQuery(BoundingBox area, DateRange dates, Sensor sensor, ConfidenceLevel minConfidence, int limit) {
}
