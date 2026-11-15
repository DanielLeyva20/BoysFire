package pe.boysfire.api.region;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Todas las regiones en memoria (son unas dos mil y casi nunca cambian), indexadas para
 * resolver hijos, ancestros y búsquedas por nombre sin ir a la base de datos.
 */
public final class RegionCatalog {

    private static final Comparator<Region> BY_NAME = Comparator.comparing(Region::name);

    private final Map<Integer, Region> byId;
    private final Map<Integer, List<Region>> childrenByParent;
    private final Map<RegionLevel, List<Region>> byLevel;

    public RegionCatalog(List<Region> regions) {
        this.byId = regions.stream().collect(Collectors.toUnmodifiableMap(Region::id, Function.identity()));
        this.childrenByParent = regions.stream()
                .filter(region -> region.parentId() != null)
                .sorted(BY_NAME)
                .collect(Collectors.groupingBy(Region::parentId));
        this.byLevel = regions.stream().sorted(BY_NAME).collect(Collectors.groupingBy(Region::level));
    }

    public Optional<Region> find(int id) {
        return Optional.ofNullable(byId.get(id));
    }

    public List<Region> childrenOf(int parentId) {
        return childrenByParent.getOrDefault(parentId, List.of());
    }

    public List<Region> ofLevel(RegionLevel level) {
        return byLevel.getOrDefault(level, List.of());
    }

    /** Ancestros del país hacia abajo, sin incluir la propia región. */
    public List<Region> ancestorsOf(Region region) {
        List<Region> ancestors = new ArrayList<>();
        Region current = region;
        while (current.parentId() != null) {
            current = byId.get(current.parentId());
            ancestors.addFirst(current);
        }
        return List.copyOf(ancestors);
    }

    public RegionDetail detailOf(Region region) {
        List<Region> ancestors = ancestorsOf(region);
        return new RegionDetail(region, ancestors, pathOf(region, ancestors));
    }

    /**
     * Regiones cuyo nombre contiene el texto, sin distinguir mayúsculas ni tildes.
     * Primero las que empiezan por el texto; a igualdad, la región más amplia.
     */
    public List<RegionDetail> search(String text, int maxResults) {
        String wanted = normalize(text);
        if (wanted.isEmpty()) {
            return List.of();
        }
        return byId.values().stream()
                .filter(region -> normalize(region.name()).contains(wanted))
                .sorted(Comparator
                        .comparing((Region region) -> !normalize(region.name()).startsWith(wanted))
                        .thenComparing(Region::level)
                        .thenComparing(BY_NAME))
                .limit(maxResults)
                .map(this::detailOf)
                .toList();
    }

    /** "San Vicente de Cañete, Cañete, Lima": de la región hacia arriba, sin el país. */
    private static String pathOf(Region region, List<Region> ancestors) {
        List<String> names = new ArrayList<>();
        names.add(region.name());
        ancestors.reversed().stream()
                .filter(ancestor -> ancestor.level() != RegionLevel.COUNTRY)
                .map(Region::name)
                .forEach(names::add);
        return String.join(", ", names);
    }

    private static String normalize(String text) {
        String withoutMarks = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return withoutMarks.toLowerCase(Locale.ROOT).strip();
    }
}
