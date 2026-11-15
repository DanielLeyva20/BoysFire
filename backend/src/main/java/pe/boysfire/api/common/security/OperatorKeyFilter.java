package pe.boysfire.api.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Protege las rutas de operación ({@code /api/ops/**}): datos personales de los responsables,
 * gestión de alertas y reportes. Exige la cabecera {@value #HEADER} con la clave configurada.
 * El resto de la API es pública y de solo lectura, salvo el envío de reportes comunitarios.
 */
@Component
public class OperatorKeyFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Operator-Key";
    private static final String PROTECTED_PREFIX = "/api/ops/";

    private final OperationsProperties properties;

    public OperatorKeyFilter(OperationsProperties properties) {
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(PROTECTED_PREFIX)
                || HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!properties.operatorAccessEnabled()) {
            reject(response, HttpStatus.SERVICE_UNAVAILABLE, "El panel de operación está deshabilitado: falta OPERATOR_KEY en el .env.");
            return;
        }
        if (!matches(request.getHeader(HEADER))) {
            reject(response, HttpStatus.UNAUTHORIZED, "Clave de operador incorrecta o ausente.");
            return;
        }
        chain.doFilter(request, response);
    }

    /** Comparación en tiempo constante, para no revelar la clave por tiempos de respuesta. */
    private boolean matches(String provided) {
        if (provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8), properties.operatorKey().getBytes(StandardCharsets.UTF_8));
    }

    private static void reject(HttpServletResponse response, HttpStatus status, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/problem+json;charset=UTF-8");
        response.getWriter().write("""
                {"status":%d,"title":"%s","detail":"%s"}""".formatted(status.value(), status.getReasonPhrase(), detail));
    }
}
