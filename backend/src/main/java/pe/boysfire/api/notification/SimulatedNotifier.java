package pe.boysfire.api.notification;

import org.springframework.stereotype.Component;
import pe.boysfire.api.contact.Contact;

/**
 * Último recurso: no envía nada, pero deja constancia del aviso que habría salido y por qué
 * no salió. Así el registro de comunicaciones está completo aunque falte Telegram.
 */
@Component
class SimulatedNotifier implements Notifier {

    private final TelegramProperties telegram;

    SimulatedNotifier(TelegramProperties telegram) {
        this.telegram = telegram;
    }

    @Override
    public int priority() {
        return Integer.MAX_VALUE;
    }

    @Override
    public boolean canReach(Contact contact) {
        return true;
    }

    @Override
    public DeliveryOutcome send(Contact contact, OutgoingAlert alert) {
        String reason = !telegram.enabled()
                ? "Telegram no está configurado (falta TELEGRAM_BOT_TOKEN)."
                : "El responsable aún no enlazó su Telegram.";
        return DeliveryOutcome.simulated(reason);
    }
}
