import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource } from '@angular/core';

import { FireApi } from '../../core/api/fire-api';
import { Confidence, Hotspot } from '../../core/api/models';
import { formatLongDate, formatPeruTime } from '../../core/domain/dates';
import { formatCoordinates, formatDecimal, formatInteger } from '../../core/domain/format';
import { HOTSPOT_LEVEL_LABELS, hotspotLevel } from '../../core/domain/intensity';
import { Icon } from '../../shared/icon/icon';

const CONFIDENCE_LABELS: Record<Confidence, string> = { LOW: 'Baja', NOMINAL: 'Nominal', HIGH: 'Alta' };

const SATELLITE_NAMES: Record<string, string> = {
  TERRA: 'Terra',
  AQUA: 'Aqua',
  SNPP: 'Suomi NPP',
  NOAA20: 'NOAA-20',
  NOAA21: 'NOAA-21',
};

/** Ficha de un foco: dónde y a qué hora se detectó, y con qué intensidad. */
@Component({
  selector: 'app-hotspot-sheet',
  imports: [Icon],
  templateUrl: './hotspot-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class HotspotSheet {
  private readonly api = inject(FireApi);

  readonly hotspot = input.required<Hotspot>();
  readonly zoomIn = output<void>();
  readonly close = output<void>();

  /** Distrito, provincia y departamento del punto. */
  protected readonly place = resource({
    params: () => this.hotspot(),
    loader: ({ params }) => this.api.locate(params.latitude, params.longitude),
  });

  protected readonly level = computed(() => hotspotLevel(this.hotspot()));
  protected readonly levelLabel = computed(() => HOTSPOT_LEVEL_LABELS[this.level()]);
  protected readonly date = computed(() => formatLongDate(this.hotspot().localDate));
  protected readonly time = computed(() => formatPeruTime(this.hotspot().acquiredAtUtc));
  protected readonly coordinates = computed(() => formatCoordinates(this.hotspot().latitude, this.hotspot().longitude));
  protected readonly confidence = computed(() => CONFIDENCE_LABELS[this.hotspot().confidence]);
  protected readonly satellite = computed(() => {
    const hotspot = this.hotspot();
    return `${SATELLITE_NAMES[hotspot.satellite] ?? hotspot.satellite} · ${hotspot.sensor}`;
  });
  protected readonly power = computed(() => {
    const frp = this.hotspot().frpMw;
    return frp === null ? 'Sin dato' : `${formatDecimal(frp, 1)} MW`;
  });
  protected readonly footprint = computed(() => {
    const { scanKm, trackKm } = this.hotspot();
    if (scanKm === null || trackKm === null) {
      return 'Sin dato';
    }
    return `${formatInteger(scanKm * 1000)} × ${formatInteger(trackKm * 1000)} m`;
  });
}
