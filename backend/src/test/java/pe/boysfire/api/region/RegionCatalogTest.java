package pe.boysfire.api.region;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class RegionCatalogTest {

    private static final Region PERU = new Region(1, "PE", "Perú", RegionLevel.COUNTRY, null);
    private static final Region LIMA = new Region(2, "15", "Lima", RegionLevel.DEPARTMENT, 1);
    private static final Region ICA = new Region(3, "11", "Ica", RegionLevel.DEPARTMENT, 1);
    private static final Region CANETE = new Region(4, "1505", "Cañete", RegionLevel.PROVINCE, 2);
    private static final Region SAN_VICENTE = new Region(5, "150501", "San Vicente de Cañete", RegionLevel.DISTRICT, 4);

    private final RegionCatalog catalog = new RegionCatalog(List.of(PERU, LIMA, ICA, CANETE, SAN_VICENTE));

    @Test
    void childrenComeSortedByName() {
        assertThat(catalog.childrenOf(PERU.id())).containsExactly(ICA, LIMA);
        assertThat(catalog.childrenOf(SAN_VICENTE.id())).isEmpty();
    }

    @Test
    void ancestorsGoFromTheCountryDown() {
        assertThat(catalog.ancestorsOf(SAN_VICENTE)).containsExactly(PERU, LIMA, CANETE);
        assertThat(catalog.ancestorsOf(PERU)).isEmpty();
    }

    @Test
    void detailBuildsAReadablePathWithoutTheCountry() {
        assertThat(catalog.detailOf(SAN_VICENTE).path()).isEqualTo("San Vicente de Cañete, Cañete, Lima");
        assertThat(catalog.detailOf(PERU).path()).isEqualTo("Perú");
    }

    @Test
    void searchIgnoresCaseAndAccentsAndPutsPrefixMatchesFirst() {
        List<RegionDetail> found = catalog.search("canete", 10);

        assertThat(found).extracting(RegionDetail::region).containsExactly(CANETE, SAN_VICENTE);
    }

    @Test
    void searchRespectsTheLimitAndIgnoresBlankText() {
        assertThat(catalog.search("a", 2)).hasSize(2);
        assertThat(catalog.search("   ", 10)).isEmpty();
    }
}
