import { httpResource, HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { IsoDate } from './models';
import { DayRisk, RegionRisk, RiskStatus, ZoneRisk } from './risk-models';

const API = '/api/risk';

type Params = Record<string, string | number>;

/** Prevención: riesgo por zona, sus factores y recomendaciones. Métodos para el contexto de inyección. */
@Injectable({ providedIn: 'root' })
export class RiskApi {
  zone(query: () => { regionId: number; date?: IsoDate } | undefined): HttpResourceRef<ZoneRisk | undefined> {
    return httpResource<ZoneRisk>(() => request(API, query()));
  }

  children(query: () => { parentId: number; date?: IsoDate } | undefined): HttpResourceRef<RegionRisk[]> {
    return httpResource<RegionRisk[]>(() => request(`${API}/children`, query()), { defaultValue: [] });
  }

  forecast(regionId: () => number | undefined): HttpResourceRef<DayRisk[]> {
    return httpResource<DayRisk[]>(() => {
      const id = regionId();
      return id === undefined ? undefined : request(`${API}/forecast`, { regionId: id });
    }, { defaultValue: [] });
  }

  status(): HttpResourceRef<RiskStatus | undefined> {
    return httpResource<RiskStatus>(() => `${API}/status`);
  }
}

/** Petición sin los parámetros vacíos; sin consulta no se pide nada. */
function request(url: string, query: Record<string, string | number | undefined> | undefined): { url: string; params: Params } | undefined {
  if (!query) {
    return undefined;
  }
  const params: Params = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params[key] = value;
    }
  }
  return { url, params };
}
