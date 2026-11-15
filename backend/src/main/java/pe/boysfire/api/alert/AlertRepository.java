package pe.boysfire.api.alert;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import pe.boysfire.api.alert.AlertViews.AlertSummary;
import pe.boysfire.api.alert.AlertViews.Delivery;
import pe.boysfire.api.alert.AlertViews.NewAlert;
import pe.boysfire.api.alert.AlertViews.Response;
import pe.boysfire.api.alert.AlertViews.StatusChange;
import pe.boysfire.api.risk.RiskLevel;

@Repository
class AlertRepository {

    private static final String SELECT_SUMMARY = """
            SELECT alert.alert_id, alert.alert_type, alert.risk_level_id, alert.title, alert.region_id, alert.status,
                   alert.created_at, alert.updated_at,
                   (SELECT COUNT(*) FROM ops.alert_delivery AS delivery WHERE delivery.alert_id = alert.alert_id) AS deliveries,
                   (SELECT COUNT(*) FROM ops.alert_response AS response WHERE response.alert_id = alert.alert_id) AS responses
            FROM ops.alert AS alert
            """;

    private final JdbcClient jdbc;

    AlertRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Alerta guardada, con lo que el servicio necesita para avisar. */
    record StoredAlert(AlertSummary summary, String message, Integer reportId) {
    }

    boolean existsByDedupeKey(String dedupeKey) {
        return jdbc.sql("SELECT COUNT(*) FROM ops.alert WHERE dedupe_key = :key").param("key", dedupeKey).query(Integer.class).single() > 0;
    }

    int insert(NewAlert alert) {
        return jdbc.sql("""
                        INSERT INTO ops.alert (region_id, alert_type, risk_level_id, title, message, dedupe_key, report_id)
                        OUTPUT INSERTED.alert_id
                        VALUES (:regionId, :type, :level, :title, :message, :dedupeKey, :reportId)
                        """)
                .param("regionId", alert.regionId())
                .param("type", alert.type().name())
                .param("level", alert.level().id())
                .param("title", alert.title())
                .param("message", alert.message())
                .param("dedupeKey", alert.dedupeKey())
                .param("reportId", alert.reportId())
                .query(Integer.class)
                .single();
    }

    Optional<StoredAlert> find(int alertId) {
        return jdbc.sql("SELECT summary.*, alert.message, alert.report_id FROM (" + SELECT_SUMMARY + ") AS summary "
                        + "JOIN ops.alert AS alert ON alert.alert_id = summary.alert_id WHERE summary.alert_id = :id")
                .param("id", alertId)
                .query((row, rowNumber) -> new StoredAlert(toSummary(row), row.getString("message"),
                        row.getObject("report_id", Integer.class)))
                .optional();
    }

    Optional<Integer> findIdByReport(int reportId) {
        return jdbc.sql("SELECT alert_id FROM ops.alert WHERE report_id = :reportId").param("reportId", reportId)
                .query(Integer.class).optional();
    }

    /** Las más recientes primero; sin estado, todas. */
    List<AlertSummary> findAll(AlertStatus status, int limit) {
        return jdbc.sql("SELECT TOP (:limit) * FROM (" + SELECT_SUMMARY + ") AS summary "
                        + "WHERE (:status IS NULL OR status = :status) ORDER BY created_at DESC")
                .param("limit", limit)
                .param("status", status == null ? null : status.name())
                .query((row, rowNumber) -> toSummary(row))
                .list();
    }

    int countByStatus(Set<AlertStatus> statuses) {
        return jdbc.sql("SELECT COUNT(*) FROM ops.alert WHERE status IN (:statuses)")
                .param("statuses", statuses.stream().map(Enum::name).toList())
                .query(Integer.class)
                .single();
    }

    void updateStatus(int alertId, AlertStatus status) {
        jdbc.sql("UPDATE ops.alert SET status = :status, updated_at = SYSUTCDATETIME() WHERE alert_id = :id")
                .param("status", status.name())
                .param("id", alertId)
                .update();
    }

    void insertStatusChange(int alertId, AlertStatus from, AlertStatus to, String actor, String note) {
        jdbc.sql("""
                        INSERT INTO ops.alert_status_change (alert_id, from_status, to_status, actor, note)
                        VALUES (:alertId, :from, :to, :actor, :note)
                        """)
                .param("alertId", alertId)
                .param("from", from == null ? null : from.name())
                .param("to", to.name())
                .param("actor", actor)
                .param("note", note)
                .update();
    }

