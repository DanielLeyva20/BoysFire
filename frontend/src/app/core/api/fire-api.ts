import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  CalendarDay,
  ClimatologyDay,
  CriticalPeriod,
  DataSummary,
  DateRange,
  HotspotPage,
  MapCell,
  Region,
  RegionActivity,
  RegionDetail,
  RegionFeature,
  RegionFeatureCollection,
  YearSummary,
} from './models';

/** La API se sirve bajo el mismo origen (en desarrollo, por el proxy de `ng serve`). */
const API = '/api';

/** Perú con margen: los focos de un día se piden para todo el país. */
export const PERU_BBOX = '-82,-19,-68,0.5';

const EMPTY_PAGE: HotspotPage = { count: 0, truncated: false, items: [] };
const EMPTY_COLLECTION: RegionFeatureCollection = { type: 'FeatureCollection', features: [] };

type Params = Record<string, string | number | boolean>;

/**
 * Acceso a la API. Cada método de lectura devuelve un recurso reactivo: se vuelve a pedir
 * solo cuando cambian las señales que lee `query`, y no pide nada mientras devuelva
 * `undefined`. Deben llamarse al crear el componente (contexto de inyección).
 */
@Injectable({ providedIn: 'root' })
export class FireApi {
  private readonly http = inject(HttpClient);

  summary(): HttpResourceRef<DataSummary | undefined> {
    return httpResource<DataSummary>(() => `${API}/meta`);
  }

  region(regionId: () => number | undefined): HttpResourceRef<RegionDetail | undefined> {
    return httpResource<RegionDetail>(() => {
      const id = regionId();
      return id === undefined ? undefined : `${API}/regions/${id}`;
    });
  }

  children(parentId: () => number | undefined): HttpResourceRef<Region[]> {
    return this.list<Region>(() => {
      const id = parentId();
      return id === undefined ? undefined : { url: `${API}/regions`, params: { parentId: id } };
    });
  }

  regionSearch(text: () => string): HttpResourceRef<RegionDetail[]> {
    return this.list<RegionDetail>(() => {
      const q = text().trim();
      return q.length < 2 ? undefined : { url: `${API}/regions/search`, params: { q } };
    });
  }

  childrenGeometry(parentId: () => number | undefined): HttpResourceRef<RegionFeatureCollection> {
    return httpResource<RegionFeatureCollection>(
      () => {
        const id = parentId();
        return id === undefined ? undefined : `${API}/regions/${id}/children/geometry`;
      },
      { defaultValue: EMPTY_COLLECTION },
    );
  }

  regionGeometry(regionId: () => number | undefined): HttpResourceRef<RegionFeature | undefined> {
    return httpResource<RegionFeature>(() => {
      const id = regionId();
      return id === undefined ? undefined : `${API}/regions/${id}/geometry`;
    });
  }

  days(query: () => ({ regionId: number } & Partial<DateRange>) | undefined): HttpResourceRef<CalendarDay[]> {
    return this.list<CalendarDay>(() => this.request(`${API}/calendar/days`, query()));
  }

  years(regionId: () => number | undefined): HttpResourceRef<YearSummary[]> {
    return this.list<YearSummary>(() => this.request(`${API}/calendar/years`, wrap('regionId', regionId())));
  }

  climatology(regionId: () => number | undefined): HttpResourceRef<ClimatologyDay[]> {
    return this.list<ClimatologyDay>(() => this.request(`${API}/calendar/climatology`, wrap('regionId', regionId())));
  }

  childrenActivity(
    query: () => ({ parentId: number } & Partial<DateRange>) | undefined,
  ): HttpResourceRef<RegionActivity[]> {
    return this.list<RegionActivity>(() => this.request(`${API}/calendar/children`, query()));
  }

  criticalPeriods(query: () => ({ regionId: number } & Partial<DateRange>) | undefined): HttpResourceRef<CriticalPeriod[]> {
    return this.list<CriticalPeriod>(() => this.request(`${API}/calendar/critical-periods`, query()));
  }

  cells(query: () => (DateRange & { includeBackground?: boolean }) | undefined): HttpResourceRef<MapCell[]> {
    return this.list<MapCell>(() => this.request(`${API}/map/cells`, query()));
  }

  /** Todos los focos del país en un día. */
  hotspotsOn(date: () => string | undefined): HttpResourceRef<HotspotPage> {
    return httpResource<HotspotPage>(
      () => {
        const day = date();
        return day ? { url: `${API}/hotspots`, params: { bbox: PERU_BBOX, from: day, to: day, limit: 50000 } } : undefined;
      },
      { defaultValue: EMPTY_PAGE },
    );
  }

  /** Distrito que contiene un punto; `null` si cae fuera de todos (mar, frontera). */
  async locate(latitude: number, longitude: number): Promise<RegionDetail | null> {
    try {
      return await firstValueFrom(
        this.http.get<RegionDetail>(`${API}/regions/locate`, { params: { latitude, longitude } }),
      );
    } catch {
      return null;
    }
  }

  private list<T>(request: () => { url: string; params?: Params } | undefined): HttpResourceRef<T[]> {
    return httpResource<T[]>(request, { defaultValue: [] });
  }

  /** Arma la petición sin los parámetros vacíos; sin consulta no se pide nada. */
  private request(url: string, query: object | undefined): { url: string; params: Params } | undefined {
    if (query === undefined) {
      return undefined;
    }
    const params: Params = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params[key] = value as string | number | boolean;
      }
    }
    return { url, params };
  }
}

function wrap<K extends string>(key: K, value: number | undefined): Record<K, number> | undefined {
  return value === undefined ? undefined : ({ [key]: value } as Record<K, number>);
}
