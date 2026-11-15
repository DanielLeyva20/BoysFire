package pe.boysfire.api.risk;

import java.time.LocalDate;

/**
 * Se publica cuando termina un cálculo de riesgo. Las alertas lo escuchan sin que el
 * módulo de riesgo sepa que existen.
 *
 * @param today             primer día evaluado
 * @param lastObservedDate  último día con datos de focos; {@code null} si no hay
 */
public record RiskRefreshedEvent(LocalDate today, LocalDate lastObservedDate) {
}
