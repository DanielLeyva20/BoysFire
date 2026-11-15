package pe.boysfire.api.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import pe.boysfire.api.common.security.OperatorKeyFilter;

/** Permite que el frontend (otro origen en desarrollo) consulte la API. */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final ApiProperties properties;

    public WebConfig(ApiProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(properties.cors().allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PATCH", "DELETE")
                .allowedHeaders("Content-Type", OperatorKeyFilter.HEADER);
    }
}
