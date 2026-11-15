package pe.boysfire.api.hotspot;

import java.time.LocalDate;
import java.time.LocalDateTime;
import pe.boysfire.api.common.domain.ConfidenceLevel;
import pe.boysfire.api.common.domain.Satellite;
import pe.boysfire.api.common.domain.Sensor;

/**
 * Foco de calor limpio.
 *
 * @param localDate fecha en hora de Perú (la que usa el calendario)
 * @param frpMw     potencia radiativa del fuego en megavatios
 * @param scanKm    ancho real del píxel, para dibujar su huella
 * @param trackKm   alto real del píxel
 */
public record Hotspot(
        long id,
        double latitude,
        double longitude,
        LocalDateTime acquiredAtUtc,
        LocalDate localDate,
        Satellite satellite,
        Sensor sensor,
        ConfidenceLevel confidence,
        Double frpMw,
        Double scanKm,
        Double trackKm,
        boolean daytime) {
}
