package pe.boysfire.api.report;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.report.ReportViews.CommunityReport;
import pe.boysfire.api.report.ReportViews.NewReport;
import pe.boysfire.api.report.ReportViews.ReportReceipt;
import pe.boysfire.api.report.ReportViews.StatusChange;

/** Enviar un reporte es público; verlos y verificarlos es solo para operadores ({@code /api/ops}). */
@Tag(name = "Reportes comunitarios", description = "Humo o fuego visto por la comunidad")
@RestController
class ReportController {

    /** Cabecera que añade un proxy (ngrok, el servidor de Angular) con la IP real del visitante. */
    private static final String FORWARDED_FOR = "X-Forwarded-For";

    private final ReportService service;

    ReportController(ReportService service) {
        this.service = service;
    }

    @Operation(summary = "Enviar un reporte de humo o fuego")
    @PostMapping("/api/reports")
    @ResponseStatus(HttpStatus.CREATED)
    ReportReceipt submit(@Valid @RequestBody NewReport report, HttpServletRequest request) {
        return service.submit(report, clientId(request));
    }

    @Operation(summary = "Reportes recibidos, los más recientes primero (operadores)")
    @GetMapping("/api/ops/reports")
    List<CommunityReport> list(@RequestParam(required = false) ReportStatus status) {
        return service.list(status);
    }

    @Operation(summary = "Marcar un reporte como en verificación, confirmado o descartado (operadores)")
    @PatchMapping("/api/ops/reports/{reportId}")
    CommunityReport changeStatus(@PathVariable int reportId, @Valid @RequestBody StatusChange change) {
        return service.changeStatus(reportId, change.status(), change.note());
    }

    private static String clientId(HttpServletRequest request) {
        String forwarded = request.getHeader(FORWARDED_FOR);
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].strip();
    }
}
