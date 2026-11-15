package pe.boysfire.api.notification;

import java.util.List;

/**
 * Una alerta lista para enviar, independiente del canal.
 *
 * @param levelLabel "Alto", "Moderado" o "Bajo"
 * @param link       enlace a la aplicación en la zona y el día de la alerta
 */
public record OutgoingAlert(
        int alertId, String title, String levelLabel, String place, String message, List<String> recommendations, String link) {
}
