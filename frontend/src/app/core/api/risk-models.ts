import { IsoDate, Region } from './models';

/** Tipos de la API de prevención (/api/risk). */

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export type RiskFactorCode = 'STRONG_WIND' | 'DRY_VEGETATION' | 'DRY_AIR' | 'HEAT' | 'FIRE_SEASON' | 'ACTIVE_FIRE';

export interface RiskFactor {
  code: RiskFactorCode;
  name: string;
  description: string;
  unit: string | null;
  points: number;
  /** Valor medido (zona evaluada directamente). */
  observedValue: number | null;
  /** Fracción de provincias con el factor (departamento o país). */
  affectedShare: number | null;
}

export interface RiskWeather {
  temperatureMaxC: number;
  humidityMinPct: number;
  windMaxKmh: number;
  gustMaxKmh: number;
  precipitationMm: number;
  daysWithoutRain: number;
}

export interface ZoneRisk {
  region: Region;
  date: IsoDate;
  level: RiskLevel;
  score: number;
  maxScore: number;
  /** Se resume de varias provincias (departamento o país). */
  summary: boolean;
  factors: RiskFactor[];
  recommendations: string[];
  weather: RiskWeather | null;
  weatherPlace: string | null;
  computedAtUtc: string;
  hotspotDataDate: IsoDate | null;
}

export interface RegionRisk {
  regionId: number;
  level: RiskLevel;
  score: number;
}

export interface DayRisk {
  date: IsoDate;
  level: RiskLevel;
  score: number;
}

export interface RiskStatus {
  lastRunAtUtc: string | null;
  lastStatus: 'SUCCESS' | 'FAILED' | 'RUNNING' | null;
  lastSuccessAtUtc: string | null;
  refreshIntervalMinutes: number;
  hotspotDataDate: IsoDate | null;
  weatherSource: string;
}
