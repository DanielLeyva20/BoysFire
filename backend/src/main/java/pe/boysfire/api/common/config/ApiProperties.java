package pe.boysfire.api.common.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Ajustes propios de la API (prefijo {@code boysfire} en application.yml). */
@Validated
@ConfigurationProperties("boysfire")
public record ApiProperties(@NotNull @Valid Cors cors, @NotNull @Valid Limits limits) {

    public record Cors(@NotEmpty List<String> allowedOrigins) {
    }

    /** Topes que evitan respuestas enormes por una consulta demasiado amplia. */
    public record Limits(
            @Positive int hotspotMaxDays,
            @Positive int hotspotDefaultLimit,
            @Positive int hotspotMaxLimit,
            @Positive int mapCellMaxDays,
            @Positive int regionSearchMaxResults) {
    }
}
