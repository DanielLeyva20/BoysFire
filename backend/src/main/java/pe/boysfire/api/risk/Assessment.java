package pe.boysfire.api.risk;

import java.util.List;

/**
 * Resultado de evaluar una zona en un día.
 *
 * @param factors solo los factores que sumaron puntos
 */
public record Assessment(RiskLevel level, int score, List<FactorScore> factors) {

    /**
     * Un factor activo.
     *
     * @param observedValue valor medido (evaluación directa); {@code null} en una evaluación resumida
     * @param affectedShare fracción de provincias con el factor (evaluación resumida); {@code null} si es directa
     */
    public record FactorScore(RiskFactor factor, int points, Double observedValue, Double affectedShare) {

        public static FactorScore measured(RiskFactor factor, int points, double value) {
            return new FactorScore(factor, points, value, null);
        }
    }

    public static Assessment of(List<FactorScore> factors) {
        int score = factors.stream().mapToInt(FactorScore::points).sum();
        return new Assessment(RiskLevel.fromScore(score), score, List.copyOf(factors));
    }
}
