package pe.boysfire.api.notification;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;
import pe.boysfire.api.contact.Contact;

/** Elige, para cada responsable, el mejor canal que puede alcanzarlo. */
@Component
public class NotificationRouter {

    private final List<Notifier> notifiers;

    NotificationRouter(List<Notifier> notifiers) {
        this.notifiers = notifiers.stream().sorted(Comparator.comparingInt(Notifier::priority)).toList();
    }

    public DeliveryOutcome deliver(Contact contact, OutgoingAlert alert) {
        return notifiers.stream()
                .filter(notifier -> notifier.canReach(contact))
                .findFirst()
                .orElseThrow()
                .send(contact, alert);
    }
}
