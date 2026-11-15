package pe.boysfire.api.notification;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import pe.boysfire.api.alert.AlertService;
import pe.boysfire.api.alert.ResponseType;
import pe.boysfire.api.common.error.ResourceNotFoundException;
import pe.boysfire.api.common.scheduling.ScheduledJob;
import pe.boysfire.api.contact.Contact;
import pe.boysfire.api.contact.ContactService;
import pe.boysfire.api.notification.TelegramClient.CallbackQuery;
import pe.boysfire.api.notification.TelegramClient.Message;
import pe.boysfire.api.notification.TelegramClient.Update;

/**
 * Lee lo que los responsables envían al bot (consulta periódica, sin necesidad de URL
 * pública):
 * <ul>
 *   <li>{@code /start CÓDIGO}: enlaza su Telegram con su registro de responsable.</li>
 *   <li>Botones de una alerta: registra su respuesta.</li>
 * </ul>
 * Sin token configurado no hace nada.
 */
@Component
class TelegramInboxJob implements ScheduledJob {

    private static final String OFFSET_KEY = "telegram.update_offset";
    private static final String START_COMMAND = "/start";
    private static final Logger log = LoggerFactory.getLogger(TelegramInboxJob.class);

    private final TelegramClient client;
    private final TelegramProperties properties;
    private final ContactService contacts;
    private final AlertService alerts;
    private final IntegrationStateRepository state;

    TelegramInboxJob(TelegramClient client, TelegramProperties properties, ContactService contacts, AlertService alerts,
                     IntegrationStateRepository state) {
        this.client = client;
        this.properties = properties;
        this.contacts = contacts;
        this.alerts = alerts;
        this.state = state;
    }

    @Override
    public String name() {
        return "bandeja de Telegram";
    }

    @Override
    public Duration interval() {
        return properties.pollInterval();
    }

    @Override
    public Duration initialDelay() {
        return Duration.ofSeconds(10);
    }

    @Override
    public void run() {
        if (!properties.enabled()) {
            return;
        }
        long offset = state.find(OFFSET_KEY).map(Long::parseLong).orElse(0L);
        List<Update> updates = client.getUpdates(offset);
        for (Update update : updates) {
            try {
                handle(update);
            } catch (RuntimeException exception) {
                log.warn("No se pudo procesar el mensaje de Telegram {}: {}", update.updateId(), exception.getMessage());
            }
            offset = Math.max(offset, update.updateId() + 1);
        }
        if (!updates.isEmpty()) {
            state.save(OFFSET_KEY, String.valueOf(offset));
        }
    }

    private void handle(Update update) {
        if (update.callbackQuery() != null) {
            handleButton(update.callbackQuery());
        } else if (update.message() != null && update.message().text() != null) {
            handleText(update.message());
        }
    }

    private void handleText(Message message) {
        long chatId = message.chat().id();
        String text = message.text().strip();
        if (text.startsWith(START_COMMAND) && text.length() > START_COMMAND.length()) {
            String code = text.substring(START_COMMAND.length()).strip();
            Optional<Contact> linked = contacts.linkTelegram(code, chatId);
            reply(chatId, linked
                    .map(contact -> "¡Listo, %s! Desde ahora recibirás aquí las alertas de incendio de tu zona.".formatted(contact.fullName()))
                    .orElse("No encontré ese código. Pídele a tu coordinador el código de 8 letras de tu registro."));
            return;
        }
        reply(chatId, contacts.findByChatId(chatId)
                .map(contact -> "Hola, %s. Te avisaré aquí cuando haya una alerta en tu zona. Responde con los botones de cada aviso."
                        .formatted(contact.fullName()))
                .orElse("Hola. Este es el bot de alertas de BoysFire. Para recibir alertas, envía /start seguido del código que te dio tu coordinador."));
    }

    private void handleButton(CallbackQuery callback) {
        String[] parts = callback.data() == null ? new String[0] : callback.data().split(":");
        Optional<Contact> contact = contacts.findByChatId(callback.from().id());
        if (parts.length != 3 || !TelegramNotifier.CALLBACK_PREFIX.equals(parts[0]) || contact.isEmpty()) {
            client.answerCallback(callback.id(), "No pude registrar tu respuesta.");
            return;
        }
        ResponseType response = ResponseType.valueOf(parts[2]);
        try {
            alerts.recordResponse(Integer.parseInt(parts[1]), contact.get().id(), response, TelegramNotifier.CHANNEL, null);
            client.answerCallback(callback.id(), "Respuesta registrada: " + response.label());
        } catch (ResourceNotFoundException missingAlert) {
            client.answerCallback(callback.id(), "Esa alerta ya no existe.");
        }
    }

    private void reply(long chatId, String text) {
        client.sendMessage(chatId, text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), List.of());
    }
}