    Set<Integer> findNotifiedContactIds(int alertId) {
        return Set.copyOf(jdbc.sql("SELECT contact_id FROM ops.alert_delivery WHERE alert_id = :id")
                .param("id", alertId).query(Integer.class).list());
    }

    int insertDelivery(int alertId, int contactId, String channel, String status, String externalId, String error) {
        return jdbc.sql("""
                        INSERT INTO ops.alert_delivery (alert_id, contact_id, channel, status, external_message_id, error_message)
                        OUTPUT INSERTED.delivery_id
                        VALUES (:alertId, :contactId, :channel, :status, :externalId, :error)
                        """)
                .param("alertId", alertId)
                .param("contactId", contactId)
                .param("channel", channel)
                .param("status", status)
                .param("externalId", externalId)
                .param("error", error)
                .query(Integer.class)
                .single();
    }

    void insertResponse(int alertId, Integer contactId, ResponseType response, String channel, String note) {
        jdbc.sql("""
                        INSERT INTO ops.alert_response (alert_id, contact_id, response, channel, note)
                        VALUES (:alertId, :contactId, :response, :channel, :note)
                        """)
                .param("alertId", alertId)
                .param("contactId", contactId)
                .param("response", response.name())
                .param("channel", channel)
                .param("note", note)
                .update();
    }

    List<Delivery> findDeliveries(int alertId) {
        return jdbc.sql("""
                        SELECT delivery.delivery_id, delivery.contact_id, contact.full_name, contact.role_name, delivery.channel,
                               delivery.status, delivery.error_message, delivery.sent_at
                        FROM ops.alert_delivery AS delivery
                        JOIN ops.local_contact AS contact ON contact.contact_id = delivery.contact_id
                        WHERE delivery.alert_id = :id ORDER BY delivery.sent_at
                        """)
                .param("id", alertId)
                .query((row, rowNumber) -> new Delivery(
                        row.getInt("delivery_id"), row.getInt("contact_id"), row.getString("full_name"), row.getString("role_name"),
                        row.getString("channel"), row.getString("status"), row.getString("error_message"),
                        row.getObject("sent_at", LocalDateTime.class)))
                .list();
    }

    List<Response> findResponses(int alertId) {
        return jdbc.sql("""
                        SELECT response.response_id, response.contact_id, contact.full_name, response.response, response.channel,
                               response.note, response.responded_at
                        FROM ops.alert_response AS response
                        LEFT JOIN ops.local_contact AS contact ON contact.contact_id = response.contact_id
                        WHERE response.alert_id = :id ORDER BY response.responded_at
                        """)
                .param("id", alertId)
                .query((row, rowNumber) -> {
                    ResponseType type = ResponseType.valueOf(row.getString("response"));
                    return new Response(
                            row.getInt("response_id"), row.getObject("contact_id", Integer.class), row.getString("full_name"),
                            type, type.label(), row.getString("channel"), row.getString("note"),
                            row.getObject("responded_at", LocalDateTime.class));
                })
                .list();
    }

    List<StatusChange> findHistory(int alertId) {
        return jdbc.sql("""
                        SELECT from_status, to_status, actor, note, changed_at FROM ops.alert_status_change
                        WHERE alert_id = :id ORDER BY changed_at, change_id
                        """)
                .param("id", alertId)
                .query((row, rowNumber) -> new StatusChange(
                        row.getString("from_status") == null ? null : AlertStatus.valueOf(row.getString("from_status")),
                        AlertStatus.valueOf(row.getString("to_status")),
                        row.getString("actor"),
                        row.getString("note"),
                        row.getObject("changed_at", LocalDateTime.class)))
                .list();
    }

    private static AlertSummary toSummary(ResultSet row) throws SQLException {
        AlertType type = AlertType.valueOf(row.getString("alert_type"));
        AlertStatus status = AlertStatus.valueOf(row.getString("status"));
        return new AlertSummary(
                row.getInt("alert_id"),
                type,
                type.label(),
                RiskLevel.fromId(row.getInt("risk_level_id")),
                row.getString("title"),
                row.getInt("region_id"),
                null,
                status,
                status.label(),
                row.getInt("deliveries"),
                row.getInt("responses"),
                row.getObject("created_at", LocalDateTime.class),
                row.getObject("updated_at", LocalDateTime.class));
    }
}
