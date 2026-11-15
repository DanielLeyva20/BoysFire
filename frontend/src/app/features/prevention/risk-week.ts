import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IsoDate } from '../../core/api/models';
import { DayRisk } from '../../core/api/risk-models';
import { dayOf, formatLongDate, toDate } from '../../core/domain/dates';
import { RISK_LABELS, RISK_TO_LEVEL } from '../../core/domain/risk';

const WEEKDAY = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'UTC' });

interface WeekDay {
  date: IsoDate;
  weekday: string;
  dayOfMonth: number;
  level: string;
  description: string;
}

/** Los próximos siete días: un bloque por día con el color de su riesgo. */
@Component({
  selector: 'app-risk-week',
  templateUrl: './risk-week.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RiskWeek {
  readonly days = input.required<DayRisk[]>();
  readonly selectedDate = input.required<IsoDate | undefined>();
  readonly dateSelect = output<IsoDate>();

  protected readonly week = computed<WeekDay[]>(() =>
    this.days().map((day, position) => ({
      date: day.date,
      weekday: position === 0 ? 'Hoy' : WEEKDAY.format(toDate(day.date)).replace('.', ''),
      dayOfMonth: dayOf(day.date),
      level: RISK_TO_LEVEL[day.level],
      description: `${formatLongDate(day.date)}: riesgo ${RISK_LABELS[day.level].toLowerCase()}, ${day.score} puntos`,
    })),
  );
}
