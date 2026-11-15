package pe.boysfire.api.risk;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Ajustes del cálculo de riesgo (prefijo {@code boysfire.risk}).
 *
 * @param thresholds umbrales de cada factor; los valores por defecto están pensados para Perú
 */
@Validated
@ConfigurationProperties("boysfire.risk")
public record RiskProperties(
        @NotNull Duration refreshInterval,
        @NotNull Duration refreshInitialDelay,
        @Positive int forecastDays,
        @Positive int pastDays,
        @Positive int weatherBatchSize,
        @NotBlank String weatherBaseUrl,
        @Positive int hotspotWindowDays,
        @Positive int hotspotMaxAgeDays,
        @Positive int activeFireAlertDetections,
        @NotNull @DefaultValue Thresholds thresholds) {

    /**
     * Cada factor da 2 puntos al superar su umbral fuerte y 1 al superar el moderado.
     *
     * @param rainMm              lluvia diaria desde la que un día deja de contar como seco
     * @param fireSeasonMinIndex  actividad media mínima para considerar que la zona tiene temporada de quemas
     */
    public record Thresholds(
            @DefaultValue("50") double gustStrongKmh,
            @DefaultValue("35") double gustModerateKmh,
            @DefaultValue("21") int dryDaysStrong,
            @DefaultValue("10") int dryDaysModerate,
            @DefaultValue("1.0") double rainMm,
            @DefaultValue("30") int humidityStrongPct,
            @DefaultValue("45") int humidityModeratePct,
            @DefaultValue("30") double heatC,
            @DefaultValue("0.5") double fireSeasonStrongShare,
            @DefaultValue("0.2") double fireSeasonModerateShare,
            @DefaultValue("0.02") double fireSeasonMinIndex) {
    }
}
