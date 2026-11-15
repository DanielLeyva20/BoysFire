package pe.boysfire.api.calendar;

import java.time.LocalDate;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import pe.boysfire.api.common.query.DateRange;
import pe.boysfire.api.region.RegionService;

@Service
public class CalendarService {

    private final CalendarRepository repository;
    private final ObservedRangeProvider observedRange;
    private final RegionService regions;

    CalendarService(CalendarRepository repository, ObservedRangeProvider observedRange, RegionService regions) {
        this.repository = repository;
        this.observedRange = observedRange;
        this.regions = regions;
    }

    public List<CalendarDay> days(Integer regionId, LocalDate from, LocalDate to) {
        return repository.findDays(resolveRegion(regionId), resolveRange(from, to));
    }

    @Cacheable("calendarYears")
    public List<YearSummary> years(Integer regionId) {
        return repository.findYears(resolveRegion(regionId));
    }

    public List<SensorDay> sensorDays(Integer regionId, LocalDate from, LocalDate to) {
        return repository.findSensorDays(resolveRegion(regionId), resolveRange(from, to));
    }

    @Cacheable("calendarClimatology")
    public List<ClimatologyDay> climatology(Integer regionId) {
        return repository.findClimatology(resolveRegion(regionId));
    }

    /** Actividad de cada región hija (los departamentos, si no se indica región), de mayor a menor. */
    public List<RegionActivity> childrenActivity(Integer parentId, LocalDate from, LocalDate to) {
        return repository.findChildrenActivity(resolveRegion(parentId), resolveRange(from, to));
    }

    public List<CriticalPeriod> criticalPeriods(
            Integer regionId, LocalDate from, LocalDate to, int minCriticalDays, int maxGapDays) {
        return CriticalPeriodDetector.detect(days(regionId, from, to), minCriticalDays, maxGapDays);
    }

    /** Sin región se entiende el país. Falla con 404 si la región no existe. */
    private int resolveRegion(Integer regionId) {
        return regionId == null ? regions.country().id() : regions.require(regionId).id();
    }

    /** Los extremos que falten se completan con el inicio y el fin de la serie. */
    private DateRange resolveRange(LocalDate from, LocalDate to) {
        if (from != null && to != null) {
            return new DateRange(from, to);
        }
        DateRange available = observedRange.get();
        return new DateRange(from != null ? from : available.from(), to != null ? to : available.to());
    }
}
