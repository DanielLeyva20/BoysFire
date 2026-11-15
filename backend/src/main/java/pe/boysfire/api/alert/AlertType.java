package pe.boysfire.api.alert;

/** De dónde nace una alerta. */
public enum AlertType {
    /** El cálculo de riesgo dio "alto" en la zona. */
    HIGH_RISK("Riesgo alto"),
    /** Los satélites detectaron muchos focos en la zona. */
    ACTIVE_FIRE("Focos activos"),
    /** Alguien de la comunidad reportó humo o fuego. */
    COMMUNITY_REPORT("Reporte comunitario");

    private final String label;

    AlertType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
