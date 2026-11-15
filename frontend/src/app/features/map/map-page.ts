import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';

import { FireApi } from '../../core/api/fire-api';
import { CalendarDay, DateRange, Hotspot } from '../../core/api/models';
import { addDays, formatLongDate, formatShortDate, yearRange } from '../../core/domain/dates';
import { formatIndex, formatInteger } from '../../core/domain/format';
import { DAY_LEVEL_LABELS, HOTSPOT_LEVEL_LABELS, RELATIVE_LEVEL_LABELS } from '../../core/domain/intensity';
import { SelectionStore } from '../../core/state/selection-store';
import { settled } from '../../core/state/settled';
import { selectedRegionOutlines } from '../../core/state/region-outlines';
import { BasemapPicker } from '../../shared/basemap-picker/basemap-picker';
import { Icon } from '../../shared/icon/icon';
import { LevelLegend } from '../../shared/level-legend/level-legend';
import { RegionRanking } from '../../shared/region-ranking/region-ranking';
import { BasemapId, DEFAULT_BASEMAP } from './basemaps';
import { DaySheet } from './day-sheet';
import { FireMap, Overlay, PeakMark } from './fire-map';
import { HotspotSheet } from './hotspot-sheet';
import { PERU_BOUNDS, boundsOf, cellFeatures, centerOf, hotspotFeatures, regionFeatures } from './map-features';
import { YearPlanner } from './year-planner';
import { YearStrip } from './year-strip';

const PLAYBACK_STEP_MS = 1300;
const HOTSPOT_ZOOM = 11;
const RANKING_ROWS = 8;

/**
 * Página principal: el mapa y, a su lado, el almanaque del año. Elegir un día en el
 * almanaque lleva el mapa a ese día; elegir un foco en el mapa abre su ficha.
 */
