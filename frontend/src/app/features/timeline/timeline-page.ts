import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FireApi } from '../../core/api/fire-api';
import { CriticalPeriod, IsoDate } from '../../core/api/models';
import { formatShortDate, toDate, yearOf } from '../../core/domain/dates';
import { formatDecimal, formatIndex, formatInteger } from '../../core/domain/format';
import { SelectionStore } from '../../core/state/selection-store';
import { settled } from '../../core/state/settled';
import { Chart } from '../../shared/chart/chart';
import { dailySeriesChart, sensorJumpChart } from './timeline-charts';

const MS_PER_DAY = 86_400_000;
const LISTED_PERIODS = 15;

interface PeriodRow {
  period: CriticalPeriod;
  year: number;
  durationDays: number;
  /** Largo del bloque, en % del período más largo de la lista. */
  blockWidth: number;
}

/** La historia en el tiempo: el salto falso entre sensores, la serie diaria y los períodos críticos. */
@Component({
  selector: 'app-timeline-page',
  imports: [Chart],
  templateUrl: './timeline-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class TimelinePage {
  private readonly api = inject(FireApi);
  private readonly router = inject(Router);
  protected readonly selection = inject(SelectionStore);

  protected readonly formatIndex = formatIndex;
  protected readonly formatInteger = formatInteger;
  protected readonly formatDecimal = formatDecimal;
  protected readonly formatShortDate = formatShortDate;

  private readonly region = () => ({ regionId: this.selection.regionId() });
  protected readonly years = settled(this.api.years(this.selection.regionId));
  protected readonly days = settled(this.api.days(this.region));
  protected readonly periods = settled(this.api.criticalPeriods(this.region));

  protected readonly jumpChart = computed(() => sensorJumpChart(this.years()));
  protected readonly dailyChart = computed(() => dailySeriesChart(this.days(), this.periods()));

  /** Cuántas veces más focos crudos hay por año en la era VIIRS que en la era MODIS. */
  protected readonly rawJump = computed(() => this.selection.summary.value()?.metrics['jump.raw.viirs_era_over_modis_era']);
  protected readonly harmonizedJump = computed(
    () => this.selection.summary.value()?.metrics['jump.harmonized.viirs_era_over_modis_era'],
  );

  /** Los períodos más intensos, del mayor al menor. */
  protected readonly strongestPeriods = computed<PeriodRow[]>(() => {
    const strongest = [...this.periods()].sort((a, b) => b.totalIndex - a.totalIndex).slice(0, LISTED_PERIODS);
    const durations = strongest.map((period) => durationDays(period));
    const longest = Math.max(...durations, 1);
    return strongest.map((period, position) => ({
      period,
      year: yearOf(period.start),
      durationDays: durations[position],
      blockWidth: (durations[position] / longest) * 100,
    }));
  });

  protected openDayAt(index: number): void {
    const day = this.days()[index];
    if (day) {
      this.openOnMap(day.date);
    }
  }

  protected openOnMap(date: IsoDate): void {
    this.selection.selectDate(date);
    void this.router.navigateByUrl('/');
  }
}

function durationDays(period: CriticalPeriod): number {
  return Math.round((toDate(period.end).getTime() - toDate(period.start).getTime()) / MS_PER_DAY) + 1;
}
