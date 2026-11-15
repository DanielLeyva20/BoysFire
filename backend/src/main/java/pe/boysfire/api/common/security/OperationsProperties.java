package pe.boysfire.api.common.security;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param operatorKey      clave del panel de operadores; vacía deshabilita /api/ops/**
 * @param reportRateLimit  reportes comunitarios permitidos por IP dentro de {@code reportRateWindow}
 */
@Validated
@ConfigurationProperties("boysfire.operations")
public record OperationsProperties(String operatorKey, @Positive int reportRateLimit, @NotNull Duration reportRateWindow) {

    public boolean operatorAccessEnabled() {
        return operatorKey != null && !operatorKey.isBlank();
    }
}
