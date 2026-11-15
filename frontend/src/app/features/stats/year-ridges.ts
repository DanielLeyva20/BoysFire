import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CalendarDay } from '../../core/api/models';
import { MONTH_ABBREVIATIONS, isoOf, leapDayIndex, yearOf } from '../../core/domain/dates';

const DAYS = 366;
const VIEW_WIDTH = 1000;
const LABEL_WIDTH = 44;
const ROW_STEP = 15;
/** Cuántas filas de alto alcanza el día más intenso: los picos se solapan con los años de arriba. */
const PEAK_ROWS = 6;
const FOOTER_HEIGHT = 22;
/** Media móvil centrada: suaviza el ruido diario sin mover la temporada. */
const SMOOTHING_DAYS = 7;

interface Ridge {
  year: number;
  path: string;
  baseline: number;
}

interface MonthTick {
  label: string;
  x: number;
}

/**
 * Los años apilados: cada año es una línea con la forma de su temporada. Un solo gráfico
 * que ocupa todo el panel, para ver de un vistazo que la temporada cae siempre en la misma
 * franja y qué años se salieron de lo habitual.
 */
@Component({
  selector: 'app-year-ridges',
  templateUrl: './year-ridges.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-x-auto' },
})
export class YearRidges {
  readonly days = input.required<CalendarDay[]>();
  readonly selectedYear = input.required<number>();
  readonly yearSelect = output<number>();

  protected readonly viewWidth = VIEW_WIDTH;
  protected readonly labelWidth = LABEL_WIDTH;

  protected readonly monthTicks: MonthTick[] = MONTH_ABBREVIATIONS.map((label, monthIndex) => ({
    label,
    x: LABEL_WIDTH + (leapDayIndex(isoOf(2000, monthIndex + 1, 1)) / DAYS) * (VIEW_WIDTH - LABEL_WIDTH),
  }));

  private readonly seriesByYear = computed(() => {
    const series = new Map<number, number[]>();
    for (const day of this.days()) {
      const year = yearOf(day.date);
      if (!series.has(year)) {
        series.set(year, new Array<number>(DAYS).fill(0));
      }
      series.get(year)![leapDayIndex(day.date)] = day.harmonizedIndex;
    }
    return new Map([...series.entries()].sort(([a], [b]) => a - b).map(([year, values]) => [year, smooth(values)]));
  });

  protected readonly topMargin = ROW_STEP * PEAK_ROWS;
  protected readonly viewHeight = computed(() => this.topMargin + this.seriesByYear().size * ROW_STEP + FOOTER_HEIGHT);
  protected readonly footerY = computed(() => this.viewHeight() - FOOTER_HEIGHT + 14);

  protected readonly ridges = computed<Ridge[]>(() => {
    const series = this.seriesByYear();
    const peak = Math.max(...[...series.values()].flat(), 1);
    const unit = (ROW_STEP * PEAK_ROWS) / peak;
    const dayWidth = (VIEW_WIDTH - LABEL_WIDTH) / (DAYS - 1);
    return [...series.entries()].map(([year, values], row) => {
      const baseline = this.topMargin + (row + 1) * ROW_STEP;
      const points = values.map((value, day) => `${(LABEL_WIDTH + day * dayWidth).toFixed(1)},${(baseline - value * unit).toFixed(1)}`);
      return { year, baseline, path: `M${LABEL_WIDTH},${baseline} L${points.join(' L')} L${VIEW_WIDTH},${baseline} Z` };
    });
  });
}

function smooth(values: readonly number[]): number[] {
  const half = Math.floor(SMOOTHING_DAYS / 2);
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - half), index + half + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}
