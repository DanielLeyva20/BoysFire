package pe.boysfire.api.risk;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import pe.boysfire.api.region.Region;

/** Respuestas de la API de riesgo. */
public final class RiskViews {

    private RiskViews() {
    }

    /**
     * Riesgo de una zona en un día, con lo que lo explica y qué hacer.
     *
     * @param summary          {@code true} si se resume de varias provincias (departamento o país)
     * @param weather          clima usado; {@code null} en un resumen
     * @param weatherPlace     provincia cuyo clima se usó
     * @param hotspotDataDate  último día con datos de focos
     */
    public record ZoneRisk(
            Region region,
            LocalDate date,
            RiskLevel level,
            int score,
            int maxScore,
            boolean summary,
            List<FactorView> factors,
            List<String> recommendations,
            WeatherView weather,
            String weatherPlace,
            LocalDateTime computedAtUtc,
            LocalDate hotspotDataDate) {
    }

    /**
     * @param observedValue valor medido (evaluación directa)
     * @param affectedShare fracción de provincias con el factor (resumen)
     */
    public record FactorView(
            String code, String name, String description, String unit, int points, Double observedValue, Double affectedShare) {
    }

    public record WeatherView(
            double temperatureMaxC,
            int humidityMinPct,
            double windMaxKmh,
            double gustMaxKmh,
            double precipitationMm,
            int daysWithoutRain) {
    }

    /** Riesgo de una región, para colorear el mapa y ordenar el ranking. */
    public record RegionRisk(int regionId, RiskLevel level, int score) {
    }

    /** Valor de un factor en una región (p. ej. cuántos focos recientes tiene). */
    public record FactorReading(int regionId, double value) {
    }

    /** Riesgo de un día, para el pronóstico de la semana. */
    public record DayRisk(LocalDate date, RiskLevel level, int score) {
    }

    /**
     * Estado del cálculo.
     *
     * @param lastStatus   SUCCESS, FAILED o RUNNING; {@code null} si nunca corrió
     */
    public record RiskStatus(
            LocalDateTime lastRunAtUtc,
            String lastStatus,
            LocalDateTime lastSuccessAtUtc,
            long refreshIntervalMinutes,
            LocalDate hotspotDataDate,
            String weatherSource) {
    }
}
