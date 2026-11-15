package pe.boysfire.api.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Portada de la documentación interactiva (/swagger-ui.html). */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI apiDescription() {
        return new OpenAPI().info(new Info()
                .title("BoysFire API")
                .version("0.1.0")
                .description("""
                        Calendario unificado de incendios de Perú a partir de los focos de calor de MODIS y VIIRS \
                        (NASA FIRMS), armonizados en una sola serie comparable desde el año 2000.

                        El índice armonizado se expresa en "celdas activas equivalentes de VIIRS S-NPP" y tiene dos \
                        partes: lo detectado y un fondo estimado (fuego pequeño que el sensor de ese día no ve)."""));
    }
}
