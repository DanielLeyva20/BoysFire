import { Signal, computed, inject } from '@angular/core';

import { FireApi } from '../api/fire-api';
import { RegionFeatureCollection } from '../api/models';
import { SelectionStore } from './selection-store';

/**
 * Contornos que el mapa dibuja para la región seleccionada: sus regiones hijas o, si es un
 * distrito (que no tiene hijas), su propio contorno. Llamar en el contexto de inyección.
 */
export function selectedRegionOutlines(): Signal<RegionFeatureCollection> {
  const api = inject(FireApi);
  const selection = inject(SelectionStore);
  const children = api.childrenGeometry(selection.regionId);
  const own = api.regionGeometry(() =>
    selection.region()?.region.level === 'DISTRICT' ? selection.regionId() : undefined,
  );
  return computed(() => {
    const childFeatures = children.value();
    const ownFeature = own.value();
    return childFeatures.features.length === 0 && ownFeature
      ? { type: 'FeatureCollection', features: [ownFeature] }
      : childFeatures;
  });
}
