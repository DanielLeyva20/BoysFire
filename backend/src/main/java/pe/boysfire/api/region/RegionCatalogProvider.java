package pe.boysfire.api.region;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

/**
 * Entrega el catálogo de regiones, cargado una vez y guardado en caché.
 * Está en su propio componente porque {@code @Cacheable} solo actúa en llamadas entre beans.
 */
@Component
class RegionCatalogProvider {

    private final RegionRepository repository;

    RegionCatalogProvider(RegionRepository repository) {
        this.repository = repository;
    }

    @Cacheable("regionCatalog")
    public RegionCatalog get() {
        return new RegionCatalog(repository.findAll());
    }
}
