package pe.boysfire.api.contact;

/**
 * Responsable o autoridad de una localidad, a quien se envían las alertas de su zona.
 *
 * @param telegramChatId {@code null} hasta que la persona enlaza su Telegram con el código
 * @param linkCode       código que la persona envía al bot para enlazarse
 */
public record Contact(
        int id,
        int regionId,
        String fullName,
        String roleName,
        ContactKind kind,
        String phone,
        Long telegramChatId,
        String linkCode,
        boolean active) {

    public boolean hasTelegram() {
        return telegramChatId != null;
    }
}
