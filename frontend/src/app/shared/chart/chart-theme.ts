/**
 * Colores y piezas comunes de los gráficos. ECharts dibuja en un lienzo y no lee las
 * variables CSS, por eso los colores del tema se repiten aquí (mismos valores que theme.css).
 */
export const CHART_COLORS = {
  paper: '#f8f9fb',
  ink: '#1b2340',
  ink2: '#454d68',
  ink3: '#636b85',
  rule: '#cfd5e2',
  accent: '#2c3fc4',
  low: '#3fb673',
  mid: '#eba23a',
  high: '#c93c2a',
  modis: '#7d86a3',
  viirs: '#1b2340',
} as const;

export const CHART_FONT = '"Archivo Variable", ui-sans-serif, system-ui, sans-serif';

export const CHART_TEXT = { color: CHART_COLORS.ink2, fontFamily: CHART_FONT, fontSize: 12 };

/** Eje con regla fina, sin marcas: como el margen de una hoja reglada. */
export function axisStyle() {
  return {
    axisLine: { lineStyle: { color: CHART_COLORS.ink } },
    axisTick: { show: false },
    axisLabel: CHART_TEXT,
    splitLine: { lineStyle: { color: CHART_COLORS.rule } },
    nameTextStyle: { ...CHART_TEXT, color: CHART_COLORS.ink3 },
  };
}

export function tooltipStyle() {
  return {
    backgroundColor: CHART_COLORS.ink,
    borderColor: CHART_COLORS.ink,
    padding: [6, 10],
    textStyle: { color: CHART_COLORS.paper, fontFamily: CHART_FONT, fontSize: 13 },
    extraCssText: 'border-radius:3px;box-shadow:0 8px 24px -8px rgba(27,35,64,.4);',
  };
}

export function legendStyle() {
  return { textStyle: { ...CHART_TEXT, color: CHART_COLORS.ink }, itemWidth: 14, itemHeight: 10, icon: 'rect' };
}
