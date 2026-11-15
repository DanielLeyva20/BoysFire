import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

import { CHART_COLORS } from '../../shared/chart/chart-theme';
import { IsoDate } from '../../core/api/models';
import { BASEMAPS, Basemap, BasemapId, tilesFor } from './basemaps';

/** Identificadores de fuentes y capas. Se comparten entre el estilo y el componente. */
export const SOURCE = { regions: 'regions', regionLabels: 'region-labels', cells: 'cells', hotspots: 'hotspots' } as const;

export const LAYER = {
  regionFill: 'region-fill',
  regionLine: 'region-line',
  regionLabel: 'region-label',
  cellFill: 'cell-fill',
  hotspot: 'hotspot',
  hotspotSelected: 'hotspot-selected',
} as const;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Rótulos servidos por el proyecto MapLibre (no hace falta clave). */
const GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
const LABEL_FONT = ['Open Sans Semibold'];

/** Color según el nivel de la entidad (propiedad `level_`). */
const LEVEL_COLOR: ExpressionSpecification = [
  'match', ['get', 'level_'],
  'low', CHART_COLORS.low,
  'mid', CHART_COLORS.mid,
  'high', CHART_COLORS.high,
  'rgba(0,0,0,0)',
];

/**
 * El relleno pierde fuerza al acercarse: de lejos colorea la zona; de cerca deja ver el
 * terreno y los focos.
 */
export const FILL_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 5, 0.58, 8, 0.26, 10.5, 0.06];

export const basemapLayerId = (id: BasemapId): string => `basemap-${id}`;

/** Tinta de contornos y rótulos: clara sobre fondos oscuros, oscura sobre los claros. */
export function inkFor(basemap: Basemap): { line: string; halo: string } {
  return basemap.dark
    ? { line: CHART_COLORS.paper, halo: 'rgba(27,35,64,0.85)' }
    : { line: CHART_COLORS.ink, halo: 'rgba(248,249,251,0.9)' };
}

/** Estilo completo: todos los mapas base (uno visible) y, encima, las capas de datos. */
export function buildStyle(visibleBasemap: BasemapId, imageryDate: IsoDate): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    [SOURCE.regions]: { type: 'geojson', data: EMPTY },
    [SOURCE.regionLabels]: { type: 'geojson', data: EMPTY },
    [SOURCE.cells]: { type: 'geojson', data: EMPTY },
    [SOURCE.hotspots]: { type: 'geojson', data: EMPTY },
  };
  const basemapLayers: LayerSpecification[] = [];
  for (const basemap of BASEMAPS) {
    sources[basemapLayerId(basemap.id)] = {
      type: 'raster',
      tiles: tilesFor(basemap, imageryDate),
      tileSize: 256,
      maxzoom: basemap.maxZoom,
      attribution: basemap.attribution,
    };
    basemapLayers.push({
      id: basemapLayerId(basemap.id),
      type: 'raster',
      source: basemapLayerId(basemap.id),
      layout: { visibility: basemap.id === visibleBasemap ? 'visible' : 'none' },
    });
  }

  return {
    version: 8,
    glyphs: GLYPHS,
    sources,
    layers: [
      { id: 'paper', type: 'background', paint: { 'background-color': CHART_COLORS.paper } },
      ...basemapLayers,
      {
        id: LAYER.cellFill,
        type: 'fill',
        source: SOURCE.cells,
        paint: { 'fill-color': LEVEL_COLOR, 'fill-opacity': FILL_OPACITY, 'fill-outline-color': 'rgba(27,35,64,0.35)' },
      },
      {
        id: LAYER.regionFill,
        type: 'fill',
        source: SOURCE.regions,
        paint: { 'fill-color': LEVEL_COLOR, 'fill-opacity': FILL_OPACITY },
      },
      {
        id: LAYER.regionLine,
        type: 'line',
        source: SOURCE.regions,
        paint: { 'line-color': CHART_COLORS.paper, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 9, 1.6] },
      },
      {
        id: LAYER.hotspot,
        type: 'circle',
        source: SOURCE.hotspots,
        paint: {
          'circle-color': LEVEL_COLOR,
          'circle-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 4, 2.2, 8, 4.5, 12, 9, 15, 16],
          'circle-stroke-color': CHART_COLORS.ink,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 9, 1.2],
          'circle-opacity': 0.92,
        },
      },
      {
        id: LAYER.hotspotSelected,
        type: 'circle',
        source: SOURCE.hotspots,
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 4, 8, 8, 11, 12, 16, 15, 24],
          'circle-stroke-color': CHART_COLORS.paper,
          'circle-stroke-width': 3,
        },
      },
      {
        id: LAYER.regionLabel,
        type: 'symbol',
        source: SOURCE.regionLabels,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': LABEL_FONT,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10.5, 9, 14],
          'text-max-width': 7,
          'text-padding': 6,
        },
        paint: { 'text-color': CHART_COLORS.paper, 'text-halo-color': 'rgba(27,35,64,0.85)', 'text-halo-width': 1.4 },
      },
    ],
  };
}
