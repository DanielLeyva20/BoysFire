package pe.boysfire.api.report;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import pe.boysfire.api.alert.AlertService;
import pe.boysfire.api.alert.AlertStatus;
import pe.boysfire.api.alert.AlertType;
import pe.boysfire.api.alert.AlertViews.NewAlert;
import pe.boysfire.api.common.error.ResourceNotFoundException;
import pe.boysfire.api.region.RegionDetail;
import pe.boysfire.api.region.RegionService;
import pe.boysfire.api.report.ReportRepository.NearestHotspot;
import pe.boysfire.api.report.ReportViews.CommunityReport;
import pe.boysfire.api.report.ReportViews.NewReport;
import pe.boysfire.api.report.ReportViews.ReportReceipt;
import pe.boysfire.api.risk.RiskLevel;

/**
 * Reportes de la comunidad. Cada reporte se ubica en su distrito, se contrasta con los focos
 * de satélite cercanos y abre una alerta para que los responsables lo verifiquen.
 */
@Service
public class ReportService {

    /** Días hacia atrás en que se buscan focos de satélite cerca del reporte. */
    private static final int HOTSPOT_LOOKBACK_DAYS = 3;
    private static final int MAX_LIST = 200;

    private static final Map<ReportType, RiskLevel> ALERT_LEVEL = Map.of(
            ReportType.VISIBLE_FIRE, RiskLevel.HIGH,
            ReportType.SMOKE, RiskLevel.MODERATE,
            ReportType.AGRICULTURAL_BURN, RiskLevel.MODERATE,
            ReportType.OTHER, RiskLevel.LOW);

    private static final Map<ReportStatus, AlertStatus> ALERT_STATUS = Map.of(
            ReportStatus.VERIFYING, AlertStatus.VERIFYING,
            ReportStatus.CONFIRMED, AlertStatus.CONFIRMED,
            ReportStatus.DISMISSED, AlertStatus.DISMISSED);

    private final ReportRepository repository;
    private final ReportRateLimiter rateLimiter;
    private final RegionService regions;
    private final AlertService alerts;
    private final Clock clock;

    ReportService(ReportRepository repository, ReportRateLimiter rateLimiter, RegionService regions, AlertService alerts,
                  Clock clock) {
        this.repository = repository;
        this.rateLimiter = rateLimiter;
        this.regions = regions;
        this.alerts = alerts;
        this.clock = clock;
    }

    public ReportReceipt submit(NewReport report, String clientId) {
        rateLimiter.check(clientId);
        Optional<RegionDetail> district = locate(report.latitude(), report.longitude());
        LocalDate today = LocalDate.now(clock);
        NearestHotspot nearest = repository.findNearestHotspot(
                report.latitude(), report.longitude(), today.minusDays(HOTSPOT_LOOKBACK_DAYS), today).orElse(null);

        int reportId = repository.insert(report, district.map(found -> found.region().id()).orElse(null), nearest);
        district.ifPresent(found -> raiseAlert(reportId, report, found, nearest));

        return new ReportReceipt(
                reportId,
                district.map(RegionDetail::path).orElse(null),
                nearest == null ? null : nearest.distanceKm(),
                district.isPresent()
                        ? "Gracias. Tu reporte llegó a los responsables de la zona para que lo verifiquen."
                        : "Gracias. El punto está fuera de los distritos de Perú registrados; un operador lo revisará.");
    }

    public List<CommunityReport> list(ReportStatus status) {
        return repository.findAll(status, MAX_LIST).stream().map(this::withPlace).toList();
    }

    public CommunityReport changeStatus(int reportId, ReportStatus status, String note) {
        require(reportId);
        repository.updateStatus(reportId, status);
        Optional.ofNullable(ALERT_STATUS.get(status)).ifPresent(alertStatus -> alerts.syncWithReport(reportId, alertStatus, note));
        return withPlace(require(reportId));
    }

    private void raiseAlert(int reportId, NewReport report, RegionDetail district, NearestHotspot nearest) {
        String satellite = nearest == null
                ? "No hay focos de satélite a menos de 11 km en los últimos %d días.".formatted(HOTSPOT_LOOKBACK_DAYS)
                : "Hay un foco de satélite a %.1f km.".formatted(nearest.distanceKm());
        String description = report.description() == null || report.description().isBlank()
                ? "" : "Descripción: «%s». ".formatted(report.description().strip());
        String message = "%s reportado por la comunidad. %sUbicación: %.5f, %.5f. %s".formatted(
                report.type().label(), description, report.latitude(), report.longitude(), satellite);
        alerts.raise(new NewAlert(district.region().id(), AlertType.COMMUNITY_REPORT, ALERT_LEVEL.get(report.type()),
                "%s en %s".formatted(report.type().label(), district.region().name()), message,
                "report:" + reportId, reportId));
    }

    private Optional<RegionDetail> locate(double latitude, double longitude) {
        try {
            return Optional.of(regions.locate(latitude, longitude));
        } catch (ResourceNotFoundException outsideDistricts) {
            return Optional.empty();
        }
    }

    private CommunityReport require(int reportId) {
        return repository.find(reportId).orElseThrow(() -> new ResourceNotFoundException("No existe el reporte " + reportId + "."));
    }

    private CommunityReport withPlace(CommunityReport report) {
        String place = report.regionId() == null ? null : regions.detail(report.regionId()).path();
        return new CommunityReport(report.id(), report.type(), report.typeLabel(), report.latitude(), report.longitude(),
                report.regionId(), place, report.description(), report.reporterName(), report.reporterContact(),
                report.status(), report.nearestHotspotKm(), report.createdAtUtc(), report.updatedAtUtc());
    }
}
