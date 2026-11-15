package pe.boysfire.api.notification;

/**
 * Resultado de enviar una alerta a un responsable.
 *
 * @param channel    TELEGRAM o SIMULATED
 * @param status     SENT, FAILED o SIMULATED
 * @param externalId identificador del mensaje en el canal, si lo hay
 */
public record DeliveryOutcome(String channel, String status, String externalId, String error) {

    public static DeliveryOutcome sent(String channel, String externalId) {
        return new DeliveryOutcome(channel, "SENT", externalId, null);
    }

    public static DeliveryOutcome failed(String channel, String error) {
        return new DeliveryOutcome(channel, "FAILED", null, error);
    }

    public static DeliveryOutcome simulated(String reason) {
        return new DeliveryOutcome("SIMULATED", "SIMULATED", null, reason);
    }
}
