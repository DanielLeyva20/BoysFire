package pe.boysfire.api.notification;

import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Valores que una integración debe recordar entre reinicios (p. ej. el último mensaje leído). */
@Repository
class IntegrationStateRepository {

    private final JdbcClient jdbc;

    IntegrationStateRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    Optional<String> find(String key) {
        return jdbc.sql("SELECT state_value FROM ops.integration_state WHERE state_key = :key").param("key", key)
                .query(String.class).optional();
    }

    void save(String key, String value) {
        jdbc.sql("""
                MERGE ops.integration_state AS target
                USING (SELECT :key AS state_key, :value AS state_value) AS source ON target.state_key = source.state_key
                WHEN MATCHED THEN UPDATE SET state_value = source.state_value, updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (state_key, state_value) VALUES (source.state_key, source.state_value);
                """)
                .param("key", key)
                .param("value", value)
                .update();
    }
}
