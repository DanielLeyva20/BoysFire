import { Injectable, computed, inject, signal } from '@angular/core';

import { FireApi } from '../api/fire-api';
import { IsoDate, Region } from '../api/models';
import { yearOf } from '../domain/dates';
import { settled } from './settled';

/** El país en la tabla de regiones. Es fijo: lo crea la migración de la base. */
const COUNTRY_REGION_ID = 1;

/**
 * Lo que el usuario tiene seleccionado. Es compartido por todas las páginas: elegir un
 * distrito en el mapa lo mantiene al pasar al calendario o a las estadísticas.
 */
@Injectable({ providedIn: 'root' })
export class SelectionStore {
  private readonly api = inject(FireApi);

  private readonly selectedRegionId = signal(COUNTRY_REGION_ID);
  private readonly selectedYear = signal<number | undefined>(undefined);
  private readonly selectedDate = signal<IsoDate | undefined>(undefined);

  readonly summary = this.api.summary();
  private readonly regionDetail = this.api.region(this.selectedRegionId);

  readonly regionId = this.selectedRegionId.asReadonly();
  readonly date = this.selectedDate.asReadonly();

  /** Región seleccionada con sus ancestros; mantiene la anterior mientras carga la nueva. */
  readonly region = settled(this.regionDetail);
  readonly regionName = computed(() => this.region()?.region.name ?? 'Perú');

  /** Del país hasta la región seleccionada: la cadena de decisiones del usuario. */
  readonly regionChain = computed<Region[]>(() => {
    const detail = this.region();
    return detail ? [...detail.ancestors, detail.region] : [];
  });

  /** Región inmediatamente superior, o undefined si ya se está en el país. */
  readonly parentRegion = computed<Region | undefined>(() => {
    const chain = this.regionChain();
    return chain.length > 1 ? chain[chain.length - 2] : undefined;
  });

  readonly firstYear = computed(() => yearOf(this.summary.value()?.firstDate ?? '2000-01-01'));
  readonly lastYear = computed(() => yearOf(this.summary.value()?.lastDate ?? `${new Date().getFullYear()}-01-01`));

  /** Sin elección explícita se muestra el último año con datos. */
  readonly year = computed(() => this.selectedYear() ?? this.lastYear());

  readonly years = computed(() => {
    const first = this.firstYear();
    return Array.from({ length: this.lastYear() - first + 1 }, (_, offset) => first + offset);
  });

  selectRegion(regionId: number): void {
    this.selectedRegionId.set(regionId);
  }

  selectCountry(): void {
    this.selectedRegionId.set(COUNTRY_REGION_ID);
  }

  /** Sube un nivel en la jerarquía. No hace nada si ya se está en el país. */
  goBack(): void {
    const parent = this.parentRegion();
    if (parent) {
      this.selectedRegionId.set(parent.id);
    }
  }

  /** Cambiar de año quita el día elegido: ese día ya no está a la vista. */
  selectYear(year: number): void {
    if (year < this.firstYear() || year > this.lastYear()) {
      return;
    }
    this.selectedYear.set(year);
    this.selectedDate.set(undefined);
  }

  /** Elegir un día también mueve el año, para que calendario y mapa sigan juntos. */
  selectDate(date: IsoDate): void {
    this.selectedYear.set(yearOf(date));
    this.selectedDate.set(date);
  }

  clearDate(): void {
    this.selectedDate.set(undefined);
  }
}
