import { AlertStatus, ReportStatus, ResponseType } from '../../core/api/ops-models';
import { Level } from '../../core/domain/intensity';

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: 'Abierta',
  NOTIFIED: 'Notificada',
  VERIFYING: 'En verificación',
  CONFIRMED: 'Confirmada',
  DISMISSED: 'Descartada',
  CLOSED: 'Cerrada',
};

/** Color de cada estado: rojo pide atención, verde está resuelto. */
export const ALERT_STATUS_LEVEL: Record<AlertStatus, Level> = {
  OPEN: 'high',
  NOTIFIED: 'mid',
  VERIFYING: 'mid',
  CONFIRMED: 'high',
  DISMISSED: 'low',
  CLOSED: 'low',
};

export const PENDING_ALERT_STATUSES: readonly AlertStatus[] = ['OPEN', 'NOTIFIED', 'VERIFYING'];

export const RESPONSE_LABELS: Record<ResponseType, string> = {
  RECEIVED: 'Recibido',
  VERIFYING: 'Voy a verificar',
  CONFIRMED: 'Confirmo el incendio',
  FALSE_ALARM: 'Falsa alarma',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  RECEIVED: 'Recibido',
  VERIFYING: 'En verificación',
  CONFIRMED: 'Confirmado',
  DISMISSED: 'Descartado',
};

export const CHANNEL_LABELS: Record<string, string> = {
  TELEGRAM: 'Telegram',
  SIMULATED: 'Simulado',
  PANEL: 'Panel',
};
