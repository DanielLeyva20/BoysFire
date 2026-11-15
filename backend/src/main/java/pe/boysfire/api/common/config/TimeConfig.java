package pe.boysfire.api.common.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Reloj de la aplicación en hora de Perú. Todo "hoy" sale de aquí; inyectarlo permite fijar
 * la hora en las pruebas.
 */
@Configuration
public class TimeConfig {

    public static final ZoneId PERU = ZoneId.of("America/Lima");

    @Bean
    Clock clock() {
        return Clock.system(PERU);
    }
}
