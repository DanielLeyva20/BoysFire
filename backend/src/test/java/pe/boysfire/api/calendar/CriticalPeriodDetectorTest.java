package pe.boysfire.api.calendar;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CriticalPeriodDetectorTest {

    private static final LocalDate SEPTEMBER_1 = LocalDate.of(2024, 9, 1);

    private static CalendarDay day(int dayOfMonth, double index, boolean critical) {
        return new CalendarDay(SEPTEMBER_1.withDayOfMonth(dayOfMonth), index, index, 0, 100.0, 500.0, critical, "SNPP");
    }

    @Test
    void consecutiveCriticalDaysFormOnePeriodWithItsPeak() {
        List<CalendarDay> days = List.of(
                day(1, 100, false), day(2, 600, true), day(3, 900, true), day(4, 700, true), day(5, 100, false));

        List<CriticalPeriod> periods = CriticalPeriodDetector.detect(days, 3, 1);

        assertThat(periods).containsExactly(new CriticalPeriod(
                SEPTEMBER_1.withDayOfMonth(2), SEPTEMBER_1.withDayOfMonth(4), 3, SEPTEMBER_1.withDayOfMonth(3), 900, 2200));
    }

    @Test
    void shortPauseDoesNotSplitThePeriodAndItsIndexCounts() {
        List<CalendarDay> days = List.of(day(2, 600, true), day(3, 200, false), day(4, 700, true), day(5, 800, true));

        List<CriticalPeriod> periods = CriticalPeriodDetector.detect(days, 3, 1);

        assertThat(periods).hasSize(1);
        assertThat(periods.getFirst().criticalDays()).isEqualTo(3);
        assertThat(periods.getFirst().totalIndex()).isEqualTo(2300);
    }

    @Test
    void longPauseSplitsIntoSeparatePeriods() {
        List<CalendarDay> days = List.of(
                day(1, 600, true), day(2, 700, true),
                day(3, 100, false), day(4, 100, false),
                day(5, 800, true), day(6, 900, true));

        List<CriticalPeriod> periods = CriticalPeriodDetector.detect(days, 2, 1);

        assertThat(periods).extracting(CriticalPeriod::start)
                .containsExactly(SEPTEMBER_1.withDayOfMonth(1), SEPTEMBER_1.withDayOfMonth(5));
        assertThat(periods.getFirst().totalIndex()).isEqualTo(1300);      // la pausa final no suma
    }

    @Test
    void daysWithoutObservationAlsoBreakThePeriod() {
        List<CalendarDay> days = List.of(day(1, 600, true), day(2, 700, true), day(9, 800, true), day(10, 900, true));

        assertThat(CriticalPeriodDetector.detect(days, 2, 1)).hasSize(2);
    }

    @Test
    void runsShorterThanTheMinimumAreIgnored() {
        List<CalendarDay> days = List.of(day(1, 600, true), day(2, 100, false), day(3, 100, false), day(4, 100, false));

        assertThat(CriticalPeriodDetector.detect(days, 2, 1)).isEmpty();
    }
}