@Component({
  selector: 'app-map-page',
  imports: [
    FireMap, YearPlanner, YearStrip, DaySheet, HotspotSheet, RegionRanking, LevelLegend, Icon, BasemapPicker,
    NgTemplateOutlet,
  ],
  templateUrl: './map-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class MapPage {
  private readonly api = inject(FireApi);
  protected readonly selection = inject(SelectionStore);
  private readonly map = viewChild.required(FireMap);
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');

  protected readonly dayLabels = DAY_LEVEL_LABELS;
  protected readonly hotspotLabels = HOTSPOT_LEVEL_LABELS;
  protected readonly relativeLabels = RELATIVE_LEVEL_LABELS;
  protected readonly rankingRows = RANKING_ROWS;
  protected readonly formatIndex = formatIndex;
  protected readonly formatInteger = formatInteger;
  protected readonly formatShortDate = formatShortDate;

  protected readonly basemapId = signal<BasemapId>(DEFAULT_BASEMAP);
  protected readonly overlay = signal<Overlay>('regions');
  protected readonly selectedHotspotId = signal<number | undefined>(undefined);
  protected readonly playing = signal(false);


  /** El día elegido o, si no hay, todo el año. Es lo que pintan el mapa y el ranking. */
  private readonly period = computed<DateRange>(() => {
    const date = this.selection.date();
    return date ? { from: date, to: date } : yearRange(this.selection.year());
  });

  // ── Datos ────────────────────────────────────────────────────────────
  private readonly daysResource = this.api.days(() => ({
    regionId: this.selection.regionId(),
    ...yearRange(this.selection.year()),
  }));
  private readonly activityResource = this.api.childrenActivity(() => ({
    parentId: this.selection.regionId(),
    ...this.period(),
  }));
  private readonly cellsResource = this.api.cells(() => (this.overlay() === 'cells' ? this.period() : undefined));
  protected readonly hotspotPage = this.api.hotspotsOn(this.selection.date);
  protected readonly children = this.api.children(this.selection.regionId);

  protected readonly days = settled(this.daysResource);
  protected readonly years = settled(this.api.years(this.selection.regionId));
  protected readonly activity = settled(this.activityResource);
  private readonly cells = settled(this.cellsResource);

  // ── Lo que dibuja el mapa ────────────────────────────────────────────
  /** Las regiones hijas; un distrito no tiene, así que se muestra su propio contorno. */
  private readonly outlines = selectedRegionOutlines();

  protected readonly regionCollection = computed(() => regionFeatures(this.outlines(), this.activity()));
  protected readonly cellCollection = computed(() => cellFeatures(this.cells()));
  protected readonly hotspotCollection = computed(() => hotspotFeatures(this.hotspotPage.value().items));
  protected readonly focus = computed(() => boundsOf(this.outlines().features) ?? PERU_BOUNDS);

  /** La imagen "NASA del día" usa el día elegido o, sin él, el día pico del año. */
  protected readonly imageryDate = computed(() => this.selection.date() ?? this.peakDay()?.date ?? `${this.selection.year()}-09-15`);

  // ── Lo que muestra el almanaque ──────────────────────────────────────
  protected readonly selectedDay = computed<CalendarDay | undefined>(() => {
    const date = this.selection.date();
    return date ? this.days().find((day) => day.date === date) : undefined;
  });

  protected readonly selectedHotspot = computed<Hotspot | undefined>(() => {
    const id = this.selectedHotspotId();
    return id === undefined ? undefined : this.hotspotPage.value().items.find((hotspot) => hotspot.id === id);
  });

  protected readonly yearSummary = computed(() => this.years().find((year) => year.year === this.selection.year()));

  protected readonly peakDay = computed<CalendarDay | undefined>(() =>
    this.days().reduce<CalendarDay | undefined>(
      (peak, day) => (!peak || day.harmonizedIndex > peak.harmonizedIndex ? day : peak),
      undefined,
    ),
  );

  protected readonly dateTitle = computed(() => {
    const date = this.selection.date();
    return date ? formatLongDate(date) : `Año ${this.selection.year()}`;
  });

  /** "el 13 de setiembre de 2024" o "en 2024", para completar frases. */
  protected readonly periodPhrase = computed(() => {
    const date = this.selection.date();
    return date ? `el ${formatLongDate(date)}` : `en ${this.selection.year()}`;
  });

  /** Dónde estuvo lo más intenso: el foco más potente del día o la región con más actividad. */
  protected readonly peakMark = computed<PeakMark | undefined>(() => {
    if (this.selection.date()) {
      const strongest = this.strongestHotspot();
      return strongest && {
        longitude: strongest.longitude,
        latitude: strongest.latitude,
        label: `Foco más intenso del día: ${formatIndex(strongest.frpMw ?? 0)} MW`,
      };
    }
    const top = this.topRegion();
    if (!top) {
      return undefined;
    }
    const [longitude, latitude] = centerOf(top.bounds);
    return { longitude, latitude, label: `Mayor actividad del año: ${top.name}` };
  });

  private readonly strongestHotspot = computed(() =>
    this.hotspotPage.value().items.reduce<Hotspot | undefined>(
      (strongest, hotspot) => (!strongest || (hotspot.frpMw ?? 0) > (strongest.frpMw ?? 0) ? hotspot : strongest),
      undefined,
    ),
  );

  private readonly topRegion = computed(() => {
    const top = this.activity()[0];
    const feature = top && this.outlines().features.find((candidate) => candidate.id === top.regionId);
    const bounds = feature && boundsOf([feature]);
    return feature && bounds ? { id: feature.id, name: feature.properties.name, bounds } : undefined;
  });

  private playbackTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // Al cambiar de día, la ficha del foco anterior ya no corresponde.
    effect(() => {
      this.selection.date();
      this.selectedHotspotId.set(undefined);
    });
    // Al elegir un foco, su ficha se lleva a la vista (puede quedar bajo el planificador).
    effect(() => {
      if (this.selectedHotspot()) {
        this.sheet().nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
    inject(DestroyRef).onDestroy(() => this.stopPlayback());
  }


  protected stepYear(delta: number): void {
    this.selection.selectYear(this.selection.year() + delta);
  }

  protected stepDay(delta: number): void {
    const date = this.selection.date();
    if (date) {
      this.selection.selectDate(addDays(date, delta));
    }
  }

  protected zoomToHotspot(): void {
    const hotspot = this.selectedHotspot();
    if (hotspot) {
      this.map().flyTo(hotspot.longitude, hotspot.latitude, HOTSPOT_ZOOM);
    }
  }

  protected onPeakClick(): void {
    const strongest = this.selection.date() ? this.strongestHotspot() : undefined;
    if (strongest) {
      this.selectedHotspotId.set(strongest.id);
      this.map().flyTo(strongest.longitude, strongest.latitude, HOTSPOT_ZOOM);
      return;
    }
    const top = this.topRegion();
    if (top) {
      this.selection.selectRegion(top.id);
    }
  }

  /** Reproduce el año día a día desde el día elegido (o desde el 1 de enero). */
  protected togglePlayback(): void {
    if (this.playing()) {
      this.stopPlayback();
      return;
    }
    const year = this.selection.year();
    this.selection.selectDate(this.selection.date() ?? `${year}-01-01`);
    this.playing.set(true);
    this.playbackTimer = setInterval(() => {
      const next = addDays(this.selection.date()!, 1);
      if (!next.startsWith(String(year)) || next > (this.selection.summary.value()?.lastDate ?? next)) {
        this.stopPlayback();
        return;
      }
      this.selection.selectDate(next);
    }, PLAYBACK_STEP_MS);
  }

  private stopPlayback(): void {
    clearInterval(this.playbackTimer);
    this.playing.set(false);
  }
}
