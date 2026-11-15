import { CalendarDay } from '../../core/api/models';
import { MONTH_NAMES, monthOf, yearOf } from '../../core/domain/dates';

/** Extremos de un grupo de días (un año o un mes). */
export interface PeriodExtremes {
  label: string;
  /** Año o número de mes, según el grupo. */
  key: number;
  totalIndex: number;
  observedDays: number;
  criticalDays: number;
  quietDays: number;
  peak: CalendarDay;
  lowest: CalendarDay;
}

export interface YearExtremes extends PeriodExtremes {
  busiestMonth: string;
  calmestMonth: string;
}

/** Por debajo de esto el día cuenta como "sin actividad". */
const QUIET_INDEX = 0.5;

export function extremesByYear(days: readonly CalendarDay[]): YearExtremes[] {
  return groupBy(days, (day) => yearOf(day.date)).map(([year, yearDays]) => {
    const months = extremesByMonth(yearDays);
    const byTotal = [...months].sort((a, b) => b.totalIndex - a.totalIndex);
    return {
      ...summarize(String(year), year, yearDays),
      busiestMonth: byTotal[0].label,
      calmestMonth: byTotal[byTotal.length - 1].label,
    };
  });
}

export function extremesByMonth(days: readonly CalendarDay[]): PeriodExtremes[] {
  return groupBy(days, (day) => monthOf(day.date)).map(([month, monthDays]) =>
    summarize(MONTH_NAMES[month - 1], month, monthDays),
  );
}

function summarize(label: string, key: number, days: readonly CalendarDay[]): PeriodExtremes {
  let peak = days[0];
  let lowest = days[0];
  let totalIndex = 0;
  let criticalDays = 0;
  let quietDays = 0;
  for (const day of days) {
    totalIndex += day.harmonizedIndex;
    criticalDays += day.critical ? 1 : 0;
    quietDays += day.harmonizedIndex < QUIET_INDEX ? 1 : 0;
    // Ante un empate se conserva el día más antiguo.
    if (day.harmonizedIndex > peak.harmonizedIndex) {
      peak = day;
    }
    if (day.harmonizedIndex < lowest.harmonizedIndex) {
      lowest = day;
    }
  }
  return { label, key, totalIndex, observedDays: days.length, criticalDays, quietDays, peak, lowest };
}

/** Agrupa conservando el orden de aparición de las claves. */
function groupBy<T>(items: readonly T[], keyOf: (item: T) => number): [number, T[]][] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return [...groups.entries()];
}
