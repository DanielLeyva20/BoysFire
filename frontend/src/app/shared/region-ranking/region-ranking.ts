import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IsoDate, Region, RegionActivity } from '../../core/api/models';
import { formatShortDate, yearOf } from '../../core/domain/dates';
import { formatIndex, formatInteger } from '../../core/domain/format';

interface RankingRow {
  region: Region;
  activity: RegionActivity;
  /** Anchos de las barras, en % del valor de la primera región. */
  detectedWidth: number;
  backgroundWidth: number;
  peakLabel: string;
}

/** Regiones hermanas ordenadas por actividad, con su día pico. */
@Component({
  selector: 'app-region-ranking',
  templateUrl: './region-ranking.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RegionRanking {
  readonly regions = input.required<Region[]>();
  /** Ya ordenada de mayor a menor (así la entrega la API). */
  readonly activity = input.required<RegionActivity[]>();
  /** Máximo de filas; sin valor, todas. */
  readonly limit = input<number | undefined>(undefined);
  /** Si el período abarca varios años, el día pico se muestra con su año. */
  readonly showPeakYear = input(false);

  readonly regionSelect = output<number>();
  readonly peakSelect = output<IsoDate>();

  protected readonly formatIndex = formatIndex;
  protected readonly formatInteger = formatInteger;

  protected readonly rows = computed<RankingRow[]>(() => {
    const regionById = new Map(this.regions().map((region) => [region.id, region]));
    const ranked = this.activity().filter((entry) => regionById.has(entry.regionId));
    const top = ranked[0]?.harmonizedIndex || 1;
    return ranked.slice(0, this.limit()).map((activity) => ({
      region: regionById.get(activity.regionId)!,
      activity,
      detectedWidth: (activity.detectedIndex / top) * 100,
      backgroundWidth: (activity.backgroundIndex / top) * 100,
      peakLabel: this.showPeakYear()
        ? `${formatShortDate(activity.peakDate)} ${yearOf(activity.peakDate)}`
        : formatShortDate(activity.peakDate),
    }));
  });

  protected selectPeak(event: Event, date: IsoDate): void {
    event.stopPropagation();
    this.peakSelect.emit(date);
  }
}
