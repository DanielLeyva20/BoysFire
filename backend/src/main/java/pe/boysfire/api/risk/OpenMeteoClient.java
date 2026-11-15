package pe.boysfire.api.risk;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Clima diario de Open-Meteo (servicio abierto, sin clave). Pide varias ubicaciones por
 * consulta para gastar pocas llamadas.
 */
@Component
public class OpenMeteoClient {

    private static final String DAILY_VARIABLES =
            "temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum";
    private static final int MAX_DRY_DAYS = 99;

    private final RestClient http;
    private final RiskProperties properties;

    public OpenMeteoClient(RestClient.Builder builder, RiskProperties properties) {
        this.http = builder.baseUrl(properties.weatherBaseUrl()).build();
        this.properties = properties;
    }

    /** Pronóstico desde {@code from} para cada punto, por identificador de región. */
    public Map<Integer, List<WeatherDay>> forecast(List<GeoPoint> points, LocalDate from) {
        Map<Integer, List<WeatherDay>> result = new LinkedHashMap<>();
        for (int start = 0; start < points.size(); start += properties.weatherBatchSize()) {
            List<GeoPoint> batch = points.subList(start, Math.min(points.size(), start + properties.weatherBatchSize()));
            List<Location> locations = fetch(batch);
            for (int index = 0; index < batch.size(); index++) {
                result.put(batch.get(index).regionId(), toDays(locations.get(index).daily(), from));
            }
        }
        return result;
    }

    private List<Location> fetch(List<GeoPoint> batch) {
        // Con una sola ubicación Open-Meteo responde un objeto en vez de una lista: se pide dos veces la misma.
        List<GeoPoint> request = batch.size() == 1 ? List.of(batch.getFirst(), batch.getFirst()) : batch;
        Location[] locations = http.get()
                .uri(builder -> builder
                        .queryParam("latitude", join(request, GeoPoint::latitude))
                        .queryParam("longitude", join(request, GeoPoint::longitude))
                        .queryParam("daily", DAILY_VARIABLES)
                        .queryParam("timezone", "America/Lima")
                        .queryParam("past_days", properties.pastDays())
                        .queryParam("forecast_days", properties.forecastDays())
                        .build())
                .retrieve()
                .body(Location[].class);
        if (locations == null || locations.length < batch.size()) {
            throw new IllegalStateException("Open-Meteo devolvió menos ubicaciones de las pedidas.");
        }
        return List.of(locations);
    }

    /** Recorre la historia y el pronóstico contando días secos; devuelve solo desde {@code from}. */
    private List<WeatherDay> toDays(Daily daily, LocalDate from) {
        double rainMm = properties.thresholds().rainMm();
        List<WeatherDay> days = new ArrayList<>();
        int dryDays = 0;
        for (int index = 0; index < daily.time().size(); index++) {
            double precipitation = valueAt(daily.precipitation(), index);
            dryDays = precipitation < rainMm ? Math.min(dryDays + 1, MAX_DRY_DAYS) : 0;
            LocalDate date = LocalDate.parse(daily.time().get(index));
            if (date.isBefore(from) || daily.temperatureMax().get(index) == null) {
                continue;
            }
            days.add(new WeatherDay(
                    date,
                    valueAt(daily.temperatureMax(), index),
                    (int) Math.round(valueAt(daily.humidityMin(), index)),
                    valueAt(daily.windMax(), index),
                    valueAt(daily.gustMax(), index),
                    precipitation,
                    dryDays));
        }
        return days;
    }

    private static double valueAt(List<Double> values, int index) {
        Double value = values.get(index);
        return value == null ? 0 : value;
    }

    private static String join(List<GeoPoint> points, ToDoubleFunction<GeoPoint> coordinate) {
        return points.stream()
                .map(point -> String.format(Locale.ROOT, "%.4f", coordinate.applyAsDouble(point)))
                .collect(Collectors.joining(","));
    }

    record Location(Daily daily) {
    }

    record Daily(
            List<String> time,
            @JsonProperty("temperature_2m_max") List<Double> temperatureMax,
            @JsonProperty("relative_humidity_2m_min") List<Double> humidityMin,
            @JsonProperty("wind_speed_10m_max") List<Double> windMax,
            @JsonProperty("wind_gusts_10m_max") List<Double> gustMax,
            @JsonProperty("precipitation_sum") List<Double> precipitation) {
    }
}
