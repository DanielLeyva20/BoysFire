import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CalendarDay, HotspotPage } from '../../core/api/models';
import { formatLongDate, formatWeekday } from '../../core/domain/dates';
import { formatIndex, formatInteger } from '../../core/domain/format';
import { DAY_LEVEL_LABELS, dayLevel } from '../../core/domain/intensity';

/** Nombre legible del grupo de satélites que alimenta el día. */
const SOURCE_NAMES: Record<string, string> = {
  SNPP: 'VIIRS S-NPP (medición directa)',
  NOAA20: 'VIIRS NOAA-20 (calibrado)',
  NOAA21: 'VIIRS NOAA-21 (calibrado)',
  MODIS: 'MODIS Terra + Aqua (calibrado)',
  AQUA: 'MODIS Aqua (calibrado)',
  TERRA: 'MODIS Terra (calibrado)',
};

/** Margen a la derecha de la regla, para que el valor mayor no toque el borde. */
const SCALE_HEADROOM = 1.12;

/** Ficha del día elegido: su índice frente a lo normal y al umbral crítico. */
@Component({
  selector: 'app-day-sheet',
  templateUrl: './day-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class DaySheet {
  readonly day = input.required<CalendarDay>();
  readonly hotspots = input.required<HotspotPage>();
  readonly hotspotsLoading = input(false);

  protected readonly formatIndex = formatIndex;
  protected readonly formatInteger = formatInteger;

  protected readonly title = computed(() => formatLongDate(this.day().date));
  protected readonly weekday = computed(() => formatWeekday(this.day().date));
  protected readonly level = computed(() => dayLevel(this.day()));
  protected readonly levelLabel = computed(() => DAY_LEVEL_LABELS[this.level()]);
  protected readonly sourceName = computed(() => SOURCE_NAMES[this.day().source] ?? this.day().source);

  /** Posiciones (0–100 %) sobre una regla que va de cero al mayor de los tres valores. */
  protected readonly scale = computed(() => {
    const day = this.day();
    const max = Math.max(day.harmonizedIndex, day.criticalThreshold ?? 0, day.expectedIndex ?? 0, 1) * SCALE_HEADROOM;
    const position = (value: number | null) => (value === null ? null : (value / max) * 100);
    return {
      detected: position(day.detectedIndex) ?? 0,
      background: position(day.backgroundIndex) ?? 0,
      expected: position(day.expectedIndex),
      threshold: position(day.criticalThreshold),
    };
  });
}
