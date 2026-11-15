import { RiskFactor, RiskLevel } from '../api/risk-models';
import { formatDecimal, formatInteger, formatPercent } from './format';
import { Level } from './intensity';

/** El riesgo usa los mismos tres colores que la intensidad: verde, anaranjado y rojo. */
export const RISK_TO_LEVEL: Record<RiskLevel, Level> = { LOW: 'low', MODERATE: 'mid', HIGH: 'high' };

export const RISK_LABELS: Record<RiskLevel, string> = { LOW: 'Bajo', MODERATE: 'Moderado', HIGH: 'Alto' };

export const RISK_LEGEND: Record<Level, string> = {
  none: 'Sin dato',
  low: 'Riesgo bajo',
  mid: 'Riesgo moderado',
  high: 'Riesgo alto',
};

/** Lo medido, dicho en palabras: "Ráfagas de 55 km/h", "25 días sin lluvia"… */
export function describeFactor(factor: RiskFactor): string {
  if (factor.affectedShare !== null) {
    return `En ${formatPercent(factor.affectedShare)} de las provincias`;
  }
  const value = factor.observedValue ?? 0;
  switch (factor.code) {
    case 'STRONG_WIND':
      return `Ráfagas de hasta ${formatInteger(value)} km/h`;
    case 'DRY_VEGETATION':
      return `${formatInteger(value)} días seguidos sin lluvia`;
    case 'DRY_AIR':
      return `Humedad mínima de ${formatInteger(value)} %`;
    case 'HEAT':
      return `Máxima de ${formatDecimal(value, 1)} °C`;
    case 'FIRE_SEASON':
      return `La actividad típica de estas fechas es ${formatInteger(value)} % del pico del año`;
    case 'ACTIVE_FIRE':
      return `${formatInteger(value)} foco${value === 1 ? '' : 's'} confiable${value === 1 ? '' : 's'} en los últimos días`;
  }
}
