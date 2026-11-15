import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { ApiError, OpsApi } from '../../core/api/ops-api';
import { AlertDetail, AlertSummary } from '../../core/api/ops-models';
import { formatPeruDateTime } from '../../core/domain/dates';
import { RISK_TO_LEVEL } from '../../core/domain/risk';
import { ALERT_STATUS_LEVEL, PENDING_ALERT_STATUSES } from './alert-labels';
import { AlertDetailView } from './alert-detail';

type Filter = 'pending' | 'confirmed' | 'closed' | 'all';

/** Lista de alertas a la izquierda y la alerta elegida, con sus acciones, a la derecha. */
@Component({
  selector: 'app-alerts-panel',
  imports: [AlertDetailView],
  templateUrl: './alerts-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class AlertsPanel {
  private readonly api = inject(OpsApi);

  readonly refreshKey = input.required<number>();
  readonly changed = output<void>();

  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'pending', label: 'Por atender' },
    { id: 'confirmed', label: 'Confirmadas' },
    { id: 'closed', label: 'Descartadas y cerradas' },
    { id: 'all', label: 'Todas' },
  ];
  protected readonly formatTime = formatPeruDateTime;
  protected readonly riskToLevel = RISK_TO_LEVEL;
  protected readonly statusLevel = ALERT_STATUS_LEVEL;

  protected readonly filter = signal<Filter>('pending');
  protected readonly alerts = signal<AlertSummary[]>([]);
  protected readonly loaded = signal(false);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly detail = signal<AlertDetail | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly visible = computed(() => this.alerts().filter((alert) => matches(alert, this.filter())));

  constructor() {
    effect(() => {
      this.refreshKey();
      untracked(() => void this.load());
    });
  }

  protected async select(alertId: number): Promise<void> {
    this.selectedId.set(alertId);
    try {
      this.detail.set(await this.api.alert(alertId));
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo abrir la alerta.');
    }
  }

  /** Tras una acción sobre la alerta se refresca la lista y el contador de la cabecera. */
  protected onUpdated(detail: AlertDetail): void {
    this.detail.set(detail);
    this.alerts.update((alerts) => alerts.map((alert) => (alert.id === detail.alert.id ? detail.alert : alert)));
    this.changed.emit();
  }

  private async load(): Promise<void> {
    try {
      this.alerts.set(await this.api.alerts());
      this.error.set(null);
      const selected = this.selectedId();
      if (selected !== null) {
        this.detail.set(await this.api.alert(selected));
      }
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudieron cargar las alertas.');
    } finally {
      this.loaded.set(true);
    }
  }
}

function matches(alert: AlertSummary, filter: Filter): boolean {
  switch (filter) {
    case 'pending':
      return PENDING_ALERT_STATUSES.includes(alert.status);
    case 'confirmed':
      return alert.status === 'CONFIRMED';
    case 'closed':
      return alert.status === 'DISMISSED' || alert.status === 'CLOSED';
    case 'all':
      return true;
  }
}
