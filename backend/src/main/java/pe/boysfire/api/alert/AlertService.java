package pe.boysfire.api.alert;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import pe.boysfire.api.alert.AlertRepository.StoredAlert;
import pe.boysfire.api.alert.AlertViews.AlertDetail;
import pe.boysfire.api.alert.AlertViews.AlertSummary;
import pe.boysfire.api.alert.AlertViews.DispatchResult;
import pe.boysfire.api.alert.AlertViews.NewAlert;
import pe.boysfire.api.common.error.InvalidRequestException;
import pe.boysfire.api.common.error.ResourceNotFoundException;
import pe.boysfire.api.contact.Contact;
import pe.boysfire.api.contact.ContactService;
import pe.boysfire.api.notification.DeliveryOutcome;
import pe.boysfire.api.notification.NotificationRouter;
import pe.boysfire.api.notification.OutgoingAlert;
import pe.boysfire.api.notification.TelegramProperties;
import pe.boysfire.api.region.RegionService;
import pe.boysfire.api.risk.RiskFactor;
import pe.boysfire.api.risk.RiskLevel;
import pe.boysfire.api.risk.RiskService;

/**
 * Ciclo de vida de las alertas: crearlas sin duplicar, avisar a los responsables de la zona,
 * registrar sus respuestas y cada cambio de estado. Todo queda en la base: es el registro de
 * lo que se avisó, a quién, por qué canal y qué contestaron.
 */
@Service
public class AlertService {

    public static final String SYSTEM_ACTOR = "Sistema";
    public static final String OPERATOR_ACTOR = "Operador";
    private static final int MAX_LIST = 200;

    private static final Map<RiskLevel, String> LEVEL_LABELS =
            Map.of(RiskLevel.LOW, "Bajo", RiskLevel.MODERATE, "Moderado", RiskLevel.HIGH, "Alto");

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertRepository repository;
    private final ContactService contacts;
    private final NotificationRouter router;
    private final RegionService regions;
    private final RiskService risk;
    private final TelegramProperties telegram;
    private final Clock clock;

    AlertService(AlertRepository repository, ContactService contacts, NotificationRouter router, RegionService regions,
                 RiskService risk, TelegramProperties telegram, Clock clock) {
        this.repository = repository;
        this.contacts = contacts;
        this.router = router;
        this.regions = regions;
        this.risk = risk;
        this.telegram = telegram;
        this.clock = clock;
    }

    /** Crea la alerta y avisa a los responsables. Vacío si ya existía una alerta por el mismo hecho. */
    public Optional<Integer> raise(NewAlert alert) {
        if (repository.existsByDedupeKey(alert.dedupeKey())) {
            return Optional.empty();
        }
        int alertId;
        try {
            alertId = repository.insert(alert);
        } catch (DuplicateKeyException concurrentInsert) {
            return Optional.empty();
        }
        repository.insertStatusChange(alertId, null, AlertStatus.OPEN, SYSTEM_ACTOR, "Generada: " + alert.type().label());
        dispatch(alertId);
        return Optional.of(alertId);
    }

    /** Avisa a los responsables de la zona que aún no recibieron la alerta. */
    public DispatchResult dispatch(int alertId) {
        StoredAlert alert = require(alertId);
        Set<Integer> alreadyNotified = repository.findNotifiedContactIds(alertId);
        List<Contact> recipients = contacts.recipientsFor(alert.summary().regionId()).stream()
                .filter(contact -> !alreadyNotified.contains(contact.id()))
                .toList();
        OutgoingAlert outgoing = toOutgoing(alert);

        int sent = 0;
        int simulated = 0;
        int failed = 0;
        for (Contact contact : recipients) {
            DeliveryOutcome outcome = router.deliver(contact, outgoing);
            repository.insertDelivery(alertId, contact.id(), outcome.channel(), outcome.status(), outcome.externalId(), outcome.error());
            switch (outcome.status()) {
                case "SENT" -> sent++;
                case "SIMULATED" -> simulated++;
                default -> failed++;
            }
        }
        recordDispatch(alert, recipients.size(), sent, simulated, failed);
        return new DispatchResult(sent, simulated, failed, alreadyNotified.size());
    }

    public List<AlertSummary> list(AlertStatus status) {
        return repository.findAll(status, MAX_LIST).stream().map(this::withPlace).toList();
    }

    public int countPending() {
        return repository.countByStatus(Set.of(AlertStatus.OPEN, AlertStatus.NOTIFIED, AlertStatus.VERIFYING));
    }

