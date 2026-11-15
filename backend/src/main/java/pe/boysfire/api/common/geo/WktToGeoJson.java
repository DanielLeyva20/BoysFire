package pe.boysfire.api.common.geo;

import java.util.ArrayList;
import java.util.List;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.LinearRing;
import org.locationtech.jts.geom.MultiPolygon;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.WKTReader;

/** Convierte el WKT que entrega SQL Server ({@code geom.STAsText()}) en geometría GeoJSON. */
public final class WktToGeoJson {

    private WktToGeoJson() {
    }

    public static GeoJsonGeometry convert(String wkt) {
        Geometry geometry = read(wkt);
        return switch (geometry) {
            case Polygon polygon -> new GeoJsonGeometry("Polygon", rings(polygon));
            case MultiPolygon multiPolygon -> new GeoJsonGeometry("MultiPolygon", polygons(multiPolygon));
            default -> throw new IllegalArgumentException("Tipo de geometría no admitido: " + geometry.getGeometryType());
        };
    }

    private static Geometry read(String wkt) {
        try {
            return new WKTReader().read(wkt);
        } catch (ParseException exception) {
            throw new IllegalArgumentException("WKT inválido", exception);
        }
    }

    private static List<List<List<double[]>>> polygons(MultiPolygon multiPolygon) {
        List<List<List<double[]>>> polygons = new ArrayList<>(multiPolygon.getNumGeometries());
        for (int index = 0; index < multiPolygon.getNumGeometries(); index++) {
            polygons.add(rings((Polygon) multiPolygon.getGeometryN(index)));
        }
        return polygons;
    }

    /** El anillo exterior primero y después los huecos, como pide GeoJSON. */
    private static List<List<double[]>> rings(Polygon polygon) {
        List<List<double[]>> rings = new ArrayList<>(1 + polygon.getNumInteriorRing());
        rings.add(positions(polygon.getExteriorRing()));
        for (int index = 0; index < polygon.getNumInteriorRing(); index++) {
            rings.add(positions(polygon.getInteriorRingN(index)));
        }
        return rings;
    }

    private static List<double[]> positions(LinearRing ring) {
        List<double[]> positions = new ArrayList<>(ring.getNumPoints());
        for (Coordinate coordinate : ring.getCoordinates()) {
            positions.add(new double[] {coordinate.getX(), coordinate.getY()});
        }
        return positions;
    }
}
