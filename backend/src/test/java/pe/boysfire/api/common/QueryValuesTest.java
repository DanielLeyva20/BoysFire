package pe.boysfire.api.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import pe.boysfire.api.common.error.InvalidRequestException;
import pe.boysfire.api.common.geo.GeoJsonGeometry;
import pe.boysfire.api.common.geo.WktToGeoJson;
import pe.boysfire.api.common.query.BoundingBox;
import pe.boysfire.api.common.query.DateRange;

class QueryValuesTest {

    @Test
    void boundingBoxParsesTheUrlFormat() {
        assertThat(BoundingBox.parse("-77, -13.5, -75.5, -12")).isEqualTo(new BoundingBox(-77, -13.5, -75.5, -12));
    }

    @Test
    void boundingBoxRejectsMalformedOrInvertedValues() {
        assertThatThrownBy(() -> BoundingBox.parse("-77,-13.5,-75.5")).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> BoundingBox.parse("a,b,c,d")).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> BoundingBox.parse("-75,-13,-77,-12")).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> BoundingBox.parse("-77,-95,-75,-12")).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void dateRangeCountsBothEndsAndEnforcesItsMaximum() {
        DateRange september = new DateRange(LocalDate.of(2024, 9, 1), LocalDate.of(2024, 9, 30));

        assertThat(september.days()).isEqualTo(30);
        assertThat(september.requireAtMost(30)).isSameAs(september);
        assertThatThrownBy(() -> september.requireAtMost(29)).isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void dateRangeRejectsAnInvertedRange() {
        assertThatThrownBy(() -> new DateRange(LocalDate.of(2024, 9, 2), LocalDate.of(2024, 9, 1)))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void wktPolygonBecomesGeoJsonWithExteriorRingFirst() {
        GeoJsonGeometry geometry = WktToGeoJson.convert(
                "POLYGON ((0 0, 4 0, 4 4, 0 4, 0 0), (1 1, 1 2, 2 2, 2 1, 1 1))");

        assertThat(geometry.type()).isEqualTo("Polygon");
        List<?> rings = (List<?>) geometry.coordinates();
        assertThat(rings).hasSize(2);
        assertThat((List<?>) rings.getFirst()).hasSize(5);
        assertThat((double[]) ((List<?>) rings.getFirst()).get(1)).containsExactly(4, 0);
    }

    @Test
    void wktMultiPolygonKeepsEveryPart() {
        GeoJsonGeometry geometry = WktToGeoJson.convert(
                "MULTIPOLYGON (((0 0, 1 0, 1 1, 0 0)), ((5 5, 6 5, 6 6, 5 5)))");

        assertThat(geometry.type()).isEqualTo("MultiPolygon");
        assertThat((List<?>) geometry.coordinates()).hasSize(2);
    }
}
