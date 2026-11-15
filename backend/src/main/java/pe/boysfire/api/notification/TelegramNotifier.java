package pe.boysfire.api.notification;

import java.util.List;
import org.springframework.stereotype.Component;
import pe.boysfire.api.contact.Contact;
import pe.boysfire.api.notification.TelegramClient.Button;

/** Envía la alerta por Telegram con botones para responder sin escribir. */
@Component
class TelegramNotifier implements Notifier {

    static final String CHANNEL = "TELEGRAM";
    /** Formato de los botones: r:{alerta}:{respuesta}. Telegram limita estos datos a 64 bytes. */
    static final String CALLBACK_PREFIX = "r";

    private final TelegramClient client;
    private final TelegramProperties properties;

    TelegramNotifier(TelegramClient client, TelegramProperties properties) {
        this.client = client;
        this.properties = properties;
    }

    @Override
    public int priority() {
        return 10;
    }

    @Override
    public boolean canReach(Contact contact) {
        return properties.enabled() && contact.hasTelegram();
    }

    @Override
    public DeliveryOutcome send(Contact contact, OutgoingAlert alert) {
        try {
            long messageId = client.sendMessage(contact.telegramChatId(), format(contact, alert), buttons(alert.alertId()));
            return DeliveryOutcome.sent(CHANNEL, String.valueOf(messageId));
        } catch (TelegramClient.TelegramException exception) {
            return DeliveryOutcome.failed(CHANNEL, exception.getMessage());
        }
    }

    private static String format(Contact contact, OutgoingAlert alert) {
        StringBuilder text = new StringBuilder()
                .append("🔥 <b>").append(escape(alert.title())).append("</b>\n")
                .append("Nivel: <b>").append(escape(alert.levelLabel())).append("</b> · ").append(escape(alert.place())).append("\n\n")
                .append(escape(alert.message())).append("\n");
        if (!alert.recommendations().isEmpty()) {
            text.append("\n<b>Qué hacer</b>\n");
            alert.recommendations().forEach(recommendation -> text.append("• ").append(escape(recommendation)).append("\n"));
        }
        text.append("\n<a href=\"").append(escape(alert.link())).append("\">Ver en el mapa</a>\n")
                .append("\n").append(escape(contact.fullName())).append(", indícanos qué sabes con los botones:");
        return text.toString();
    }

    private static List<List<Button>> buttons(int alertId) {
        return List.of(
                List.of(button("✅ Recibido", alertId, "RECEIVED"), button("🔎 Voy a verificar", alertId, "VERIFYING")),
                List.of(button("🔥 Confirmo el incendio", alertId, "CONFIRMED"), button("❌ Falsa alarma", alertId, "FALSE_ALARM")));
    }

    private static Button button(String text, int alertId, String response) {
        return new Button(text, "%s:%d:%s".formatted(CALLBACK_PREFIX, alertId, response));
    }

    /** El modo HTML de Telegram solo exige escapar estos tres caracteres. */
    private static String escape(String text) {
        return text == null ? "" : text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
