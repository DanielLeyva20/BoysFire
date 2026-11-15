package pe.boysfire.api.region;

import java.util.Arrays;

/** Nivel administrativo. Refleja la tabla {@code ref.region_level}. */
public enum RegionLevel {
    COUNTRY(1),
    DEPARTMENT(2),
    PROVINCE(3),
    DISTRICT(4);

    private final int id;

    RegionLevel(int id) {
        this.id = id;
    }

    public int id() {
        return id;
    }

    public static RegionLevel fromId(int id) {
        return Arrays.stream(values())
                .filter(level -> level.id == id)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Nivel de región desconocido: " + id));
    }
}
