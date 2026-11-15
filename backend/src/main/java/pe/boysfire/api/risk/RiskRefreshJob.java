package pe.boysfire.api.risk;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import pe.boysfire.api.common.scheduling.ScheduledJob;
import pe.boysfire.api.region.Region;
import pe.boysfire.api.region.RegionLevel;
import pe.boysfire.api.region.RegionService;
import pe.boysfire.api.risk.RiskWriteRepository.RegionAssessment;

/**
 * Renueva el clima y recalcula el riesgo de todas las regiones para los próximos días.
 *
 * <ul>
 *   <li>Provincias: su propio clima, su temporada y sus focos recientes.</li>
 *   <li>Distritos: el clima de su provincia con su propia temporada y sus propios focos.</li>
 *   <li>Departamentos y país: resumen de sus provincias.</li>
 * </ul>
 */
@Component
public class RiskRefreshJob implements ScheduledJob {

    private static final Logger log = LoggerFactory.getLogger(RiskRefreshJob.class);

    private final OpenMeteoClient weatherClient;
    private final RiskInputRepository inputs;
    private final RiskWriteRepository writer;
    private final RiskEngine engine;
    private final RegionService regions;
    private final RiskProperties properties;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    RiskRefreshJob(OpenMeteoClient weatherClient, RiskInputRepository inputs, RiskWriteRepository writer, RiskEngine engine,
                   RegionService regions, RiskProperties properties, ApplicationEventPublisher events, Clock clock) {
        this.weatherClient = weatherClient;
        this.inputs = inputs;
        this.writer = writer;
        this.engine = engine;
        this.regions = regions;
        this.properties = properties;
        this.events = events;
        this.clock = clock;
    }

    @Override
    public String name() {
        return "cálculo de riesgo";
    }

    @Override
    public Duration interval() {
        return properties.refreshInterval();
    }

    @Override
    public Duration initialDelay() {
        return properties.refreshInitialDelay();
    }

    @Override
    public void run() {
        int runId = writer.startRun();
        try {
            LocalDate today = LocalDate.now(clock);
            List<LocalDate> dates = today.datesUntil(today.plusDays(properties.forecastDays())).toList();
            List<GeoPoint> points = inputs.findProvincePoints();
            Map<Integer, List<WeatherDay>> weather = weatherClient.forecast(points, today);

            Optional<LocalDate> lastObserved = inputs.findLastObservedDate();
            Inputs context = new Inputs(
                    weather,
                    inputs.findSeasonShares(dates.stream().map(RiskRefreshJob::seasonDayOfYear).distinct().toList(),
                            properties.thresholds().fireSeasonMinIndex()),
                    recentDetections(today, lastObserved));

            List<RegionAssessment> assessments = new ArrayList<>();
            for (LocalDate date : dates) {
                assessments.addAll(assessDay(date, date.equals(today), context));
            }
            writer.replaceFrom(today, weather, assessments, LocalDateTime.now(clock.withZone(ZoneOffset.UTC)));
            writer.finishRun(runId, points.size(), assessments.size());
            log.info("Riesgo recalculado: {} puntos de clima, {} evaluaciones", points.size(), assessments.size());
            events.publishEvent(new RiskRefreshedEvent(today, lastObserved.orElse(null)));
        } catch (RuntimeException exception) {
            writer.failRun(runId, exception.getClass().getSimpleName() + ": " + exception.getMessage());
            throw exception;
        }
    }

    /** Lo que se reutiliza en cada día evaluado. */
    private record Inputs(
            Map<Integer, List<WeatherDay>> weather,
            Map<Integer, Map<Integer, Double>> seasonShares,
            Map<Integer, Integer> recentDetections) {
    }

    private List<RegionAssessment> assessDay(LocalDate date, boolean isToday, Inputs inputs) {
        int dayOfYear = seasonDayOfYear(date);
        List<RegionAssessment> result = new ArrayList<>();
        Map<Integer, List<Assessment>> provincesByDepartment = new HashMap<>();
        List<Assessment> allProvinces = new ArrayList<>();

        for (Region province : regions.ofLevel(RegionLevel.PROVINCE)) {
            WeatherDay weather = weatherOn(inputs.weather().get(province.id()), date);
            Assessment assessment = engine.assess(weather, season(inputs, province.id(), dayOfYear),
                    isToday ? inputs.recentDetections().get(province.id()) : null);
            result.add(new RegionAssessment(province.id(), date, assessment, weather == null ? null : province.id()));
            provincesByDepartment.computeIfAbsent(province.parentId(), key -> new ArrayList<>()).add(assessment);
            allProvinces.add(assessment);
        }
        for (Region district : regions.ofLevel(RegionLevel.DISTRICT)) {
            WeatherDay weather = weatherOn(inputs.weather().get(district.parentId()), date);
            Assessment assessment = engine.assess(weather, season(inputs, district.id(), dayOfYear),
                    isToday ? inputs.recentDetections().get(district.id()) : null);
            result.add(new RegionAssessment(district.id(), date, assessment, weather == null ? null : district.parentId()));
        }
        provincesByDepartment.forEach((departmentId, parts) ->
                result.add(new RegionAssessment(departmentId, date, engine.summarize(parts), null)));
        result.add(new RegionAssessment(regions.country().id(), date, engine.summarize(allProvinces), null));
        return result;
    }

    /** Los focos solo cuentan si los datos son recientes: con datos viejos el factor no se aplica. */
    private Map<Integer, Integer> recentDetections(LocalDate today, Optional<LocalDate> lastObserved) {
        return lastObserved
                .filter(last -> !last.isBefore(today.minusDays(properties.hotspotMaxAgeDays())))
                .map(last -> inputs.findRecentDetections(last.minusDays(properties.hotspotWindowDays() - 1L), last))
                .orElse(Map.of());
    }

    private static Double season(Inputs inputs, int regionId, int dayOfYear) {
        Map<Integer, Double> shares = inputs.seasonShares().get(regionId);
        return shares == null ? null : shares.get(dayOfYear);
    }

    private static WeatherDay weatherOn(List<WeatherDay> days, LocalDate date) {
        return days == null ? null : days.stream().filter(day -> day.date().equals(date)).findFirst().orElse(null);
    }

    /** Día del año contado sobre un año bisiesto, como la climatología (el 1 de marzo siempre es el 61). */
    static int seasonDayOfYear(LocalDate date) {
        return LocalDate.of(2000, date.getMonth(), date.getDayOfMonth()).getDayOfYear();
    }
}
