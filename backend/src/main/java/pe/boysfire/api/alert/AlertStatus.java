package pe.boysfire.api.alert;

/**
 * Ciclo de vida de una alerta: se abre, se avisa a los responsables, se verifica en el
 * terreno y termina confirmada (emergencia real) o descartada, y luego se cierra.
 */
public enum AlertStatus {
    OPEN("Abierta"),
    NOTIFIED("Notificada"),
    VERIFYING("En verificación"),
    CONFIRMED("Confirmada"),
    DISMISSED("Descartada"),
    CLOSED("Cerrada");

    private final String label;

    AlertStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Una alerta abierta, notificada o en verificación todavía requiere atención. */
    public boolean isPending() {
        return this == OPEN || this == NOTIFIED || this == VERIFYING;
    }
}
