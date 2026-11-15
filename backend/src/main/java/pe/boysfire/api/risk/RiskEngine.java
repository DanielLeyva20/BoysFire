package pe.boysfire.api.risk;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import pe.boysfire.api.risk.Assessment.FactorScore;
import pe.boysfire.api.risk.RiskProperties.Thresholds;

/**
 * Reglas del riesgo. Sin acceso a datos: recibe lo medido y devuelve el puntaje.
 *
 * <p>Es un indicador, no una predicción: suma puntos por condiciones que favorecen el fuego
 * (viento, sequía, aire seco, calor, época del año y focos recientes).
 */
@Component
public class RiskEngine {

    /** Percentil de las provincias con que se resume un departamento o el país. */
    private static final double SUMMARY_PERCENTILE = 0.75;
    /** Fracción de provincias que debe tener un factor para mostrarlo en el resumen. */
    private static final double SUMMARY_MIN_SHARE = 0.25;

    private final Thresholds thresholds;

    public RiskEngine(RiskProperties properties) {
        this.thresholds = properties.thresholds();
    }

    /**
     * @param weather         clima del día; {@code null} si no hay
     * @param fireSeasonShare actividad típica de esta fecha respecto del pico del año (0–1); {@code null} si la zona
     *                        no tiene historia de fuego
     * @param recentDetections focos recientes con confianza suficiente; {@code null} si no aplica a este día
     */
    public Assessment assess(WeatherDay weather, Double fireSeasonShare, Integer recentDetections) {
        List<FactorScore> factors = new ArrayList<>();
        if (weather != null) {
            add(factors, RiskFactor.STRONG_WIND, weather.gustMaxKmh(),
                    graded(weather.gustMaxKmh(), thresholds.gustStrongKmh(), thresholds.gustModerateKmh()));
            add(factors, RiskFactor.DRY_VEGETATION, weather.daysWithoutRain(),
                    graded(weather.daysWithoutRain(), thresholds.dryDaysStrong(), thresholds.dryDaysModerate()));
            add(factors, RiskFactor.DRY_AIR, weather.humidityMinPct(),
                    gradedBelow(weather.humidityMinPct(), thresholds.humidityStrongPct(), thresholds.humidityModeratePct()));
            add(factors, RiskFactor.HEAT, weather.temperatureMaxC(), weather.temperatureMaxC() >= thresholds.heatC() ? 1 : 0);
        }
        if (fireSeasonShare != null) {
            add(factors, RiskFactor.FIRE_SEASON, Math.round(fireSeasonShare * 100),
                    graded(fireSeasonShare, thresholds.fireSeasonStrongShare(), thresholds.fireSeasonModerateShare()));
        }
        if (recentDetections != null && recentDetections > 0) {
            add(factors, RiskFactor.ACTIVE_FIRE, recentDetections, 2);
        }
        return Assessment.of(factors);
    }

    /**
     * Resume varias zonas (las provincias de un departamento) en una: el puntaje que alcanza
     * una de cada cuatro zonas, y los factores presentes en al menos un cuarto de ellas.
     */
    public Assessment summarize(List<Assessment> parts) {
        if (parts.isEmpty()) {
            return Assessment.of(List.of());
        }
        List<Integer> scores = parts.stream().map(Assessment::score).sorted(Comparator.reverseOrder()).toList();
        int score = scores.get((int) Math.floor((1 - SUMMARY_PERCENTILE) * (scores.size() - 1)));

        Map<RiskFactor, List<Integer>> pointsByFactor = new EnumMap<>(RiskFactor.class);
        for (Assessment part : parts) {
            for (FactorScore factor : part.factors()) {
                pointsByFactor.computeIfAbsent(factor.factor(), key -> new ArrayList<>()).add(factor.points());
            }
        }
        List<FactorScore> factors = new ArrayList<>();
        pointsByFactor.forEach((factor, points) -> {
            double share = (double) points.size() / parts.size();
            if (share >= SUMMARY_MIN_SHARE) {
                int typicalPoints = (int) Math.round(points.stream().mapToInt(Integer::intValue).average().orElse(0));
                factors.add(new FactorScore(factor, typicalPoints, null, share));
            }
        });
        return new Assessment(RiskLevel.fromScore(score), score, List.copyOf(factors));
    }

    private static void add(List<FactorScore> factors, RiskFactor factor, double value, int points) {
        if (points > 0) {
            factors.add(FactorScore.measured(factor, points, value));
        }
    }

    /** 2 puntos desde el umbral fuerte, 1 desde el moderado. */
    private static int graded(double value, double strong, double moderate) {
        return value >= strong ? 2 : value >= moderate ? 1 : 0;
    }

    /** Igual, para valores que son peores cuanto más bajos (la humedad). */
    private static int gradedBelow(double value, double strong, double moderate) {
        return value <= strong ? 2 : value <= moderate ? 1 : 0;
    }
}
