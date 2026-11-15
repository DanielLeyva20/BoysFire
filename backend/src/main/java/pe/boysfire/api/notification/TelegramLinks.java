package pe.boysfire.api.notification;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Enlaces {@code t.me} al bot. El nombre del bot se pide a Telegram una vez y se recuerda. */
@Component
public class TelegramLinks {

    private static final Logger log = LoggerFactory.getLogger(TelegramLinks.class);

    private final TelegramClient client;
    private final TelegramProperties properties;
    private final AtomicReference<String> username = new AtomicReference<>();

    TelegramLinks(TelegramClient client, TelegramProperties properties) {
        this.client = client;
        this.properties = properties;
    }

    /** Enlace que abre el bot y le envía el código de enlace del responsable. */
    public Optional<String> startLink(String linkCode) {
        return botUsername().map(name -> "https://t.me/%s?start=%s".formatted(name, linkCode));
    }

    public Optional<String> botUsername() {
        if (!properties.enabled()) {
            return Optional.empty();
        }
        if (username.get() == null) {
            try {
                client.botUsername().ifPresent(username::set);
            } catch (TelegramClient.TelegramException exception) {
                log.warn("No se pudo obtener el nombre del bot: {}", exception.getMessage());
            }
        }
        return Optional.ofNullable(username.get());
    }
}
