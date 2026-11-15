package pe.boysfire.api.common.domain;

import java.util.Arrays;

/** Confianza común a MODIS y VIIRS, ordenada. Refleja la tabla {@code ref.confidence_level}. */
public enum ConfidenceLevel {
    LOW(1),
    NOMINAL(2),
    HIGH(3);

    private final int id;

    ConfidenceLevel(int id) {
        this.id = id;
    }

    public int id() {
        return id;
    }

    public static ConfidenceLevel fromId(int id) {
        return Arrays.stream(values())
                .filter(level -> level.id == id)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Nivel de confianza desconocido: " + id));
    }
}
