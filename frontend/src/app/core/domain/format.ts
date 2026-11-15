const INTEGER = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const COMPACT = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 });
const PERCENT = new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 0 });

/** "72,238" */
export function formatInteger(value: number): string {
  return INTEGER.format(value);
}

/** Índice armonizado: sin decimales desde 10, con uno por debajo ("0.4"). */
export function formatIndex(value: number): string {
  return Math.abs(value) >= 10 ? INTEGER.format(value) : ONE_DECIMAL.format(value);
}

/** "72 mil", "2.1 M" */
export function formatCompact(value: number): string {
  return COMPACT.format(value);
}

/** "74 %" */
export function formatPercent(fraction: number): string {
  return PERCENT.format(fraction);
}

/** Número con una cantidad fija de decimales, con los separadores del español de Perú. */
export function formatDecimal(value: number, digits: number): string {
  return value.toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "-13.0821, -76.3812" */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${formatDecimal(latitude, 4)}, ${formatDecimal(longitude, 4)}`;
}
