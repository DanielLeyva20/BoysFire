package pe.boysfire.api.monitoring;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import pe.boysfire.api.notification.TelegramProperties;

/** ¿Los avisos están llegando y alguien los está atendiendo? */
@Component
class OperationChecks implements CheckGroup {

    private static final int REPORT_WAIT_HOURS = 2;
    private static final int ALERT_WAIT_HOURS = 6;

    private final JdbcClient jdbc;
    private final TelegramProperties telegram;

    OperationChecks(JdbcClient jdbc, TelegramProperties telegram) {
        this.jdbc = jdbc;
        this.telegram = telegram;
    }

    @Override
    public List<CheckResult> run() {
        return List.of(telegramChannel(), pendingReports(), unansweredAlerts(), highRiskWithoutContacts());
    }

    private CheckResult telegramChannel() {
        String code = "TELEGRAM";
        String title = "Canal de Telegram";
        int contacts = count("SELECT COUNT(*) FROM ops.local_contact WHERE is_active = 1");
        int linked = count("SELECT COUNT(*) FROM ops.local_contact WHERE is_active = 1 AND telegram_chat_id IS NOT NULL");
        if (!telegram.enabled()) {
            return CheckResult.warning(code, title,
                    "Sin TELEGRAM_BOT_TOKEN: las alertas se registran como simuladas y no llegan a los celulares.");
        }
        String message = "%d de %d responsables enlazaron su Telegram.".formatted(linked, contacts);
        return linked == contacts && contacts > 0 ? CheckResult.ok(code, title, message) : CheckResult.warning(code, title, message);
    }

    private CheckResult pendingReports() {
        String code = "PENDING_REPORTS";
        String title = "Reportes comunitarios sin revisar";
        int pending = count("SELECT COUNT(*) FROM ops.community_report WHERE status = 'RECEIVED' AND created_at < DATEADD(HOUR, -"
                + REPORT_WAIT_HOURS + ", SYSUTCDATETIME())");
        return pending == 0
                ? CheckResult.ok(code, title, "Ningún reporte espera más de %d horas.".formatted(REPORT_WAIT_HOURS))
                : CheckResult.warning(code, title, "%d reporte(s) esperan revisión hace más de %d horas.".formatted(pending, REPORT_WAIT_HOURS));
    }

    private CheckResult unansweredAlerts() {
        String code = "UNANSWERED_ALERTS";
        String title = "Alertas sin respuesta";
        int unanswered = count("""
                SELECT COUNT(*) FROM ops.alert AS alert
                WHERE alert.status = 'NOTIFIED' AND alert.created_at < DATEADD(HOUR, -%d, SYSUTCDATETIME())
                  AND NOT EXISTS (SELECT 1 FROM ops.alert_response AS response WHERE response.alert_id = alert.alert_id)
                """.formatted(ALERT_WAIT_HOURS));
        return unanswered == 0
                ? CheckResult.ok(code, title, "Todas las alertas notificadas tienen respuesta o son recientes.")
                : CheckResult.warning(code, title,
                        "%d alerta(s) notificadas hace más de %d horas no tienen respuesta: contacta por otro medio."
                                .formatted(unanswered, ALERT_WAIT_HOURS));
    }

    /** Una provincia en riesgo alto sin nadie que reciba el aviso es un punto ciego. */
    private CheckResult highRiskWithoutContacts() {
        String code = "HIGH_RISK_COVERAGE";
        String title = "Zonas en riesgo alto con responsables";
        int uncovered = count("""
                SELECT COUNT(*) FROM risk.assessment AS assessment
                JOIN ref.region AS province ON province.region_id = assessment.region_id
                WHERE province.region_level_id = 3 AND assessment.risk_level_id = 3
                  AND assessment.assessment_date = CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00') AS DATE)
                  AND NOT EXISTS (
                      SELECT 1 FROM ops.local_contact AS contact
                      JOIN ref.region AS place ON place.region_id = contact.region_id
                      WHERE contact.is_active = 1
                        AND (contact.region_id IN (province.region_id, province.parent_region_id)
                             OR place.parent_region_id = province.region_id))
                """);
        return uncovered == 0
                ? CheckResult.ok(code, title, "Todas las provincias en riesgo alto tienen al menos un responsable.")
                : CheckResult.warning(code, title, "%d provincia(s) en riesgo alto no tienen responsables: registra a alguien."
                        .formatted(uncovered));
    }

    private int count(String sql) {
        return jdbc.sql(sql).query(Integer.class).single();
    }
}
