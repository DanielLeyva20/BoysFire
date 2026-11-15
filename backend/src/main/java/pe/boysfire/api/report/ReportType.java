package pe.boysfire.api.report;

import java.util.Arrays;

/** Qué vio quien reporta. Refleja la tabla {@code ref.report_type}. */
public enum ReportType {
    SMOKE(1, "Humo"),
    VISIBLE_FIRE(2, "Fuego visible"),
    AGRICULTURAL_BURN(3, "Quema agrícola"),
    OTHER(4, "Otro");

    private final int id;
    private final String label;

    ReportType(int id, String label) {
        this.id = id;
        this.label = label;
    }

    public int id() {
        return id;
    }

    public String label() {
        return label;
    }

    public static ReportType fromId(int id) {
        return Arrays.stream(values())
                .filter(type -> type.id == id)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Tipo de reporte desconocido: " + id));
    }
}
