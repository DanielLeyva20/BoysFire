import type { MultiPolygon, Polygon } from 'geojson';

/** Tipos de las respuestas de la API. Las fechas viajan como texto ISO (AAAA-MM-DD). */

export type IsoDate = string;
export type RegionLevel = 'COUNTRY' | 'DEPARTMENT' | 'PROVINCE' | 'DISTRICT';
export type Sensor = 'MODIS' | 'VIIRS';
export type Confidence = 'LOW' | 'NOMINAL' | 'HIGH';

export interface Region {
  id: number;
  code: string;
  name: string;
  level: RegionLevel;
  parentId: number | null;
}

export interface RegionDetail {
  region: Region;
  /** Del país hacia abajo, sin incluir la propia región. */
  ancestors: Region[];
  path: string;
}

export interface CalendarDay {
  date: IsoDate;
  harmonizedIndex: number;
  detectedIndex: number;
  backgroundIndex: number;
  expectedIndex: number | null;
  criticalThreshold: number | null;
  critical: boolean;
  source: string;
}

export interface YearSummary {
  year: number;
  observedDays: number;
  harmonizedIndex: number;
  detectedIndex: number;
  backgroundIndex: number;
  peakIndex: number;
  criticalDays: number;
  modisDetections: number;
  viirsDetections: number;
}

export interface SensorDay {
  date: IsoDate;
  sensor: Sensor;
  detections: number;
  confidentDetections: number;
  frpSumMw: number;
}

export interface ClimatologyDay {
  dayOfYear: number;
  sampleYears: number;
  meanIndex: number;
  p50Index: number;
  p90Index: number;
  p95Index: number;
  criticalThreshold: number;
}

export interface RegionActivity {
  regionId: number;
  harmonizedIndex: number;
  detectedIndex: number;
  backgroundIndex: number;
  criticalDays: number;
  peakDate: IsoDate;
  peakIndex: number;
}

export interface CriticalPeriod {
  start: IsoDate;
  end: IsoDate;
  criticalDays: number;
  peakDate: IsoDate;
  peakIndex: number;
  totalIndex: number;
}

export interface Hotspot {
  id: number;
  latitude: number;
  longitude: number;
  acquiredAtUtc: string;
  localDate: IsoDate;
  satellite: string;
  sensor: Sensor;
  confidence: Confidence;
  frpMw: number | null;
  scanKm: number | null;
  trackKm: number | null;
  daytime: boolean;
}

export interface HotspotPage {
  count: number;
  truncated: boolean;
  items: Hotspot[];
}

export interface MapCell {
  h3: string;
  latitude: number;
  longitude: number;
  activeLoci: number;
  detectedIndex: number;
  backgroundIndex: number;
  harmonizedIndex: number;
}

export interface DataSummary {
  firstDate: IsoDate;
  lastDate: IsoDate;
  hotspotCount: number;
  lastHarmonizedUtc: string | null;
  sourceDays: Record<string, number>;
  metrics: Record<string, number>;
}

export interface RegionFeature {
  type: 'Feature';
  id: number;
  geometry: Polygon | MultiPolygon;
  properties: Region;
}

export interface RegionFeatureCollection {
  type: 'FeatureCollection';
  features: RegionFeature[];
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}
