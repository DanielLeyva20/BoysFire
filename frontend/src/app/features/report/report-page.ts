import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FeatureCollection } from 'geojson';

import { ApiError, OpsApi } from '../../core/api/ops-api';
import { ReportReceipt, ReportType } from '../../core/api/ops-models';
import { formatCoordinates, formatDecimal } from '../../core/domain/format';
import { BasemapPicker } from '../../shared/basemap-picker/basemap-picker';
import { Icon } from '../../shared/icon/icon';
import { BasemapId } from '../map/basemaps';
import { FireMap, PeakMark } from '../map/fire-map';
import { PERU_BOUNDS } from '../map/map-features';

interface Point {
  latitude: number;
  longitude: number;
}

interface TypeOption {
  value: ReportType;
  label: string;
  hint: string;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const LOCATED_ZOOM = 13;
const DESCRIPTION_MAX = 500;

/**
 * Formulario público para que cualquier persona reporte humo o fuego. Solo pide qué vio y
 * dónde; el resto es opcional. El reporte se contrasta con los satélites y llega a los
 * responsables de la zona.
 */
@Component({
  selector: 'app-report-page',
  imports: [FireMap, BasemapPicker, Icon, RouterLink],
  templateUrl: './report-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ReportPage {
  private readonly api = inject(OpsApi);
  private readonly map = viewChild.required(FireMap);

  protected readonly types: TypeOption[] = [
    { value: 'SMOKE', label: 'Humo', hint: 'Columna de humo sin llamas a la vista' },
    { value: 'VISIBLE_FIRE', label: 'Fuego visible', hint: 'Se ven llamas' },
    { value: 'AGRICULTURAL_BURN', label: 'Quema agrícola', hint: 'Quema de rastrojos o pastos' },
    { value: 'OTHER', label: 'Otro', hint: 'Algo que preocupa, sin humo ni fuego' },
  ];
  protected readonly empty = EMPTY;
  protected readonly peruBounds = PERU_BOUNDS;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  protected readonly basemapId = signal<BasemapId>('streets');
  protected readonly type = signal<ReportType | null>(null);
  protected readonly point = signal<Point | null>(null);
  protected readonly description = signal('');
  protected readonly reporterName = signal('');
  protected readonly reporterContact = signal('');

  protected readonly submitting = signal(false);
  protected readonly locating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly receipt = signal<ReportReceipt | null>(null);

  protected readonly marker = computed<PeakMark | undefined>(() => {
    const point = this.point();
    return point ? { ...point, label: 'Lugar del reporte' } : undefined;
  });
  protected readonly pointLabel = computed(() => {
    const point = this.point();
    return point ? formatCoordinates(point.latitude, point.longitude) : null;
  });
  protected readonly canSubmit = computed(() => this.type() !== null && this.point() !== null && !this.submitting());

  protected readonly satelliteNote = computed(() => {
    const distance = this.receipt()?.nearestHotspotKm;
    if (distance === null || distance === undefined) {
      return 'Los satélites no registraron focos a menos de 11 km en los últimos días.';
    }
    return `Los satélites registraron un foco de calor a ${formatDecimal(distance, 1)} km de tu reporte.`;
  });

  protected choosePoint(point: Point): void {
    this.point.set(point);
    this.error.set(null);
  }

  /** Usa la ubicación del teléfono; la persona puede corregirla tocando el mapa. */
  protected useMyLocation(): void {
    if (!('geolocation' in navigator)) {
      this.error.set('Este navegador no permite obtener tu ubicación. Toca el mapa para marcar el lugar.');
      return;
    }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        this.choosePoint(point);
        this.map().flyTo(point.longitude, point.latitude, LOCATED_ZOOM);
      },
      () => {
        this.locating.set(false);
        this.error.set('No se pudo obtener tu ubicación. Revisa el permiso del navegador o toca el mapa para marcar el lugar.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const type = this.type();
    const point = this.point();
    if (!type || !point) {
      this.error.set(!type ? 'Elige qué viste.' : 'Marca en el mapa dónde lo viste.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      this.receipt.set(await this.api.submitReport({
        type,
        ...point,
        description: this.description().trim() || undefined,
        reporterName: this.reporterName().trim() || undefined,
        reporterContact: this.reporterContact().trim() || undefined,
      }));
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected startOver(): void {
    this.receipt.set(null);
    this.type.set(null);
    this.point.set(null);
    this.description.set('');
  }
}
