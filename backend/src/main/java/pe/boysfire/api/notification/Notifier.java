package pe.boysfire.api.notification;

import pe.boysfire.api.contact.Contact;

/**
 * Un canal para avisar a un responsable. Agregar WhatsApp, SMS o correo es agregar otra
 * implementación; {@link NotificationRouter} elige la primera que puede llegar al contacto.
 */
public interface Notifier {

    /** Orden de preferencia: menor primero. */
    int priority();

    boolean canReach(Contact contact);

    DeliveryOutcome send(Contact contact, OutgoingAlert alert);
}
