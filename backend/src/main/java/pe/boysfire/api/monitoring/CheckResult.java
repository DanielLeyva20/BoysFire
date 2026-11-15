package pe.boysfire.api.monitoring;

import java.time.LocalDateTime;

/**
 * Resultado de una revisión.
 *
 * @param code    identificador estable (p. ej. HOTSPOT_FRESHNESS)
 * @param title   qué se revisa, en palabras
 * @param message qué se encontró y, si hace falta, qué hacer
 */
public record CheckResult(String code, String title, CheckStatus status, String message, LocalDateTime checkedAtUtc) {

    public enum CheckStatus {
        OK, WARNING, ERROR
    }

    static CheckResult ok(String code, String title, String message) {
        return new CheckResult(code, title, CheckStatus.OK, message, null);
    }

    static CheckResult warning(String code, String title, String message) {
        return new CheckResult(code, title, CheckStatus.WARNING, message, null);
    }

    static CheckResult error(String code, String title, String message) {
        return new CheckResult(code, title, CheckStatus.ERROR, message, null);
    }
}
