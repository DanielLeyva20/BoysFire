import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { YearSummary } from '../../core/api/models';
import { formatIndex, formatInteger } from '../../core/domain/format';

interface YearBar {
  year: number;
  /** Altura de cada tramo en % del año con más actividad. */
  detectedHeight: number;
  backgroundHeight: number;
  description: string;
}

/** Los 26 años en una tira: la altura es la actividad del año; lo rayado es lo estimado. */
@Component({
  selector: 'app-year-strip',
  templateUrl: './year-strip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class YearStrip {
  readonly years = input.required<YearSummary[]>();
  readonly selectedYear = input.required<number>();
  readonly yearSelect = output<number>();

  protected readonly bars = computed<YearBar[]>(() => {
    const years = this.years();
    const max = Math.max(...years.map((year) => year.harmonizedIndex), 1);
    return years.map((year) => ({
      year: year.year,
      detectedHeight: (year.detectedIndex / max) * 100,
      backgroundHeight: (year.backgroundIndex / max) * 100,
      description:
        `${year.year}: índice ${formatIndex(year.harmonizedIndex)}, ` +
        `${formatInteger(year.criticalDays)} días críticos`,
    }));
  });
}
