import { RiskLevel } from './risk-models';

/** Tipos de los reportes comunitarios y de la operación (/api/reports, /api/ops). */

export type ReportType = 'SMOKE' | 'VISIBLE_FIRE' | 'AGRICULTURAL_BURN' | 'OTHER';
export type ReportStatus = 'RECEIVED' | 'VERIFYING' | 'CONFIRMED' | 'DISMISSED';

export interface NewReport {
  type: ReportType;
  latitude: number;
  longitude: number;
  description?: string;
  reporterName?: string;
  reporterContact?: string;
}

export interface ReportReceipt {
  reportId: number;
  place: string | null;
  nearestHotspotKm: number | null;
  message: string;
}

export interface CommunityReport {
  id: number;
  type: ReportType;
  typeLabel: string;
  latitude: number;
  longitude: number;
  regionId: number | null;
  place: string | null;
  description: string | null;
  reporterName: string | null;
  reporterContact: string | null;
  status: ReportStatus;
  nearestHotspotKm: number | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export type AlertType = 'HIGH_RISK' | 'ACTIVE_FIRE' | 'COMMUNITY_REPORT';
export type AlertStatus = 'OPEN' | 'NOTIFIED' | 'VERIFYING' | 'CONFIRMED' | 'DISMISSED' | 'CLOSED';
export type ResponseType = 'RECEIVED' | 'VERIFYING' | 'CONFIRMED' | 'FALSE_ALARM';

export interface AlertSummary {
  id: number;
  type: AlertType;
  typeLabel: string;
  level: RiskLevel;
  title: string;
  regionId: number;
  place: string;
  status: AlertStatus;
  statusLabel: string;
  deliveries: number;
  responses: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AlertDelivery {
  id: number;
  contactId: number;
  contactName: string;
  roleName: string;
  channel: 'TELEGRAM' | 'SIMULATED';
  status: 'SENT' | 'FAILED' | 'SIMULATED';
  error: string | null;
  sentAtUtc: string;
}

export interface AlertResponse {
  id: number;
  contactId: number | null;
  contactName: string | null;
  response: ResponseType;
  responseLabel: string;
  channel: 'TELEGRAM' | 'PANEL';
  note: string | null;
  respondedAtUtc: string;
}

export interface AlertStatusChange {
  fromStatus: AlertStatus | null;
  toStatus: AlertStatus;
  actor: string;
  note: string | null;
  changedAtUtc: string;
}

export interface AlertDetail {
  alert: AlertSummary;
  message: string;
  reportId: number | null;
  deliveries: AlertDelivery[];
  responses: AlertResponse[];
  history: AlertStatusChange[];
}

export interface DispatchResult {
  sent: number;
  simulated: number;
  failed: number;
  alreadyNotified: number;
}

export type ContactKind = 'COMMUNITY' | 'AUTHORITY';

export interface LocalContact {
  id: number;
  regionId: number;
  place: string;
  fullName: string;
  roleName: string;
  kind: ContactKind;
  phone: string | null;
  telegramLinked: boolean;
  linkCode: string;
  /** Abre el bot con el código escrito; null si el bot no está configurado. */
  telegramLink: string | null;
}

export interface NewContact {
  regionId: number;
  fullName: string;
  roleName: string;
  kind: ContactKind;
  phone?: string;
}

export type CheckStatus = 'OK' | 'WARNING' | 'ERROR';

export interface CheckResult {
  code: string;
  title: string;
  status: CheckStatus;
  message: string;
  checkedAtUtc: string | null;
}

export interface WatchItem {
  regionId: number;
  place: string;
  level: RiskLevel;
  score: number;
  /** Responsables que recibirían una alerta de esta zona. */
  contacts: number;
}

export interface MonitoringOverview {
  checks: CheckResult[];
  watchlist: WatchItem[];
  counters: { pendingAlerts: number; pendingReports: number; activeContacts: number };
}
