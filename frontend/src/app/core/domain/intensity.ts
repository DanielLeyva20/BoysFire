import { CalendarDay, Hotspot } from '../api/models';

/**
 * Niveles de intensidad. En toda la aplicación: verde = bajo, anaranjado = medio,
 * rojo = alto. `none` es un día o celda sin actividad.
 */
export type Level = 'none' | 'low' | 'mid' | 'high';

export interface LevelInfo {
  level: Level;
  label: string;
}

/** Potencia radiativa (MW) a partir de la cual un foco es de intensidad media o alta. */
export const HOTSPOT_MID_FRP_MW = 10;
export const HOTSPOT_HIGH_FRP_MW = 50;

/** Por debajo de esto el índice es solo fondo residual: se trata como "sin actividad". */
const MIN_ACTIVE_INDEX = 0.5;

export const DAY_LEVEL_LABELS: Record<Level, string> = {
  none: 'Sin actividad',
  low: 'Dentro de lo normal',
  mid: 'Sobre lo normal',
  high: 'Crítico',
};

export const HOTSPOT_LEVEL_LABELS: Record<Level, string> = {
  none: 'Sin dato',
  low: `Baja (menos de ${HOTSPOT_MID_FRP_MW} MW)`,
  mid: `Media (${HOTSPOT_MID_FRP_MW} a ${HOTSPOT_HIGH_FRP_MW} MW)`,
  high: `Alta (más de ${HOTSPOT_HIGH_FRP_MW} MW)`,
};

export const RELATIVE_LEVEL_LABELS: Record<Level, string> = {
  none: 'Sin actividad',
  low: 'Menor',
  mid: 'Intermedia',
  high: 'Mayor',
};

/** Un día se compara con lo normal para esa época en su región, no con una escala fija. */
export function dayLevel(day: CalendarDay): Level {
  if (day.harmonizedIndex < MIN_ACTIVE_INDEX) {
    return 'none';
  }
  if (day.critical) {
    return 'high';
  }
  return day.expectedIndex !== null && day.harmonizedIndex > day.expectedIndex ? 'mid' : 'low';
}

/** Un foco se clasifica por su potencia radiativa. Sin dato de potencia se considera bajo. */
export function hotspotLevel(hotspot: Pick<Hotspot, 'frpMw'>): Level {
  const frp = hotspot.frpMw ?? 0;
  if (frp >= HOTSPOT_HIGH_FRP_MW) {
    return 'high';
  }
  return frp >= HOTSPOT_MID_FRP_MW ? 'mid' : 'low';
}

/**
 * Clasifica valores respecto del propio conjunto: el 10 % más alto es `high`, el 30 %
 * siguiente `mid` y el resto `low`. Sirve para comparar celdas o regiones entre sí.
 */
export function relativeLevels(values: readonly number[]): Level[] {
  const active = values.filter((value) => value >= MIN_ACTIVE_INDEX).sort((a, b) => a - b);
  if (active.length === 0) {
    return values.map(() => 'none');
  }
  const midFrom = quantile(active, 0.6);
  const highFrom = quantile(active, 0.9);
  return values.map((value) => {
    if (value < MIN_ACTIVE_INDEX) {
      return 'none';
    }
    if (value >= highFrom) {
      return 'high';
    }
    return value >= midFrom ? 'mid' : 'low';
  });
}

function quantile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}
