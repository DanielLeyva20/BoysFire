package pe.boysfire.api.report;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import pe.boysfire.api.common.error.InvalidRequestException;
import pe.boysfire.api.common.security.OperationsProperties;

/**
 * Freno contra el abuso del formulario público: cada dirección IP puede enviar un número
 * limitado de reportes dentro de una ventana de tiempo. Vive en memoria; basta para una
 * sola instancia de la API.
 */
@Component
class ReportRateLimiter {

    private final Map<String, Deque<Instant>> recentByClient = new ConcurrentHashMap<>();
    private final OperationsProperties properties;
    private final Clock clock;

    ReportRateLimiter(OperationsProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    void check(String clientId) {
        Instant now = clock.instant();
        Instant windowStart = now.minus(properties.reportRateWindow());
        Deque<Instant> recent = recentByClient.computeIfAbsent(clientId, key -> new ArrayDeque<>());
        synchronized (recent) {
            while (!recent.isEmpty() && recent.peekFirst().isBefore(windowStart)) {
                recent.pollFirst();
            }
            if (recent.size() >= properties.reportRateLimit()) {
                throw new InvalidRequestException(
                        "Ya enviaste varios reportes hace poco. Espera unos minutos; si es una emergencia, llama a Bomberos al 116.");
            }
            recent.addLast(now);
        }
    }
}
