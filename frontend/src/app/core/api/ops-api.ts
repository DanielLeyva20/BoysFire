import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import {
  AlertDetail,
  AlertStatus,
  AlertSummary,
  CommunityReport,
  DispatchResult,
  LocalContact,
  MonitoringOverview,
  NewContact,
  NewReport,
  ReportReceipt,
  ReportStatus,
  ResponseType,
} from './ops-models';

const OPS = '/api/ops';

/** Error de la API con su mensaje en español (campo `detail` de problem+json). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Reportes comunitarios (público) y operación (alertas, reportes, responsables, monitoreo).
 * La clave de operador la agrega {@link operatorKeyInterceptor}. Todas las llamadas son
 * promesas: son acciones puntuales del usuario, no datos que se mantienen al día solos.
 */
@Injectable({ providedIn: 'root' })
export class OpsApi {
  private readonly http = inject(HttpClient);

  submitReport(report: NewReport): Promise<ReportReceipt> {
    return this.call(this.http.post<ReportReceipt>('/api/reports', report));
  }

  overview(): Promise<MonitoringOverview> {
    return this.call(this.http.get<MonitoringOverview>(`${OPS}/monitoring`));
  }

  runChecks(): Promise<unknown> {
    return this.call(this.http.post(`${OPS}/monitoring/run`, {}));
  }

  alerts(status?: AlertStatus): Promise<AlertSummary[]> {
    return this.call(this.http.get<AlertSummary[]>(`${OPS}/alerts`, { params: status ? { status } : {} }));
  }

  alert(alertId: number): Promise<AlertDetail> {
    return this.call(this.http.get<AlertDetail>(`${OPS}/alerts/${alertId}`));
  }

  changeAlertStatus(alertId: number, status: AlertStatus, note: string): Promise<AlertDetail> {
    return this.call(this.http.patch<AlertDetail>(`${OPS}/alerts/${alertId}/status`, { status, note }));
  }

  recordResponse(alertId: number, response: ResponseType, contactId: number | null, note: string): Promise<AlertDetail> {
    return this.call(this.http.post<AlertDetail>(`${OPS}/alerts/${alertId}/responses`, { response, contactId, note }));
  }

  dispatch(alertId: number): Promise<DispatchResult> {
    return this.call(this.http.post<DispatchResult>(`${OPS}/alerts/${alertId}/dispatch`, {}));
  }

  reports(status?: ReportStatus): Promise<CommunityReport[]> {
    return this.call(this.http.get<CommunityReport[]>(`${OPS}/reports`, { params: status ? { status } : {} }));
  }

  changeReportStatus(reportId: number, status: ReportStatus, note: string): Promise<CommunityReport> {
    return this.call(this.http.patch<CommunityReport>(`${OPS}/reports/${reportId}`, { status, note }));
  }

  contacts(): Promise<LocalContact[]> {
    return this.call(this.http.get<LocalContact[]>(`${OPS}/contacts`));
  }

  createContact(contact: NewContact): Promise<LocalContact> {
    return this.call(this.http.post<LocalContact>(`${OPS}/contacts`, contact));
  }

  deactivateContact(contactId: number): Promise<unknown> {
    return this.call(this.http.delete(`${OPS}/contacts/${contactId}`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const detail = typeof error.error?.detail === 'string' ? error.error.detail : undefined;
    const fallback = error.status === 0 ? 'No hay conexión con la API.' : 'La operación no se pudo completar.';
    return new ApiError(detail ?? fallback, error.status);
  }
  return new ApiError('Ocurrió un error inesperado.', -1);
}
