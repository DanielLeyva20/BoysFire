import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError, OpsApi } from '../../core/api/ops-api';
import { AlertDetail, AlertStatus, ResponseType } from '../../core/api/ops-models';
import { formatPeruDateTime } from '../../core/domain/dates';
import { RISK_LABELS, RISK_TO_LEVEL } from '../../core/domain/risk';
import { ALERT_STATUS_LABELS, ALERT_STATUS_LEVEL, CHANNEL_LABELS, RESPONSE_LABELS } from './alert-labels';

/** Un hecho del registro de la alerta: cambio de estado, envío o respuesta. */
interface TimelineEntry {
  at: string;
  kind: 'status' | 'delivery' | 'response';
  title: string;
  detail: string | null;
}

interface StatusAction {
  status: AlertStatus;
  label: string;
  primary?: boolean;
}

/** Una alerta: qué se avisó, a quién, qué contestaron, y las acciones de coordinación. */
@Component({
  selector: 'app-alert-detail',
  templateUrl: './alert-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class AlertDetailView {
  private readonly api = inject(OpsApi);

  readonly detail = input.required<AlertDetail>();
  readonly updated = output<AlertDetail>();

  protected readonly statusActions: StatusAction[] = [
    { status: 'VERIFYING', label: 'En verificación' },
    { status: 'CONFIRMED', label: 'Confirmar emergencia', primary: true },
    { status: 'DISMISSED', label: 'Descartar' },
    { status: 'CLOSED', label: 'Cerrar' },
  ];
  protected readonly responseOptions = Object.entries(RESPONSE_LABELS) as [ResponseType, string][];
  protected readonly statusLabels = ALERT_STATUS_LABELS;
  protected readonly statusLevel = ALERT_STATUS_LEVEL;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly formatTime = formatPeruDateTime;

  protected readonly note = signal('');
  protected readonly responseType = signal<ResponseType>('RECEIVED');
  protected readonly responseContactId = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly level = computed(() => RISK_TO_LEVEL[this.detail().alert.level]);
  protected readonly levelLabel = computed(() => RISK_LABELS[this.detail().alert.level]);

  /** Personas a quienes se envió: entre ellas se elige quién respondió. */
  protected readonly recipients = computed(() => {
    const seen = new Map<number, string>();
    this.detail().deliveries.forEach((delivery) => seen.set(delivery.contactId, `${delivery.contactName} · ${delivery.roleName}`));
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  });

  protected readonly simulatedCount = computed(() => this.detail().deliveries.filter((delivery) => delivery.channel === 'SIMULATED').length);

  protected readonly timeline = computed<TimelineEntry[]>(() => {
    const detail = this.detail();
    const entries: TimelineEntry[] = [
      ...detail.history
        .filter((change) => change.fromStatus !== change.toStatus || change.note)
        .map((change) => ({
          at: change.changedAtUtc,
          kind: 'status' as const,
          title: change.fromStatus && change.fromStatus !== change.toStatus
            ? `${ALERT_STATUS_LABELS[change.fromStatus]} → ${ALERT_STATUS_LABELS[change.toStatus]} · ${change.actor}`
            : `${ALERT_STATUS_LABELS[change.toStatus]} · ${change.actor}`,
          detail: change.note,
        })),
      ...detail.deliveries.map((delivery) => ({
        at: delivery.sentAtUtc,
        kind: 'delivery' as const,
        title: `Enviada a ${delivery.contactName} (${delivery.roleName}) por ${CHANNEL_LABELS[delivery.channel] ?? delivery.channel}`,
        detail: delivery.error,
      })),
      ...detail.responses.map((response) => ({
        at: response.respondedAtUtc,
        kind: 'response' as const,
        title: `${response.contactName ?? 'Operador'} respondió: ${response.responseLabel} (${CHANNEL_LABELS[response.channel] ?? response.channel})`,
        detail: response.note,
      })),
    ];
    return entries.sort((a, b) => a.at.localeCompare(b.at));
  });

  protected changeStatus(status: AlertStatus): Promise<void> {
    return this.run(() => this.api.changeAlertStatus(this.detail().alert.id, status, this.note()),
      `Alerta marcada como «${ALERT_STATUS_LABELS[status]}».`);
  }

  protected recordResponse(): Promise<void> {
    return this.run(
      () => this.api.recordResponse(this.detail().alert.id, this.responseType(), this.responseContactId(), this.note()),
      'Respuesta registrada.',
    );
  }

  protected async dispatch(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.api.dispatch(this.detail().alert.id);
      const sentTo = result.sent + result.simulated + result.failed;
      this.message.set(sentTo === 0
        ? 'No hay responsables nuevos en esta zona. Regístralos en la pestaña Responsables.'
        : `Enviada a ${sentTo} responsable(s): ${result.sent} por Telegram, ${result.simulated} simulada(s), ${result.failed} con error.`);
      this.error.set(null);
      this.updated.emit(await this.api.alert(this.detail().alert.id));
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo enviar.');
    } finally {
      this.busy.set(false);
    }
  }

  private async run(action: () => Promise<AlertDetail>, success: string): Promise<void> {
    this.busy.set(true);
    try {
      const detail = await action();
      this.note.set('');
      this.message.set(success);
      this.error.set(null);
      this.updated.emit(detail);
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo completar la acción.');
    } finally {
      this.busy.set(false);
    }
  }
}
