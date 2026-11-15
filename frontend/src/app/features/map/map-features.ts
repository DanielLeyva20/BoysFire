import type { Feature, FeatureCollection, Point, Polygon, Position } from 'geojson';
import { cellToBoundary } from 'h3-js';

import { Hotspot, MapCell, Region, RegionActivity, RegionFeature, RegionFeatureCollection } from '../../core/api/models';
import { Level, hotspotLevel, relativeLevels } from '../../core/domain/intensity';

/** [oeste, sur, este, norte] */
export type Bounds = [number, number, number, number];

export interface RegionProperties extends Region {
  level_: Level;
  index: number;
}

export interface CellProperties {
  level_: Level;
  index: number;
  detected: number;
}

export interface HotspotProperties {
  id: number;
  level_: Level;
}

/** Perú completo, para la vista inicial. */
export const PERU_BOUNDS: Bounds = [-81.4, -18.4, -68.6, 0];

/** Contornos de regiones con su nivel relativo según la actividad del período. */
export function regionFeatures(
  collection: RegionFeatureCollection,
  activity: readonly RegionActivity[],
): FeatureCollection<RegionFeature['geometry'], RegionProperties> {
  const indexById = new Map(activity.map((entry) => [entry.regionId, entry.harmonizedIndex]));
  const indexes = collection.features.map((feature) => indexById.get(feature.id) ?? 0);
  const levels = relativeLevels(indexes);
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature, position) => ({
      type: 'Feature',
      id: feature.id,
      geometry: feature.geometry,
      properties: { ...feature.properties, level_: levels[position], index: indexes[position] },
    })),
  };
}

/** Hexágonos H3 con su nivel relativo. */
export function cellFeatures(cells: readonly MapCell[]): FeatureCollection<Polygon, CellProperties> {
  const levels = relativeLevels(cells.map((cell) => cell.harmonizedIndex));
  return {
    type: 'FeatureCollection',
    features: cells.map((cell, position) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [closedRing(cellToBoundary(cell.h3, true))] },
      properties: { level_: levels[position], index: cell.harmonizedIndex, detected: cell.detectedIndex },
    })),
  };
}

/** Un punto por foco, con su nivel según la potencia radiativa. */
export function hotspotFeatures(hotspots: readonly Hotspot[]): FeatureCollection<Point, HotspotProperties> {
  return {
    type: 'FeatureCollection',
    features: hotspots.map((hotspot) => ({
      type: 'Feature',
      id: hotspot.id,
      geometry: { type: 'Point', coordinates: [hotspot.longitude, hotspot.latitude] },
      properties: { id: hotspot.id, level_: hotspotLevel(hotspot) },
    })),
  };
}

/** Un punto por región, en el centro de su extensión, para colocar su nombre una sola vez. */
export function regionLabelPoints(regions: FeatureCollection): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: regions.features.flatMap((feature) => {
      const bounds = boundsOf([feature]);
      return bounds
        ? [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: centerOf(bounds) }, properties: feature.properties }]
        : [];
    }),
  };
}

export function boundsOf(features: readonly Feature[]): Bounds | undefined {
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    visitPositions(feature.geometry, ([longitude, latitude]) => {
      bounds[0] = Math.min(bounds[0], longitude);
      bounds[1] = Math.min(bounds[1], latitude);
      bounds[2] = Math.max(bounds[2], longitude);
      bounds[3] = Math.max(bounds[3], latitude);
    });
  }
  return Number.isFinite(bounds[0]) ? bounds : undefined;
}

export function centerOf(bounds: Bounds): [number, number] {
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

function closedRing(boundary: number[][]): Position[] {
  const first = boundary[0];
  const last = boundary[boundary.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? boundary : [...boundary, first];
}

function visitPositions(geometry: Feature['geometry'], visit: (position: Position) => void): void {
  const walk = (coordinates: unknown): void => {
    if (Array.isArray(coordinates) && typeof coordinates[0] === 'number') {
      visit(coordinates as Position);
    } else if (Array.isArray(coordinates)) {
      coordinates.forEach(walk);
    }
  };
  if ('coordinates' in geometry) {
    walk(geometry.coordinates);
  }
}
