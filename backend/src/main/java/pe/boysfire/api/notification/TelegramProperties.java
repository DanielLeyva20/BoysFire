package pe.boysfire.api.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param botToken token de @BotFather; vacío deja Telegram apagado y los envíos se registran como simulados
 * @param appUrl   dirección pública de la aplicación, para los enlaces de los mensajes
 */
@Validated
@ConfigurationProperties("boysfire.telegram")
public record TelegramProperties(String botToken, @NotNull Duration pollInterval, @NotBlank String apiBaseUrl, @NotBlank String appUrl) {

    public boolean enabled() {
        return botToken != null && !botToken.isBlank();
    }
}
