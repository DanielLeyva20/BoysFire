package pe.boysfire.api.risk;

import java.time.LocalDate;

/**
 * Clima de un día en un punto.
 *
 * @param daysWithoutRain días seguidos sin lluvia útil hasta esta fecha, incluida
 */
public record WeatherDay(
        LocalDate date,
        double temperatureMaxC,
        int humidityMinPct,
        double windMaxKmh,
        double gustMaxKmh,
        double precipitationMm,
        int daysWithoutRain) {
}
