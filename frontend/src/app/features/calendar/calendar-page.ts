import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FireApi } from '../../core/api/fire-api';
import { IsoDate } from '../../core/api/models';
import { formatShortDate, yearOf } from '../../core/domain/dates';
import { formatIndex, formatInteger } from '../../core/domain/format';
import { DAY_LEVEL_LABELS } from '../../core/domain/intensity';
import { SelectionStore } from '../../core/state/selection-store';
import { settled } from '../../core/state/settled';
import { LevelLegend } from '../../shared/level-legend/level-legend';
import { extremesByMonth, extremesByYear } from './calendar-stats';
import { YearMatrix } from './year-matrix';

/** Todos los años de la región a la vez, y los extremos de cada año y de cada mes. */
@Component({
  selector: 'app-calendar-page',
  imports: [YearMatrix, LevelLegend],
  templateUrl: './calendar-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CalendarPage {
  private readonly api = inject(FireApi);
  private readonly router = inject(Router);
  protected readonly selection = inject(SelectionStore);

  protected readonly dayLabels = DAY_LEVEL_LABELS;
  protected readonly formatIndex = formatIndex;
  protected readonly formatInteger = formatInteger;
  protected readonly formatShortDate = formatShortDate;

  private readonly daysResource = this.api.days(() => ({ regionId: this.selection.regionId() }));
  protected readonly days = settled(this.daysResource);
  protected readonly loading = this.daysResource.isLoading;

  /** Del año más reciente al más antiguo: lo último es lo que más se consulta. */
  protected readonly years = computed(() => extremesByYear(this.days()).reverse());
  protected readonly months = computed(() =>
    extremesByMonth(this.days().filter((day) => yearOf(day.date) === this.selection.year())),
  );

  /** Abre el día en el mapa, con sus focos. */
  protected openOnMap(date: IsoDate): void {
    this.selection.selectDate(date);
    void this.router.navigateByUrl('/');
  }
}
