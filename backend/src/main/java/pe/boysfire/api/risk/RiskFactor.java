package pe.boysfire.api.risk;

import java.util.Arrays;

/** Factores que suman puntos de riesgo. Refleja la tabla {@code ref.risk_factor}. */
public enum RiskFactor {
    STRONG_WIND(1),
    DRY_VEGETATION(2),
    DRY_AIR(3),
    HEAT(4),
    FIRE_SEASON(5),
    ACTIVE_FIRE(6);

    private final int id;

    RiskFactor(int id) {
        this.id = id;
    }

    public int id() {
        return id;
    }

    public static RiskFactor fromId(int id) {
        return Arrays.stream(values())
                .filter(factor -> factor.id == id)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Factor de riesgo desconocido: " + id));
    }
}
