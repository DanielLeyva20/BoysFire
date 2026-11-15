package pe.boysfire.api.alert;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;
import pe.boysfire.api.risk.RiskLevel;

/** Peticiones y respuestas del módulo de alertas. */
public final class AlertViews {

    private AlertViews() {
    }

    /** Lo necesario para crear una alerta. {@code dedupeKey} evita repetir la misma alerta. */
    public record NewAlert(
            int regionId, AlertType type, RiskLevel level, String title, String message, String dedupeKey, Integer reportId) {
    }

    public record AlertSummary(
            int id,
            AlertType type,
            String typeLabel,
            RiskLevel level,
            String title,
            int regionId,
            String place,
            AlertStatus status,
            String statusLabel,
            int deliveries,
            int responses,
            LocalDateTime createdAtUtc,
            LocalDateTime updatedAtUtc) {
    }

    public record AlertDetail(
            AlertSummary alert,
            String message,
            Integer reportId,
            List<Delivery> deliveries,
            List<Response> responses,
            List<StatusChange> history) {
    }

    /**
     * @param channel TELEGRAM o SIMULATED (registrado sin enviar, porque falta el token o el chat)
     */
    public record Delivery(
            int id, int contactId, String contactName, String roleName, String channel, String status, String error,
            LocalDateTime sentAtUtc) {
    }

    public record Response(
            int id, Integer contactId, String contactName, ResponseType response, String responseLabel, String channel,
            String note, LocalDateTime respondedAtUtc) {
    }

    public record StatusChange(
            AlertStatus fromStatus, AlertStatus toStatus, String actor, String note, LocalDateTime changedAtUtc) {
    }

    public record ChangeStatusRequest(@NotNull AlertStatus status, @Size(max = 500) String note) {
    }

    /** Respuesta registrada desde el panel (por ejemplo, la que llegó por teléfono). */
    public record RecordResponseRequest(@NotNull ResponseType response, Integer contactId, @Size(max = 500) String note) {
    }

    public record DispatchResult(int sent, int simulated, int failed, int alreadyNotified) {
    }
}
