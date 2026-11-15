package pe.boysfire.api.alert;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import pe.boysfire.api.alert.AlertViews.NewAlert;
import pe.boysfire.api.region.Region;
import pe.boysfire.api.region.RegionService;
import pe.boysfire.api.risk.RiskLevel;
import pe.boysfire.api.risk.RiskProperties;
import pe.boysfire.api.risk.RiskRefreshedEvent;
import pe.boysfire.api.risk.RiskService;
import pe.boysfire.api.risk.RiskViews.RegionRisk;
import pe.boysfire.api.risk.RiskViews.ZoneRisk;

/**
 * Convierte cada cálculo de riesgo en alertas: una por provincia en riesgo alto y una por
 * provincia con muchos focos recientes. Cada hecho genera una sola alerta (clave de
 * deduplicación por región y día), aunque el cálculo se repita.
 */
@Component
class AlertGenerator {

    /** Tope por ejecución, para que un día extremo no inunde a los responsables. */
    private static final int MAX_RISK_ALERTS_PER_RUN = 25;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale.forLanguageTag("es-PE"));
    private static final Logger log = LoggerFactory.getLogger(AlertGenerator.class);

    private final AlertService alerts;
    private final RiskService risk;
    private final RegionService regions;
    private final RiskProperties properties;

    AlertGenerator(AlertService alerts, RiskService risk, RegionService regions, RiskProperties properties) {
        this.alerts = alerts;
        this.risk = risk;
        this.regions = regions;
        this.properties = properties;
    }

    @EventListener
    void onRiskRefreshed(RiskRefreshedEvent event) {
        int highRisk = raiseHighRiskAlerts(event.today());
        int activeFire = raiseActiveFireAlerts(event);
        log.info("Alertas nuevas tras el cálculo de riesgo: {} por riesgo alto, {} por focos activos", highRisk, activeFire);
    }

    private int raiseHighRiskAlerts(LocalDate today) {
        int raised = 0;
        for (RegionRisk province : risk.watchlist(MAX_RISK_ALERTS_PER_RUN)) {
            if (province.level() != RiskLevel.HIGH) {
                continue;
            }
            ZoneRisk zone = risk.zone(province.regionId(), today);
            String factors = zone.factors().stream().map(factor -> factor.name().toLowerCase(Locale.ROOT))
                    .collect(Collectors.joining(", "));
            String message = "Condiciones favorables al fuego hoy (%s): %s. Puntaje %d de %d."
                    .formatted(DAY.format(today), factors, zone.score(), zone.maxScore());
            raised += alerts.raise(new NewAlert(province.regionId(), AlertType.HIGH_RISK, RiskLevel.HIGH,
                    "Riesgo alto de incendio en " + regionName(province.regionId()), message,
                    "risk:%d:%s".formatted(province.regionId(), today), null)).isPresent() ? 1 : 0;
        }
        return raised;
    }

    private int raiseActiveFireAlerts(RiskRefreshedEvent event) {
        if (event.lastObservedDate() == null) {
            return 0;
        }
        LocalDate last = event.lastObservedDate();
        LocalDate first = last.minusDays(properties.hotspotWindowDays() - 1L);
        int raised = 0;
        for (var province : risk.provincesWithActiveFire(properties.activeFireAlertDetections())) {
            String message = "Los satélites detectaron %d focos de calor confiables entre el %s y el %s."
                    .formatted(Math.round(province.value()), DAY.format(first), DAY.format(last));
            raised += alerts.raise(new NewAlert(province.regionId(), AlertType.ACTIVE_FIRE, RiskLevel.HIGH,
                    "Focos de calor activos en " + regionName(province.regionId()), message,
                    "fire:%d:%s".formatted(province.regionId(), last), null)).isPresent() ? 1 : 0;
        }
        return raised;
    }

    private String regionName(int regionId) {
        Region region = regions.require(regionId);
        return region.name();
    }
}
