package pe.boysfire.api.contact;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class ContactRepository {

    private static final String SELECT_CONTACT = """
            SELECT contact_id, region_id, full_name, role_name, contact_kind, phone, telegram_chat_id, link_code, is_active
            FROM ops.local_contact
            """;

    private final JdbcClient jdbc;

    ContactRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    int insert(int regionId, String fullName, String roleName, ContactKind kind, String phone, String linkCode) {
        return jdbc.sql("""
                        INSERT INTO ops.local_contact (region_id, full_name, role_name, contact_kind, phone, link_code)
                        OUTPUT INSERTED.contact_id
                        VALUES (:regionId, :fullName, :roleName, :kind, :phone, :linkCode)
                        """)
                .param("regionId", regionId)
                .param("fullName", fullName)
                .param("roleName", roleName)
                .param("kind", kind.name())
                .param("phone", phone)
                .param("linkCode", linkCode)
                .query(Integer.class)
                .single();
    }

    boolean linkCodeExists(String linkCode) {
        return jdbc.sql("SELECT COUNT(*) FROM ops.local_contact WHERE link_code = :code").param("code", linkCode)
                .query(Integer.class).single() > 0;
    }

    Optional<Contact> find(int contactId) {
        return jdbc.sql(SELECT_CONTACT + " WHERE contact_id = :id").param("id", contactId).query(ContactRepository::toContact).optional();
    }

    Optional<Contact> findByLinkCode(String linkCode) {
        return jdbc.sql(SELECT_CONTACT + " WHERE link_code = :code AND is_active = 1").param("code", linkCode)
                .query(ContactRepository::toContact).optional();
    }

    Optional<Contact> findByChatId(long chatId) {
        return jdbc.sql(SELECT_CONTACT + " WHERE telegram_chat_id = :chatId AND is_active = 1").param("chatId", chatId)
                .query(ContactRepository::toContact).optional();
    }

    List<Contact> findActive() {
        return jdbc.sql(SELECT_CONTACT + " WHERE is_active = 1 ORDER BY region_id, full_name").query(ContactRepository::toContact).list();
    }

    List<Contact> findActiveInRegions(Collection<Integer> regionIds) {
        if (regionIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT_CONTACT + " WHERE is_active = 1 AND region_id IN (:regionIds) ORDER BY contact_kind, full_name")
                .param("regionIds", regionIds)
                .query(ContactRepository::toContact)
                .list();
    }

    /** Enlaza el chat de Telegram; si ese chat estaba en otro contacto, se libera primero. */
    void linkTelegram(int contactId, long chatId) {
        jdbc.sql("UPDATE ops.local_contact SET telegram_chat_id = NULL WHERE telegram_chat_id = :chatId AND contact_id <> :id")
                .param("chatId", chatId).param("id", contactId).update();
        jdbc.sql("UPDATE ops.local_contact SET telegram_chat_id = :chatId WHERE contact_id = :id")
                .param("chatId", chatId).param("id", contactId).update();
    }

    void deactivate(int contactId) {
        jdbc.sql("UPDATE ops.local_contact SET is_active = 0, telegram_chat_id = NULL WHERE contact_id = :id")
                .param("id", contactId).update();
    }

    private static Contact toContact(ResultSet row, int rowNumber) throws SQLException {
        return new Contact(
                row.getInt("contact_id"),
                row.getInt("region_id"),
                row.getString("full_name"),
                row.getString("role_name"),
                ContactKind.valueOf(row.getString("contact_kind")),
                row.getString("phone"),
                row.getObject("telegram_chat_id", Long.class),
                row.getString("link_code"),
                row.getBoolean("is_active"));
    }
}
