package pe.boysfire.api.calendar;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Agrupa los días críticos en períodos. Dos días críticos pertenecen al mismo período si
 * entre ellos no hay más de {@code maxGapDays} días que no lo son: una racha no se parte
 * por una pausa breve (un día nublado o algo menos intenso).
 */
final class CriticalPeriodDetector {

    private CriticalPeriodDetector() {
    }

    /**
     * @param days            días en orden cronológico
     * @param minCriticalDays días críticos mínimos para que la racha cuente como período
     * @param maxGapDays      días no críticos que se toleran dentro de un período
     */
    static List<CriticalPeriod> detect(List<CalendarDay> days, int minCriticalDays, int maxGapDays) {
        List<CriticalPeriod> periods = new ArrayList<>();
        Run run = null;
        for (CalendarDay day : days) {
            if (run != null && run.isBrokenBy(day.date(), maxGapDays)) {
                run.closeInto(periods, minCriticalDays);
                run = null;
            }
            if (day.critical()) {
                if (run == null) {
                    run = new Run();
                }
                run.addCritical(day);
            } else if (run != null) {
                run.addPause(day);
            }
        }
        if (run != null) {
            run.closeInto(periods, minCriticalDays);
        }
        return periods;
    }

    /** Racha abierta. Las pausas se guardan aparte: solo cuentan si después llega otro día crítico. */
    private static final class Run {
        private LocalDate start;
        private LocalDate lastCritical;
        private LocalDate peakDate;
        private double peakIndex;
        private double totalIndex;
        private double pendingPauseIndex;
        private int criticalDays;

        boolean isBrokenBy(LocalDate date, int maxGapDays) {
            return ChronoUnit.DAYS.between(lastCritical, date) - 1 > maxGapDays;
        }

        void addCritical(CalendarDay day) {
            if (start == null) {
                start = day.date();
            }
            totalIndex += pendingPauseIndex + day.harmonizedIndex();
            pendingPauseIndex = 0;
            lastCritical = day.date();
            criticalDays++;
            if (peakDate == null || day.harmonizedIndex() > peakIndex) {
                peakDate = day.date();
                peakIndex = day.harmonizedIndex();
            }
        }

        void addPause(CalendarDay day) {
            pendingPauseIndex += day.harmonizedIndex();
        }

        void closeInto(List<CriticalPeriod> periods, int minCriticalDays) {
            if (criticalDays >= minCriticalDays) {
                periods.add(new CriticalPeriod(
                        start, lastCritical, criticalDays, peakDate, peakIndex, roundToIndexPrecision(totalIndex)));
            }
        }

        /** El índice se guarda con 4 decimales; la suma no debe aparentar más precisión. */
        private static double roundToIndexPrecision(double value) {
            return Math.round(value * 10_000.0) / 10_000.0;
        }
    }
}
