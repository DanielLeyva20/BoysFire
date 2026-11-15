import type { EChartsCoreOption } from 'echarts/core';

import { CalendarDay, CriticalPeriod, YearSummary } from '../../core/api/models';
import { formatLongDate } from '../../core/domain/dates';
import { formatIndex, formatInteger } from '../../core/domain/format';
import { CHART_COLORS, axisStyle, legendStyle, tooltipStyle } from '../../shared/chart/chart-theme';

/**
 * Focos crudos por sensor (barras) frente a la serie armonizada (línea). Las barras se
 * disparan en 2012 al entrar VIIRS; la línea no: ese contraste es el argumento del proyecto.
 */
export function sensorJumpChart(years: readonly YearSummary[]): EChartsCoreOption {
  return {
    animationDuration: 400,
    grid: { left: 60, right: 68, top: 68, bottom: 28 },
    legend: { ...legendStyle(), top: 0, left: 0 },
    tooltip: {
      ...tooltipStyle(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: number) => formatInteger(value),
    },
    xAxis: { type: 'category', data: years.map((year) => year.year), ...axisStyle(), splitLine: { show: false } },
    yAxis: [
      { type: 'value', name: 'Focos crudos', ...axisStyle(), axisLine: { show: false } },
      { type: 'value', name: 'Índice armonizado', ...axisStyle(), axisLine: { show: false }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Focos MODIS (sin armonizar)',
        type: 'bar',
        stack: 'crudo',
        data: years.map((year) => year.modisDetections),
        itemStyle: { color: CHART_COLORS.modis },
      },
      {
        name: 'Focos VIIRS (sin armonizar)',
        type: 'bar',
        stack: 'crudo',
        data: years.map((year) => year.viirsDetections),
        itemStyle: { color: CHART_COLORS.rule },
      },
      {
        name: 'Índice armonizado',
        type: 'line',
        yAxisIndex: 1,
        data: years.map((year) => Math.round(year.harmonizedIndex)),
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: CHART_COLORS.accent, width: 2.5 },
        itemStyle: { color: CHART_COLORS.accent },
      },
    ],
  };
}

/**
 * Serie diaria completa, con zoom. Los períodos críticos se marcan como bloques cuyo
 * ancho es su duración.
 */
export function dailySeriesChart(days: readonly CalendarDay[], periods: readonly CriticalPeriod[]): EChartsCoreOption {
  const lastYearStart = days.length > 0 ? Math.max(0, 100 - (366 / days.length) * 300) : 0;
  return {
    animation: false,
    grid: { left: 60, right: 24, top: 68, bottom: 76 },
    legend: { ...legendStyle(), top: 0, left: 0 },
    tooltip: {
      ...tooltipStyle(),
      trigger: 'axis',
      formatter: (points: { dataIndex: number }[]) => {
        const day = days[points[0].dataIndex];
        return (
          `<strong>${formatLongDate(day.date)}</strong><br>` +
          `Índice: ${formatIndex(day.harmonizedIndex)}<br>` +
          `Lo normal: ${day.expectedIndex === null ? '—' : formatIndex(day.expectedIndex)}<br>` +
          `Umbral crítico: ${day.criticalThreshold === null ? '—' : formatIndex(day.criticalThreshold)}`
        );
      },
    },
    xAxis: {
      type: 'category',
      data: days.map((day) => day.date),
      boundaryGap: false,
      ...axisStyle(),
      splitLine: { show: false },
    },
    yAxis: { type: 'value', name: 'Índice armonizado', ...axisStyle(), axisLine: { show: false } },
    dataZoom: [
      { type: 'inside', start: lastYearStart, end: 100 },
      {
        type: 'slider',
        start: lastYearStart,
        end: 100,
        height: 28,
        bottom: 12,
        borderColor: CHART_COLORS.rule,
        fillerColor: 'rgba(44,63,196,0.12)',
        handleStyle: { color: CHART_COLORS.accent, borderColor: CHART_COLORS.accent },
        moveHandleStyle: { color: CHART_COLORS.accent },
        dataBackground: { lineStyle: { color: CHART_COLORS.ink3 }, areaStyle: { color: CHART_COLORS.rule } },
        selectedDataBackground: { lineStyle: { color: CHART_COLORS.accent }, areaStyle: { color: CHART_COLORS.accent } },
        textStyle: { color: CHART_COLORS.ink2 },
      },
    ],
    series: [
      {
        name: 'Índice del día',
        type: 'line',
        data: days.map((day) => day.harmonizedIndex),
        showSymbol: false,
        sampling: 'max',
        lineStyle: { color: CHART_COLORS.ink, width: 1.2 },
        itemStyle: { color: CHART_COLORS.ink },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(201,60,42,0.16)' },
          data: periods.map((period) => [{ xAxis: period.start }, { xAxis: period.end }]),
        },
      },
      {
        name: 'Umbral crítico',
        type: 'line',
        data: days.map((day) => day.criticalThreshold),
        showSymbol: false,
        sampling: 'max',
        lineStyle: { color: CHART_COLORS.high, width: 1.2, type: 'dashed' },
        itemStyle: { color: CHART_COLORS.high },
      },
      {
        name: 'Lo normal',
        type: 'line',
        data: days.map((day) => day.expectedIndex),
        showSymbol: false,
        sampling: 'average',
        lineStyle: { color: CHART_COLORS.low, width: 1.4 },
        itemStyle: { color: CHART_COLORS.low },
      },
    ],
  };
}
