package pe.boysfire.api.risk;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import pe.boysfire.api.common.error.ResourceNotFoundException;
import pe.boysfire.api.region.Region;
import pe.boysfire.api.region.RegionLevel;
import pe.boysfire.api.region.RegionService;
import pe.boysfire.api.risk.RiskQueryRepository.Recommendation;
import pe.boysfire.api.risk.RiskQueryRepository.StoredAssessment;
import pe.boysfire.api.risk.RiskQueryRepository.StoredFactor;
import pe.boysfire.api.risk.RiskViews.DayRisk;
import pe.boysfire.api.risk.RiskViews.FactorView;
import pe.boysfire.api.risk.RiskViews.RegionRisk;
import pe.boysfire.api.risk.RiskViews.RiskStatus;
import pe.boysfire.api.risk.RiskViews.ZoneRisk;

@Service
public class RiskService {

    /** Puntaje máximo posible: 2 por factor salvo el calor, que da 1. */
    private static final int MAX_SCORE = 11;
    private static final String WEATHER_SOURCE = "Open-Meteo (pronóstico diario)";

    private final RiskQueryRepository repository;
    private final RegionService regions;
    private final RiskProperties properties;
    private final Clock clock;
    private final RecommendationCatalog catalog;

    RiskService(RiskQueryRepository repository, RegionService regions, RiskProperties properties, Clock clock,
                RecommendationCatalog catalog) {
        this.repository = repository;
        this.regions = regions;
        this.properties = properties;
        this.clock = clock;
        this.catalog = catalog;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    /** Riesgo de una zona en un día (hoy si no se indica), con sus factores y recomendaciones. */
    public ZoneRisk zone(Integer regionId, LocalDate date) {
        Region region = regionId == null ? regions.country() : regions.require(regionId);
        LocalDate day = date == null ? today() : date;
        StoredAssessment stored = repository.findAssessment(region.id(), day)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Todavía no hay evaluación de riesgo para %s el %s. Se calcula al iniciar la API y cada %d horas."
                                .formatted(region.name(), day, properties.refreshInterval().toHours())));
        List<StoredFactor> factors = repository.findFactors(region.id(), day);
        Integer weatherRegionId = stored.weatherRegionId();
        return new ZoneRisk(
                region,
                day,
                stored.level(),
                stored.score(),
                MAX_SCORE,
                weatherRegionId == null,
                factors.stream().map(RiskService::toView).toList(),
                recommendationsFor(stored.level(), factors.stream().map(StoredFactor::code).collect(Collectors.toSet())),
                weatherRegionId == null ? null : repository.findWeather(weatherRegionId, day).orElse(null),
                weatherRegionId == null ? null : regions.require(weatherRegionId).name(),
                stored.computedAt(),
                repository.findLastObservedDate().orElse(null));
    }

    /** Riesgo de cada región hija; sin región, los departamentos. */
    public List<RegionRisk> children(Integer parentId, LocalDate date) {
        int parent = parentId == null ? regions.country().id() : regions.require(parentId).id();
        return repository.findChildren(parent, date == null ? today() : date);
    }

    /** Las provincias con riesgo alto o moderado de hoy, de mayor a menor: la lista de vigilancia. */
    public List<RegionRisk> watchlist(int limit) {
        return repository.findTop(RegionLevel.PROVINCE.id(), today(), RiskLevel.MODERATE, limit);
    }

    /** Provincias con al menos {@code minDetections} focos recientes hoy (factor "foco detectado"). */
    public List<RiskViews.FactorReading> provincesWithActiveFire(int minDetections) {
        return repository.findWithFactor(RegionLevel.PROVINCE.id(), today(), RiskFactor.ACTIVE_FIRE, minDetections);
    }

    public List<DayRisk> forecast(Integer regionId) {
        Region region = regionId == null ? regions.country() : regions.require(regionId);
        return repository.findForecast(region.id(), today());
    }

    public RiskStatus status() {
        var lastRun = repository.findLastRun(false);
        var lastSuccess = repository.findLastRun(true);
        return new RiskStatus(
                lastRun.map(RiskQueryRepository.LastRun::startedAt).orElse(null),
                lastRun.map(RiskQueryRepository.LastRun::status).orElse(null),
                lastSuccess.map(RiskQueryRepository.LastRun::startedAt).orElse(null),
                properties.refreshInterval().toMinutes(),
                repository.findLastObservedDate().orElse(null),
                WEATHER_SOURCE);
    }

    /** Recomendaciones del catálogo para un nivel y unos factores; también las usan las alertas. */
    public List<String> recommendationsFor(RiskLevel level, Set<String> factorCodes) {
        Set<String> texts = new LinkedHashSet<>();
        for (Recommendation recommendation : catalog.all()) {
            boolean byFactor = recommendation.factorCode() != null && factorCodes.contains(recommendation.factorCode());
            boolean byLevel = recommendation.minLevelId() != null && level.id() >= recommendation.minLevelId();
            if (byFactor || byLevel) {
                texts.add(recommendation.text());
            }
        }
        return List.copyOf(texts);
    }

    private static FactorView toView(StoredFactor factor) {
        return new FactorView(factor.code(), factor.name(), factor.description(), factor.unit(), factor.points(),
                factor.observedValue(), factor.affectedShare());
    }
}
