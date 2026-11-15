import { IsoDate } from '../../core/api/models';

export type BasemapId = 'satellite' | 'relief' | 'light' | 'dark' | 'streets' | 'nasa';

export interface Basemap {
  id: BasemapId;
  label: string;
  description: string;
  /** Plantillas de teselas. En el mapa fechado, `{date}` se sustituye por el día elegido. */
  tiles: string[];
  attribution: string;
  maxZoom: number;
  /** Fondo oscuro: los contornos y rótulos se dibujan en claro para que se lean. */
  dark: boolean;
  /** La imagen depende del día seleccionado. */
  dated: boolean;
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const CARTO = 'https://basemaps.cartocdn.com';
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/** Todos son servicios abiertos que no requieren clave. */
export const BASEMAPS: readonly Basemap[] = [
  {
    id: 'satellite',
    label: 'Satélite',
    description: 'Imagen real de alta resolución',
    tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
    attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    dark: true,
    dated: false,
  },
  {
    id: 'relief',
    label: 'Relieve',
    description: 'Montañas, ríos y curvas de nivel',
    tiles: [`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`],
    attribution: '© Esri, HERE, Garmin, FAO, USGS',
    maxZoom: 18,
    dark: false,
    dated: false,
  },
  {
    id: 'light',
    label: 'Claro',
    description: 'Fondo neutro: resaltan los datos',
    tiles: ['a', 'b', 'c'].map((host) => `https://${host}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`),
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 19,
    dark: false,
    dated: false,
  },
  {
    id: 'dark',
    label: 'Oscuro',
    description: 'Para proyectar en salas con poca luz',
    tiles: [`${CARTO}/dark_all/{z}/{x}/{y}.png`],
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 19,
    dark: true,
    dated: false,
  },
  {
    id: 'streets',
    label: 'Calles',
    description: 'Ciudades, carreteras y poblados',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© Colaboradores de OpenStreetMap',
    maxZoom: 19,
    dark: false,
    dated: false,
  },
  {
    id: 'nasa',
    label: 'NASA del día',
    description: 'Lo que vio el satélite Terra el día elegido',
    tiles: [`${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`],
    attribution: 'Imagen NASA GIBS / MODIS Terra',
    maxZoom: 9,
    dark: true,
    dated: true,
  },
];

export const DEFAULT_BASEMAP: BasemapId = 'satellite';

export function basemapOf(id: BasemapId): Basemap {
  return BASEMAPS.find((basemap) => basemap.id === id) ?? BASEMAPS[0];
}

export function tilesFor(basemap: Basemap, date: IsoDate): string[] {
  return basemap.tiles.map((template) => template.replace('{date}', date));
}
