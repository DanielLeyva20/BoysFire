import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';

import { MonitoringOverview } from '../../core/api/ops-models';
import { formatPeruDateTime } from '../../core/domain/dates';
import { RISK_LABELS, RISK_TO_LEVEL } from '../../core/domain/risk';
import { SelectionStore } from '../../core/state/selection-store';

/** Zonas de mayor riesgo en vigilancia y el resultado de cada revisión de los datos. */
@Component({
  selector: 'app-status-panel',
  templateUrl: './status-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class StatusPanel {
  private readonly router = inject(Router);
  private readonly selection = inject(SelectionStore);

  readonly overview = input.required<MonitoringOverview>();
  readonly registerContact = output<number>();

  protected readonly riskLabels = RISK_LABELS;
  protected readonly riskToLevel = RISK_TO_LEVEL;
  protected readonly formatTime = formatPeruDateTime;

  protected readonly problems = computed(() => this.overview().checks.filter((check) => check.status !== 'OK').length);

  protected viewZone(regionId: number): void {
    this.selection.selectRegion(regionId);
    void this.router.navigateByUrl('/prevencion');
  }
}
