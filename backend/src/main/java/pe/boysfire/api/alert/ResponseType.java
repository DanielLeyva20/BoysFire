package pe.boysfire.api.alert;

import java.util.Optional;

/** Lo que un responsable contesta a una alerta. */
public enum ResponseType {
    RECEIVED("Recibido", null),
    VERIFYING("Voy a verificar", AlertStatus.VERIFYING),
    CONFIRMED("Confirmo el incendio", AlertStatus.CONFIRMED),
    FALSE_ALARM("Falsa alarma", null);

    private final String label;
    /** Estado al que pasa la alerta con esta respuesta. Una falsa alarma la decide un operador. */
    private final AlertStatus resultingStatus;

    ResponseType(String label, AlertStatus resultingStatus) {
        this.label = label;
        this.resultingStatus = resultingStatus;
    }

    public String label() {
        return label;
    }

    public Optional<AlertStatus> resultingStatus() {
        return Optional.ofNullable(resultingStatus);
    }
}
