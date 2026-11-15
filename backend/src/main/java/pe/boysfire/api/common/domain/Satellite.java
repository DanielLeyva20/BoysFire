package pe.boysfire.api.common.domain;

import java.util.Arrays;
import java.util.List;

/** Satélites con datos. Los identificadores son los de la tabla {@code ref.satellite}. */
public enum Satellite {
    TERRA(1, Sensor.MODIS),
    AQUA(2, Sensor.MODIS),
    SNPP(3, Sensor.VIIRS),
    NOAA20(4, Sensor.VIIRS),
    NOAA21(5, Sensor.VIIRS);

    private final int id;
    private final Sensor sensor;

    Satellite(int id, Sensor sensor) {
        this.id = id;
        this.sensor = sensor;
    }

    public int id() {
        return id;
    }

    public Sensor sensor() {
        return sensor;
    }

    public static Satellite fromId(int id) {
        return Arrays.stream(values())
                .filter(satellite -> satellite.id == id)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Satélite desconocido: " + id));
    }

    public static List<Integer> idsOf(Sensor sensor) {
        return Arrays.stream(values())
                .filter(satellite -> satellite.sensor == sensor)
                .map(Satellite::id)
                .toList();
    }

    public static List<Integer> allIds() {
        return Arrays.stream(values()).map(Satellite::id).toList();
    }
}
