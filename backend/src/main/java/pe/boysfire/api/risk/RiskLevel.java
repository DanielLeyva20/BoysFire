package pe.boysfire.api.risk;

import java.util.Arrays;
import java.util.Comparator;

/** Nivel de riesgo. Refleja la tabla {@code ref.risk_level}; el puntaje mínimo de cada nivel es el mismo. */
public enum RiskLevel {
    LOW(1, 0),
    MODERATE(2, 3),
    HIGH(3, 6);

    private final int id;
    private final int minScore;

    RiskLevel(int id, int minScore) {
        this.id = id;
        this.minScore = minScore;
    }

    public int id() {
        return id;
    }

    public static RiskLevel fromId(int id) {
        return Arrays.stream(values())
                .filter(level -> level.id == id)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Nivel de riesgo desconocido: " + id));
    }

    /** El nivel más alto cuyo puntaje mínimo se alcanza. */
    public static RiskLevel fromScore(int score) {
        return Arrays.stream(values())
                .filter(level -> score >= level.minScore)
                .max(Comparator.comparingInt(level -> level.minScore))
                .orElse(LOW);
    }
}
