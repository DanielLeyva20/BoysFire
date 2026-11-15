import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import type { FeatureCollection } from 'geojson';
import { RouterLink } from '@angular/router';

import { FireApi } from '../../core/api/fire-api';
import { IsoDate } from '../../core/api/models';
import { RiskApi } from '../../core/api/risk-api';
import { RISK_LABELS, RISK_LEGEND, RISK_TO_LEVEL } from '../../core/domain/risk';
import { selectedRegionOutlines } from '../../core/state/region-outlines';
import { SelectionStore } from '../../core/state/selection-store';
import { settled } from '../../core/state/settled';
import { BasemapPicker } from '../../shared/basemap-picker/basemap-picker';
import { LevelLegend } from '../../shared/level-legend/level-legend';
import { BasemapId } from '../map/basemaps';
import { FireMap } from '../map/fire-map';
import { PERU_BOUNDS, boundsOf, riskRegionFeatures } from '../map/map-features';
import { RiskWeek } from './risk-week';
import { ZoneRiskSheet } from './zone-risk-sheet';

/** Cada cuánto se pregunta si hay un cálculo nuevo de riesgo. */
const STATUS_POLL_MS = 120_000;
const CLOCK_TICK_MS = 30_000;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Prevención: el riesgo de hoy y de la semana en cada zona, por qué y qué hacer. Se
 * actualiza sola cuando el servidor termina un cálculo nuevo.
 *
 * Acepta `?region=62&fecha=2026-11-15`, el enlace que llevan las alertas de Telegram.
 */
@Component({
  selector: 'app-prevention-page',
  imports: [FireMap, BasemapPicker, LevelLegend, RiskWeek, ZoneRiskSheet, RouterLink],
  templateUrl: './prevention-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class PreventionPage {
  private readonly api = inject(FireApi);
  private readonly riskApi = inject(RiskApi);
  protected readonly selection = inject(SelectionStore);

  /** Parámetros de la URL. */
  readonly region = input<string>();
  readonly fecha = input<string>();

  protected readonly riskLegend = RISK_LEGEND;
  protected readonly riskLabels = RISK_LABELS;
  protected readonly riskToLevel = RISK_TO_LEVEL;
  protected readonly empty = EMPTY;

  protected readonly basemapId = signal<BasemapId>('relief');
  /** El día elegido de la semana; vuelve a hoy al cambiar de región. */
  protected readonly date = linkedSignal<number, IsoDate | undefined>({
    source: this.selection.regionId,
    computation: () => undefined,
  });

  protected readonly status = this.riskApi.status();
  private readonly zoneResource = this.riskApi.zone(() => ({ regionId: this.selection.regionId(), date: this.date() }));
  private readonly childrenResource = this.riskApi.children(() => ({ parentId: this.selection.regionId(), date: this.date() }));
  private readonly forecastResource = this.riskApi.forecast(this.selection.regionId);
  protected readonly childRegions = this.api.children(this.selection.regionId);

  protected readonly zone = settled(this.zoneResource);
  protected readonly zoneError = computed(() => this.zoneResource.error());
  protected readonly childRisks = settled(this.childrenResource);
  protected readonly forecast = settled(this.forecastResource);
  private readonly outlines = selectedRegionOutlines();

  protected readonly regionCollection = computed(() => riskRegionFeatures(this.outlines(), this.childRisks()));
  protected readonly focus = computed(() => boundsOf(this.outlines().features) ?? PERU_BOUNDS);
  protected readonly selectedDate = computed(() => this.date() ?? this.forecast()[0]?.date);
  protected readonly imageryDate = computed(() => this.selectedDate() ?? new Date().toISOString().slice(0, 10));

  /** Zonas hijas ordenadas de mayor a menor riesgo, con su nombre. */
  protected readonly ranking = computed(() => {
    const names = new Map(this.childRegions.value().map((region) => [region.id, region.name]));
    return this.childRisks()
      .filter((risk) => names.has(risk.regionId))
      .map((risk) => ({ ...risk, name: names.get(risk.regionId)!, level_: RISK_TO_LEVEL[risk.level] }));
  });

  private readonly now = signal(Date.now());
  protected readonly updatedAgo = computed(() => {
    const last = this.status.value()?.lastSuccessAtUtc;
    if (!last) {
      return null;
    }
    const minutes = Math.max(0, Math.round((this.now() - new Date(`${last}Z`).getTime()) / 60_000));
    return minutes < 1 ? 'hace un momento' : minutes < 60 ? `hace ${minutes} min` : `hace ${Math.round(minutes / 60)} h`;
  });

  constructor() {
    this.followUrl();
    this.keepFresh();
  }

  protected chooseDate(date: IsoDate): void {
    this.date.set(date === this.forecast()[0]?.date ? undefined : date);
  }

  /** Un enlace con ?region= y ?fecha= abre esa zona y ese día. */
  private followUrl(): void {
    effect(() => {
      const regionId = Number(this.region());
      if (Number.isInteger(regionId) && regionId > 0) {
        this.selection.selectRegion(regionId);
      }
    });
    effect(() => {
      const day = this.fecha();
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
        this.date.set(day);
      }
    });
  }

  /** Pregunta cada dos minutos si hubo un cálculo nuevo y, si lo hubo, recarga los datos. */
  private keepFresh(): void {
    const statusTimer = setInterval(() => this.status.reload(), STATUS_POLL_MS);
    const clockTimer = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(statusTimer);
      clearInterval(clockTimer);
    });

    let lastSeen: string | null | undefined;
    effect(() => {
      const latest = this.status.value()?.lastSuccessAtUtc;
      if (lastSeen !== undefined && latest !== lastSeen) {
        this.zoneResource.reload();
        this.childrenResource.reload();
        this.forecastResource.reload();
      }
      lastSeen = latest;
    });
  }
}
