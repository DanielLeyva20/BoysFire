package pe.boysfire.api.monitoring;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import pe.boysfire.api.alert.AlertService;
import pe.boysfire.api.contact.ContactService;
import pe.boysfire.api.region.RegionService;
import pe.boysfire.api.risk.RiskLevel;
import pe.boysfire.api.risk.RiskService;
import pe.boysfire.api.risk.RiskViews.RegionRisk;

/**
 * Supervisión del sistema: corre las revisiones, guarda cada resultado (historial) y arma
 * el tablero del operador con la lista de vigilancia de las zonas de mayor riesgo.
 */
@Service
public class MonitoringService {

    private static final int WATCHLIST_SIZE = 15;

    private final List<CheckGroup> groups;
    private final JdbcClient jdbc;
    private final RiskService risk;
    private final RegionService regions;
    private final ContactService contacts;
    private final AlertService alerts;

    MonitoringService(List<CheckGroup> groups, JdbcClient jdbc, RiskService risk, RegionService regions,
                      ContactService contacts, AlertService alerts) {
        this.groups = groups;
        this.jdbc = jdbc;
        this.risk = risk;
        this.regions = regions;
        this.contacts = contacts;
        this.alerts = alerts;
    }

    /**
     * Provincia en vigilancia.
     *
     * @param contacts responsables que recibirían una alerta de esta zona
     */
    public record WatchItem(int regionId, String place, RiskLevel level, int score, int contacts) {
    }

    public record Counters(int pendingAlerts, int pendingReports, int activeContacts) {
    }

    public record Overview(List<CheckResult> checks, List<WatchItem> watchlist, Counters counters) {
    }

    /** Corre todas las revisiones y guarda sus resultados. */
    public List<CheckResult> runChecks() {
        List<CheckResult> results = new ArrayList<>();
        for (CheckGroup group : groups) {
            results.addAll(group.run());
        }
        for (CheckResult result : results) {
            jdbc.sql("INSERT INTO ops.monitoring_check (check_code, title, status, message) VALUES (:code, :title, :status, :message)")
                    .param("code", result.code())
                    .param("title", result.title())
                    .param("status", result.status().name())
                    .param("message", result.message().length() > 300 ? result.message().substring(0, 300) : result.message())
                    .update();
        }
        return results;
    }

    public Overview overview() {
        List<CheckResult> latest = latestChecks();
        if (latest.isEmpty()) {
            runChecks();
            latest = latestChecks();
        }
        int pendingReports = jdbc.sql("SELECT COUNT(*) FROM ops.community_report WHERE status IN ('RECEIVED', 'VERIFYING')")
                .query(Integer.class).single();
        return new Overview(latest, watchlist(),
                new Counters(alerts.countPending(), pendingReports, contacts.active().size()));
    }

    private List<WatchItem> watchlist() {
        List<WatchItem> items = new ArrayList<>();
        for (RegionRisk province : risk.watchlist(WATCHLIST_SIZE)) {
            if (province.level() == RiskLevel.LOW) {
                continue;
            }
            items.add(new WatchItem(province.regionId(), regions.detail(province.regionId()).path(), province.level(),
                    province.score(), contacts.coverageOf(province.regionId())));
        }
        return items;
    }

    /** El resultado más reciente de cada revisión: primero los errores, luego los avisos. */
    private List<CheckResult> latestChecks() {
        return jdbc.sql("""
                        SELECT check_code, title, status, message, checked_at FROM (
                            SELECT check_code, title, status, message, checked_at,
                                   ROW_NUMBER() OVER (PARTITION BY check_code ORDER BY checked_at DESC, check_id DESC) AS position
                            FROM ops.monitoring_check
                        ) AS ranked
                        WHERE position = 1
                        ORDER BY CASE status WHEN 'ERROR' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, check_code
                        """)
                .query((row, rowNumber) -> new CheckResult(
                        row.getString("check_code"),
                        row.getString("title"),
                        CheckResult.CheckStatus.valueOf(row.getString("status")),
                        row.getString("message"),
                        row.getObject("checked_at", LocalDateTime.class)))
                .list();
    }
}
