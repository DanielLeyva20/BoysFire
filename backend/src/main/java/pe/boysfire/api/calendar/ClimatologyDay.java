package pe.boysfire.api.calendar;

/**
 * Lo normal en una región para un día del año.
 *
 * @param dayOfYear   1–366, contado sobre un año bisiesto (el 1 de marzo siempre es el 61)
 * @param sampleYears años completos que respaldan la estadística
 */
public record ClimatologyDay(
        int dayOfYear,
        int sampleYears,
        double meanIndex,
        double p50Index,
        double p90Index,
        double p95Index,
        double criticalThreshold) {
}
