import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

import { ApiError, OpsApi } from '../../core/api/ops-api';
import { MonitoringOverview } from '../../core/api/ops-models';
import { OperatorSession } from '../../core/state/operator-session';
import { AlertsPanel } from './alerts-panel';
import { ContactsPanel } from './contacts-panel';
import { ReportsPanel } from './reports-panel';
import { StatusPanel } from './status-panel';

type Tab = 'alerts' | 'reports' | 'status' | 'contacts';

/** Cada cuánto se refrescan los datos del panel sin que el operador lo pida. */
const AUTO_REFRESH_MS = 60_000;

/**
 * Centro de monitoreo para operadores: alertas y su verificación, reportes de la comunidad,
 * estado de los datos con las zonas en vigilancia, y responsables de cada localidad.
 */
@Component({
  selector: 'app-monitoring-page',
  imports: [AlertsPanel, ReportsPanel, StatusPanel, ContactsPanel],
  templateUrl: './monitoring-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class MonitoringPage {
  private readonly api = inject(OpsApi);
  protected readonly session = inject(OperatorSession);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'alerts', label: 'Alertas' },
    { id: 'reports', label: 'Reportes comunitarios' },
    { id: 'status', label: 'Vigilancia y datos' },
    { id: 'contacts', label: 'Responsables' },
  ];

  protected readonly tab = signal<Tab>('alerts');
  protected readonly overview = signal<MonitoringOverview | null>(null);
  /** Cambia en cada refresco: los paneles lo escuchan para recargar sus datos. */
  protected readonly refreshKey = signal(0);
  protected readonly signingIn = signal(false);
  protected readonly accessError = signal<string | null>(null);
  /** Región que el panel de responsables debe proponer (desde la lista de vigilancia). */
  protected readonly suggestedRegionId = signal<number | null>(null);

  constructor() {
    if (this.session.signedIn()) {
      void this.load();
    }
    const timer = setInterval(() => {
      if (this.session.signedIn()) {
        void this.refresh();
      }
    }, AUTO_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected async signIn(event: Event, key: string): Promise<void> {
    event.preventDefault();
    if (!key.trim()) {
      this.accessError.set('Escribe la clave de operador.');
      return;
    }
    this.session.signIn(key);
    this.signingIn.set(true);
    await this.load();
    this.signingIn.set(false);
  }

  protected signOut(): void {
    this.session.signOut();
    this.overview.set(null);
  }

  protected async refresh(): Promise<void> {
    this.refreshKey.update((key) => key + 1);
    await this.load();
  }

  protected async runChecks(): Promise<void> {
    await this.api.runChecks();
    await this.refresh();
  }

  protected registerContactFor(regionId: number): void {
    this.suggestedRegionId.set(regionId);
    this.tab.set('contacts');
  }

  private async load(): Promise<void> {
    try {
      this.overview.set(await this.api.overview());
      this.accessError.set(null);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.status === 401 || failure.status === 503)) {
        this.session.signOut();
      }
      this.accessError.set(failure instanceof ApiError ? failure.message : 'No se pudo cargar el panel.');
    }
  }
}
