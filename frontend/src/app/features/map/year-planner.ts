import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CalendarDay, IsoDate } from '../../core/api/models';
import { MONTH_NAMES, WEEKDAY_INITIALS, daysInMonth, firstWeekdayOffset, formatLongDate, isoOf } from '../../core/domain/dates';
import { formatIndex } from '../../core/domain/format';
import { DAY_LEVEL_LABELS, Level, dayLevel } from '../../core/domain/intensity';

interface DayCell {
  date: IsoDate;
  dayOfMonth: number;
  /** `gap`: día sin observación de ningún satélite (o que aún no llega). */
  level: Level | 'gap';
  description: string;
}

interface MonthBlock {
  name: string;
  /** Casillas vacías antes del día 1, para que cada día caiga bajo su día de la semana. */
  leadingBlanks: number[];
  days: DayCell[];
}

/** Planificador anual: los doce meses como cuadrículas de días coloreadas por nivel. */
@Component({
  selector: 'app-year-planner',
  templateUrl: './year-planner.html',
  styleUrl: './year-planner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class YearPlanner {
  readonly year = input.required<number>();
  readonly days = input.required<CalendarDay[]>();
  readonly selectedDate = input<IsoDate | undefined>(undefined);
  readonly daySelect = output<IsoDate>();

  protected readonly weekdayInitials = WEEKDAY_INITIALS;

  protected readonly months = computed<MonthBlock[]>(() => {
    const year = this.year();
    const dayByDate = new Map(this.days().map((day) => [day.date, day]));
    return MONTH_NAMES.map((name, monthIndex) => {
      const month = monthIndex + 1;
      return {
        name,
        leadingBlanks: Array.from({ length: firstWeekdayOffset(year, month) }, (_, position) => position),
        days: Array.from({ length: daysInMonth(year, month) }, (_, dayIndex) =>
          toCell(isoOf(year, month, dayIndex + 1), dayIndex + 1, dayByDate),
        ),
      };
    });
  });
}

function toCell(date: IsoDate, dayOfMonth: number, dayByDate: Map<IsoDate, CalendarDay>): DayCell {
  const day = dayByDate.get(date);
  if (!day) {
    return { date, dayOfMonth, level: 'gap', description: `${formatLongDate(date)}: sin observación` };
  }
  const level = dayLevel(day);
  return {
    date,
    dayOfMonth,
    level,
    description: `${formatLongDate(date)}: ${DAY_LEVEL_LABELS[level].toLowerCase()}, índice ${formatIndex(day.harmonizedIndex)}`,
  };
}
