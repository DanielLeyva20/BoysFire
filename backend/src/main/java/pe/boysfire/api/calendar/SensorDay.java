package pe.boysfire.api.calendar;

import java.time.LocalDate;
import pe.boysfire.api.common.domain.Sensor;

/**
 * Focos observados por un sensor en un día y una región, sin armonizar.
 *
 * @param confidentDetections focos con confianza nominal o alta
 */
public record SensorDay(LocalDate date, Sensor sensor, int detections, int confidentDetections, double frpSumMw) {
}
