package pe.boysfire.api.risk;

import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import pe.boysfire.api.risk.RiskQueryRepository.Recommendation;

/**
 * Catálogo de recomendaciones (tabla {@code ref.recommendation}), en caché: cambia solo con
 * una migración. Las recomendaciones de cada factor activo y las de cada nivel se combinan en
 * {@link RiskService#recommendationsFor}.
 */
@Component
class RecommendationCatalog {

    private final RiskQueryRepository repository;

    RecommendationCatalog(RiskQueryRepository repository) {
        this.repository = repository;
    }

    @Cacheable("recommendations")
    public List<Recommendation> all() {
        return repository.findRecommendations();
    }
}
