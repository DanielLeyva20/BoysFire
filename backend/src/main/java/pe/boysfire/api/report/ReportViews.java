package pe.boysfire.api.report;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** Peticiones y respuestas del módulo de reportes comunitarios. */
public final class ReportViews {

    private ReportViews() {
    }

    /** Lo que envía una persona de la comunidad. Solo el tipo y la ubicación son obligatorios. */
    public record NewReport(
            @NotNull ReportType type,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @Size(max = 500) String description,
            @Size(max = 80) String reporterName,
            @Size(max = 80) String reporterContact) {
    }

    /**
     * Acuse de recibo para quien reportó.
     *
     * @param place              distrito, provincia y departamento; {@code null} si el punto cae fuera de Perú
     * @param nearestHotspotKm   distancia al foco de satélite más cercano de los últimos días; {@code null} si no hay
     */
    public record ReportReceipt(int reportId, String place, Double nearestHotspotKm, String message) {
    }

    /** Un reporte, como lo ven los operadores. */
    public record CommunityReport(
            int id,
            ReportType type,
            String typeLabel,
            double latitude,
            double longitude,
            Integer regionId,
            String place,
            String description,
            String reporterName,
            String reporterContact,
            ReportStatus status,
            Double nearestHotspotKm,
            LocalDateTime createdAtUtc,
            LocalDateTime updatedAtUtc) {
    }

    public record StatusChange(@NotNull ReportStatus status, @Size(max = 500) String note) {
    }
}
