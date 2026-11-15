import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FireApi } from '../../core/api/fire-api';
import { DataSummary, IsoDate } from '../../core/api/models';
import { formatLongDate } from '../../core/domain/dates';
import { formatDecimal, formatInteger } from '../../core/domain/format';
import { SelectionStore } from '../../core/state/selection-store';
import { settled } from '../../core/state/settled';
import { RegionRanking } from '../../shared/region-ranking/region-ranking';
import { YearRidges } from './year-ridges';

interface LedgerRow {
  label: string;
  value: string;
  note?: string;
}

/** Nombre de cada grupo de satélites que alimenta la serie. */
const SOURCE_LABELS: Record<string, string> = {
  SNPP: 'VIIRS S-NPP (referencia)',
  NOAA20: 'VIIRS NOAA-20',
  NOAA21: 'VIIRS NOAA-21',
  MODIS: 'MODIS Terra + Aqua',
  AQUA: 'MODIS Aqua',
  TERRA: 'MODIS Terra',
};

const signedPercent = (value: number) => `${value >= 0 ? '+' : '−'}${formatDecimal(Math.abs(value), 1)} %`;

/** Cifras de conjunto: cobertura de los datos, comparación entre regiones y validación. */
@Component({
  selector: 'app-stats-page',
  imports: [RegionRanking, YearRidges],
  templateUrl: './stats-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class StatsPage {
  private readonly api = inject(FireApi);
  private readonly router = inject(Router);
  protected readonly selection = inject(SelectionStore);

  protected readonly children = this.api.children(this.selection.regionId);
  protected readonly activity = settled(this.api.childrenActivity(() => ({ parentId: this.selection.regionId() })));
  protected readonly days = settled(this.api.days(() => ({ regionId: this.selection.regionId() })));

  protected readonly coverage = computed<LedgerRow[]>(() => {
    const summary = this.selection.summary.value();
    return summary ? coverageRows(summary) : [];
  });

  protected readonly validation = computed<LedgerRow[]>(() => {
    const summary = this.selection.summary.value();
    return summary ? validationRows(summary.metrics) : [];
  });

  protected openOnMap(date: IsoDate): void {
    this.selection.selectDate(date);
    void this.router.navigateByUrl('/');
  }
}

function coverageRows(summary: DataSummary): LedgerRow[] {
  const metrics = summary.metrics;
  const excluded =
    (metrics['rows.excluded.non_vegetation_type'] ?? 0) +
    (metrics['rows.excluded.static_source_inferred'] ?? 0) +
    (metrics['rows.excluded.duplicate'] ?? 0);
  return [
    { label: 'Primer día de la serie', value: formatLongDate(summary.firstDate) },
    { label: 'Último día de la serie', value: formatLongDate(summary.lastDate) },
    { label: 'Focos recibidos de NASA FIRMS', value: formatInteger(metrics['rows.raw'] ?? 0) },
    { label: 'Descartados', value: formatInteger(excluded), note: 'Volcanes, industrias, mar y repetidos' },
    { label: 'Focos limpios', value: formatInteger(summary.hotspotCount) },
    ...Object.entries(summary.sourceDays).map(([source, days]) => ({
      label: `Días medidos con ${SOURCE_LABELS[source] ?? source}`,
      value: formatInteger(days),
    })),
  ];
}

function validationRows(metrics: Record<string, number>): LedgerRow[] {
  const rows: (LedgerRow & { metric: string })[] = [
    {
      metric: 'jump.raw.viirs_era_over_modis_era',
      label: 'Focos crudos por año: 2013–2021 frente a 2003–2011',
      value: '',
      note: 'El salto falso: no hubo más fuego, hubo un sensor más sensible',
    },
    {
      metric: 'jump.harmonized.viirs_era_over_modis_era',
      label: 'La misma comparación con la serie armonizada',
      value: '',
      note: 'Cerca de 1 significa que ambas épocas son comparables',
    },
    {
      metric: 'validation.MODIS.holdout.monthly_correlation',
      label: 'MODIS calibrado frente a VIIRS real, mes a mes',
      value: '',
      note: 'Años 2022–2026, que la calibración no vio. 1 es acuerdo perfecto',
    },
    {
      metric: 'validation.MODIS.holdout.daily_correlation',
      label: 'MODIS calibrado frente a VIIRS real, día a día',
      value: '',
      note: 'Años 2022–2026',
    },
    {
      metric: 'validation.MODIS.holdout.daily_p99_bias_pct',
      label: 'Diferencia en los días más extremos',
      value: '',
      note: 'Percentil 99 diario, años 2022–2026',
    },
  ];
  return rows
    .filter((row) => metrics[row.metric] !== undefined)
    .map(({ metric, ...row }) => ({ ...row, value: formatMetric(metric, metrics[metric]) }));
}

function formatMetric(metric: string, value: number): string {
  if (metric.endsWith('_pct')) {
    return signedPercent(value);
  }
  return metric.startsWith('jump.raw')
    ? `${formatDecimal(value, 1)} veces`
    : formatDecimal(value, metric.startsWith('jump') ? 2 : 3);
}
