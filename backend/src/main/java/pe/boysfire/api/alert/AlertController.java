package pe.boysfire.api.alert;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.alert.AlertViews.AlertDetail;
import pe.boysfire.api.alert.AlertViews.AlertSummary;
import pe.boysfire.api.alert.AlertViews.ChangeStatusRequest;
import pe.boysfire.api.alert.AlertViews.DispatchResult;
import pe.boysfire.api.alert.AlertViews.RecordResponseRequest;

/** Solo operadores: coordinación de la verificación con responsables y autoridades. */
@Tag(name = "Operación: alertas", description = "Alertas emitidas, envíos, respuestas y verificación")
@RestController
@RequestMapping("/api/ops/alerts")
class AlertController {

    private static final String PANEL_CHANNEL = "PANEL";

    private final AlertService service;

    AlertController(AlertService service) {
        this.service = service;
    }

    @Operation(summary = "Alertas, las más recientes primero; filtrables por estado")
    @GetMapping
    List<AlertSummary> list(@RequestParam(required = false) AlertStatus status) {
        return service.list(status);
    }

    @Operation(summary = "Una alerta con sus envíos, respuestas e historial")
    @GetMapping("/{alertId}")
    AlertDetail detail(@PathVariable int alertId) {
        return service.detail(alertId);
    }

    @Operation(summary = "Cambiar el estado (p. ej. confirmada por la autoridad, descartada, cerrada)")
    @PatchMapping("/{alertId}/status")
    AlertDetail changeStatus(@PathVariable int alertId, @Valid @RequestBody ChangeStatusRequest request) {
        return service.changeStatus(alertId, request.status(), AlertService.OPERATOR_ACTOR, request.note());
    }

    @Operation(summary = "Registrar una respuesta recibida por otro medio (teléfono, en persona)")
    @PostMapping("/{alertId}/responses")
    AlertDetail recordResponse(@PathVariable int alertId, @Valid @RequestBody RecordResponseRequest request) {
        return service.recordResponse(alertId, request.contactId(), request.response(), PANEL_CHANNEL, request.note());
    }

    @Operation(summary = "Enviar la alerta a los responsables que aún no la recibieron")
    @PostMapping("/{alertId}/dispatch")
    DispatchResult dispatch(@PathVariable int alertId) {
        return service.dispatch(alertId);
    }
}
