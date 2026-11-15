package pe.boysfire.api.common.query;

import pe.boysfire.api.common.error.InvalidRequestException;

/** Rectángulo geográfico en grados. */
public record BoundingBox(double minLongitude, double minLatitude, double maxLongitude, double maxLatitude) {

    private static final String FORMAT = "minLon,minLat,maxLon,maxLat";

    public BoundingBox {
        if (minLongitude >= maxLongitude || minLatitude >= maxLatitude) {
            throw new InvalidRequestException("El 'bbox' debe cumplir minLon < maxLon y minLat < maxLat (" + FORMAT + ").");
        }
        if (minLongitude < -180 || maxLongitude > 180 || minLatitude < -90 || maxLatitude > 90) {
            throw new InvalidRequestException("El 'bbox' está fuera del rango válido de coordenadas.");
        }
    }

    /** Lee el formato de la URL: {@code minLon,minLat,maxLon,maxLat}. */
    public static BoundingBox parse(String text) {
        String[] parts = text.split(",");
        if (parts.length != 4) {
            throw new InvalidRequestException("El 'bbox' debe tener cuatro números: " + FORMAT + ".");
        }
        try {
            return new BoundingBox(
                    Double.parseDouble(parts[0].trim()),
                    Double.parseDouble(parts[1].trim()),
                    Double.parseDouble(parts[2].trim()),
                    Double.parseDouble(parts[3].trim()));
        } catch (NumberFormatException exception) {
            throw new InvalidRequestException("El 'bbox' debe tener cuatro números: " + FORMAT + ".");
        }
    }
}