    public AlertDetail detail(int alertId) {
        StoredAlert alert = require(alertId);
        return new AlertDetail(
                withPlace(alert.summary()),
                alert.message(),
                alert.reportId(),
                repository.findDeliveries(alertId),
                repository.findResponses(alertId),
                repository.findHistory(alertId));
    }

    public AlertDetail changeStatus(int alertId, AlertStatus status, String actor, String note) {
        AlertStatus current = require(alertId).summary().status();
        if (current == status) {
            throw new InvalidRequestException("La alerta ya está en estado «%s».".formatted(status.label()));
        }
        repository.updateStatus(alertId, status);
        repository.insertStatusChange(alertId, current, status, actor, blankToNull(note));
        return detail(alertId);
    }

    /**
     * Registra lo que contestó un responsable. "Voy a verificar" y "Confirmo" mueven la
     * alerta si todavía estaba pendiente; una falsa alarma la decide un operador.
     */
    public AlertDetail recordResponse(int alertId, Integer contactId, ResponseType response, String channel, String note) {
        StoredAlert alert = require(alertId);
        Contact contact = contactId == null ? null : contacts.require(contactId);
        repository.insertResponse(alertId, contactId, response, channel, blankToNull(note));

        AlertStatus current = alert.summary().status();
        response.resultingStatus()
                .filter(target -> current.isPending() && current != target)
                .ifPresent(target -> {
                    repository.updateStatus(alertId, target);
                    repository.insertStatusChange(alertId, current, target,
                            contact == null ? OPERATOR_ACTOR : contact.fullName(), "Respuesta: " + response.label());
                });
        return detail(alertId);
    }

    /** Lleva la alerta de un reporte al estado que decidió el operador al verificar el reporte. */
    public void syncWithReport(int reportId, AlertStatus status, String note) {
        repository.findIdByReport(reportId).ifPresent(alertId -> {
            AlertStatus current = require(alertId).summary().status();
            if (current != status) {
                repository.updateStatus(alertId, status);
                repository.insertStatusChange(alertId, current, status, OPERATOR_ACTOR,
                        note == null ? "Actualizada desde la verificación del reporte" : note);
            }
        });
    }

    private void recordDispatch(StoredAlert alert, int recipients, int sent, int simulated, int failed) {
        int alertId = alert.summary().id();
        AlertStatus current = alert.summary().status();
        if (recipients == 0) {
            repository.insertStatusChange(alertId, current, current, SYSTEM_ACTOR,
                    "No hay responsables nuevos registrados para esta zona.");
            return;
        }
        String note = "Enviada a %d responsable(s): %d por Telegram, %d simulada(s), %d con error."
                .formatted(recipients, sent, simulated, failed);
        AlertStatus next = current == AlertStatus.OPEN ? AlertStatus.NOTIFIED : current;
        if (next != current) {
            repository.updateStatus(alertId, next);
        }
        repository.insertStatusChange(alertId, current, next, SYSTEM_ACTOR, note);
        log.info("Alerta {}: {}", alertId, note);
    }

    private OutgoingAlert toOutgoing(StoredAlert alert) {
        AlertSummary summary = alert.summary();
        String place = regions.detail(summary.regionId()).path();
        LocalDate today = LocalDate.now(clock);
        String link = "%s/prevencion?region=%d&fecha=%s".formatted(telegram.appUrl(), summary.regionId(), today);
        return new OutgoingAlert(summary.id(), summary.title(), LEVEL_LABELS.get(summary.level()), place, alert.message(),
                risk.recommendationsFor(summary.level(), factorsFor(summary)), link);
    }

    /** Factores cuyas recomendaciones acompañan al aviso. */
    private Set<String> factorsFor(AlertSummary alert) {
        if (alert.type() != AlertType.HIGH_RISK) {
            return Set.of(RiskFactor.ACTIVE_FIRE.name());
        }
        try {
            return risk.zone(alert.regionId(), LocalDate.now(clock)).factors().stream()
                    .map(factor -> factor.code()).collect(Collectors.toSet());
        } catch (ResourceNotFoundException noAssessmentYet) {
            return Set.of();
        }
    }

    private StoredAlert require(int alertId) {
        return repository.find(alertId).orElseThrow(() -> new ResourceNotFoundException("No existe la alerta " + alertId + "."));
    }

    private AlertSummary withPlace(AlertSummary summary) {
        return new AlertSummary(summary.id(), summary.type(), summary.typeLabel(), summary.level(), summary.title(),
                summary.regionId(), regions.detail(summary.regionId()).path(), summary.status(), summary.statusLabel(),
                summary.deliveries(), summary.responses(), summary.createdAtUtc(), summary.updatedAtUtc());
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
