import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output,
  signal, viewChild,
} from '@angular/core';
import type { FeatureCollection } from 'geojson';
import { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker, NavigationControl, Popup, RasterTileSource, ScaleControl } from 'maplibre-gl';

import { IsoDate } from '../../core/api/models';
import { BASEMAPS, BasemapId, basemapOf, tilesFor } from './basemaps';
import { Bounds, PERU_BOUNDS, regionLabelPoints } from './map-features';
import { FILL_OPACITY, LAYER, SOURCE, basemapLayerId, buildStyle, inkFor } from './map-style';

export type Overlay = 'regions' | 'cells';

export interface PeakMark {
  longitude: number;
  latitude: number;
  label: string;
}

const FIT_PADDING_PX = 48;
const FIT_DURATION_MS = 650;
/** Casi invisible, pero sigue recibiendo clics: la región se puede elegir en cualquier vista. */
const REGION_HIT_OPACITY = 0.01;

/**
 * Mapa de MapLibre. No conoce la API: recibe colecciones GeoJSON ya preparadas y avisa de
 * los clics. Así la página decide qué mostrar y el mapa solo dibuja.
 */
@Component({
  selector: 'app-fire-map',
  templateUrl: './fire-map.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Llena la sección que lo contiene (que debe ser `relative` y tener altura).
  host: { class: 'absolute inset-0 block' },
})
export class FireMap {
  readonly basemap = input.required<BasemapId>();
  readonly overlay = input.required<Overlay>();
  readonly regions = input.required<FeatureCollection>();
  readonly cells = input.required<FeatureCollection>();
  readonly hotspots = input.required<FeatureCollection>();
  /** Día para la imagen "NASA del día". */
  readonly imageryDate = input.required<IsoDate>();
  /** Zona a encuadrar; al cambiar, el mapa se mueve hasta ella. */
  readonly focus = input<Bounds>(PERU_BOUNDS);
  readonly selectedHotspotId = input<number | undefined>(undefined);
  readonly peak = input<PeakMark | undefined>(undefined);

