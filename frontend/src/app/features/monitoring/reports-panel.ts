import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError, OpsApi } from '../../core/api/ops-api';
import { CommunityReport, ReportStatus } from '../../core/api/ops-models';
import { formatPeruDateTime } from '../../core/domain/dates';
import { formatCoordinates, formatDecimal } from '../../core/domain/format';
import { SelectionStore } from '../../core/state/selection-store';
import { REPORT_STATUS_LABELS } from './alert-labels';

/** Reportes de la comunidad: verificarlos, confirmarlos o descartarlos. */
@Component({
  selector: 'app-reports-panel',
  templateUrl: './reports-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ReportsPanel {
  private readonly api = inject(OpsApi);
  private readonly router = inject(Router);
  private readonly selection = inject(SelectionStore);

  readonly refreshKey = input.required<number>();
  readonly changed = output<void>();

  protected readonly statusLabels = REPORT_STATUS_LABELS;
  protected readonly formatTime = formatPeruDateTime;
  protected readonly formatCoordinates = formatCoordinates;
  protected readonly actions: { status: ReportStatus; label: string }[] = [
    { status: 'VERIFYING', label: 'Verificando' },
    { status: 'CONFIRMED', label: 'Confirmar' },
    { status: 'DISMISSED', label: 'Descartar' },
  ];

  protected readonly onlyPending = signal(true);
  protected readonly reports = signal<CommunityReport[]>([]);
  protected readonly loaded = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly visible = computed(() =>
    this.reports().filter((report) => !this.onlyPending() || report.status === 'RECEIVED' || report.status === 'VERIFYING'),
  );

  constructor() {
    effect(() => {
      this.refreshKey();
      untracked(() => void this.load());
    });
  }

  protected satelliteText(report: CommunityReport): string {
    return report.nearestHotspotKm === null
      ? 'Sin focos satelitales cerca'
      : `Foco satelital a ${formatDecimal(report.nearestHotspotKm, 1)} km`;
  }

  protected async changeStatus(report: CommunityReport, status: ReportStatus): Promise<void> {
    this.busyId.set(report.id);
    try {
      const updated = await this.api.changeReportStatus(report.id, status, '');
      this.reports.update((reports) => reports.map((item) => (item.id === updated.id ? updated : item)));
      this.changed.emit();
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo actualizar el reporte.');
    } finally {
      this.busyId.set(null);
    }
  }

  /** Abre la zona del reporte en la página de prevención. */
  protected viewZone(report: CommunityReport): void {
    if (report.regionId !== null) {
      this.selection.selectRegion(report.regionId);
      void this.router.navigateByUrl('/prevencion');
    }
  }

  private async load(): Promise<void> {
    try {
      this.reports.set(await this.api.reports());
      this.error.set(null);
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudieron cargar los reportes.');
    } finally {
      this.loaded.set(true);
    }
  }
}
