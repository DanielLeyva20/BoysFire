package pe.boysfire.api.calendar;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * En todos los endpoints: sin {@code regionId} se responde para el país, y sin {@code from}
 * o {@code to} se usa el inicio o el fin de la serie.
 */
@Tag(name = "Calendario", description = "Actividad diaria armonizada, días críticos y climatología por región")
@RestController
@RequestMapping("/api/calendar")
class CalendarController {

    private final CalendarService service;

    CalendarController(CalendarService service) {
        this.service = service;
    }

    @Operation(summary = "Serie diaria armonizada de una región: un valor por cada día observado")
    @GetMapping("/days")
    List<CalendarDay> days(
            @RequestParam(required = false) Integer regionId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return service.days(regionId, from, to);
    }

    @Operation(summary = "Resumen por año: serie armonizada junto a los focos crudos de MODIS y VIIRS")
    @GetMapping("/years")
    List<YearSummary> years(@RequestParam(required = false) Integer regionId) {
        return service.years(regionId);
    }

    @Operation(summary = "Focos observados por día y sensor, sin armonizar")
    @GetMapping("/sensor-days")
    List<SensorDay> sensorDays(
            @RequestParam(required = false) Integer regionId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return service.sensorDays(regionId, from, to);
    }

    @Operation(summary = "Lo normal para cada día del año y el umbral de día crítico")
    @GetMapping("/climatology")
    List<ClimatologyDay> climatology(@RequestParam(required = false) Integer regionId) {
        return service.climatology(regionId);
    }

    @Operation(summary = "Actividad de cada región hija en un rango de fechas, de mayor a menor, con su día pico")
    @GetMapping("/children")
    List<RegionActivity> childrenActivity(
            @RequestParam(required = false) Integer parentId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return service.childrenActivity(parentId, from, to);
    }

    @Operation(summary = "Períodos críticos: rachas de días por encima de su umbral")
    @GetMapping("/critical-periods")
    List<CriticalPeriod> criticalPeriods(
            @RequestParam(required = false) Integer regionId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "3") @Min(1) int minCriticalDays,
            @RequestParam(defaultValue = "1") @Min(0) int maxGapDays) {
        return service.criticalPeriods(regionId, from, to, minCriticalDays, maxGapDays);
    }
}