  readonly regionClick = output<number>();
  readonly hotspotClick = output<number>();
  readonly peakClick = output<void>();
  /** Cualquier clic en el mapa, con su posición. */
  readonly pointClick = output<{ longitude: number; latitude: number }>();

  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly ready = signal(false);
  private map!: MapLibreMap;
  private peakMarker: Marker | undefined;
  private readonly hoverLabel = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.map = new MapLibreMap({
        container: this.canvas().nativeElement,
        style: buildStyle(this.basemap(), this.imageryDate()),
        bounds: this.focus(),
        fitBoundsOptions: { padding: FIT_PADDING_PX },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 17,
        minZoom: 3,
      });
      this.map.touchZoomRotate.disableRotation();
      this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
      this.map.once('load', () => this.ready.set(true));
      this.listenToPointer();
      destroyRef.onDestroy(() => this.map.remove());
    });

    this.whenReady(() => {
      this.setData(SOURCE.regions, this.regions());
      this.setData(SOURCE.regionLabels, regionLabelPoints(this.regions()));
    });
    this.whenReady(() => this.setData(SOURCE.cells, this.cells()));
    this.whenReady(() => this.setData(SOURCE.hotspots, this.hotspots()));
    this.whenReady(() => this.showBasemap(this.basemap()));
    this.whenReady(() => this.showOverlay(this.overlay()));
    this.whenReady(() => this.showImageryOf(this.imageryDate()));
    this.whenReady(() => this.highlightHotspot(this.selectedHotspotId()));
    this.whenReady(() => this.placePeak(this.peak()));
    this.whenReady(() => this.moveTo(this.focus()));
  }

  /** Acerca el mapa a un punto (un foco o la marca de mayor actividad). */
  flyTo(longitude: number, latitude: number, zoom: number): void {
    this.map.flyTo({ center: [longitude, latitude], zoom: Math.max(zoom, this.map.getZoom()), duration: this.motion(900) });
  }

  private whenReady(update: () => void): void {
    effect(() => {
      if (this.ready()) {
        update();
      }
    });
  }

  private setData(source: string, data: FeatureCollection): void {
    this.map.getSource<GeoJSONSource>(source)?.setData(data);
  }

  private showBasemap(visible: BasemapId): void {
    for (const basemap of BASEMAPS) {
      this.map.setLayoutProperty(basemapLayerId(basemap.id), 'visibility', basemap.id === visible ? 'visible' : 'none');
    }
    const ink = inkFor(basemapOf(visible));
    this.map.setPaintProperty(LAYER.regionLine, 'line-color', ink.line);
    this.map.setPaintProperty(LAYER.regionLabel, 'text-color', ink.line);
    this.map.setPaintProperty(LAYER.regionLabel, 'text-halo-color', ink.halo);
  }

  private showOverlay(overlay: Overlay): void {
    this.map.setPaintProperty(LAYER.regionFill, 'fill-opacity', overlay === 'regions' ? FILL_OPACITY : REGION_HIT_OPACITY);
    this.map.setLayoutProperty(LAYER.cellFill, 'visibility', overlay === 'cells' ? 'visible' : 'none');
  }

  private showImageryOf(date: IsoDate): void {
    const dated = BASEMAPS.find((basemap) => basemap.dated);
    if (dated) {
      this.map.getSource<RasterTileSource>(basemapLayerId(dated.id))?.setTiles(tilesFor(dated, date));
    }
  }

  private highlightHotspot(hotspotId: number | undefined): void {
    this.map.setFilter(LAYER.hotspotSelected, ['==', ['get', 'id'], hotspotId ?? -1]);
  }

  private placePeak(peak: PeakMark | undefined): void {
    this.peakMarker?.remove();
    this.peakMarker = undefined;
    if (!peak) {
      return;
    }
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'peak-marker';
    element.setAttribute('aria-label', peak.label);
    element.title = peak.label;
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      this.peakClick.emit();
    });
    this.peakMarker = new Marker({ element }).setLngLat([peak.longitude, peak.latitude]).addTo(this.map);
  }

  private moveTo(bounds: Bounds): void {
    this.map.fitBounds(bounds, { padding: FIT_PADDING_PX, duration: this.motion(FIT_DURATION_MS), maxZoom: 11 });
  }

  /** Un clic elige primero el foco (lo más fino); si no hay foco bajo el cursor, la región. */
  private listenToPointer(): void {
    this.map.on('click', (event) => {
      this.pointClick.emit({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
      const [hotspot] = this.map.queryRenderedFeatures(event.point, { layers: [LAYER.hotspot] });
      if (hotspot) {
        this.hotspotClick.emit(Number(hotspot.properties['id']));
        return;
      }
      const [region] = this.map.queryRenderedFeatures(event.point, { layers: [LAYER.regionFill] });
      if (region) {
        this.regionClick.emit(Number(region.properties['id']));
      }
    });

    this.map.on('mousemove', LAYER.hotspot, () => this.describe(undefined, 'pointer'));
    this.map.on('mouseleave', LAYER.hotspot, () => this.describe(undefined, ''));
    this.map.on('mousemove', LAYER.regionFill, (event) => this.describe(event, 'pointer'));
    this.map.on('mouseleave', LAYER.regionFill, () => this.describe(undefined, ''));
  }

  /** Etiqueta flotante con el nombre de la región y su índice en el período. */
  private describe(event: MapLayerMouseEvent | undefined, cursor: string): void {
    this.map.getCanvas().style.cursor = cursor;
    const properties = event?.features?.[0]?.properties;
    if (!event || !properties) {
      this.hoverLabel.remove();
      return;
    }
    const label = document.createElement('span');
    label.textContent = String(properties['label'] ?? properties['name']);
    this.hoverLabel.setLngLat(event.lngLat).setDOMContent(label).addTo(this.map);
  }

  private motion(duration: number): number {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration;
  }
}
