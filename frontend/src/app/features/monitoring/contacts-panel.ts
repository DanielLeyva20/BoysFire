import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';

import { FireApi } from '../../core/api/fire-api';
import { RegionDetail } from '../../core/api/models';
import { ApiError, OpsApi } from '../../core/api/ops-api';
import { ContactKind, LocalContact } from '../../core/api/ops-models';

const SEARCH_DELAY_MS = 220;

/**
 * Responsables comunitarios y autoridades. Cada uno recibe un código para enlazar su
 * Telegram; las alertas de su zona (y de las zonas que contiene) le llegan a él.
 */
@Component({
  selector: 'app-contacts-panel',
  templateUrl: './contacts-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ContactsPanel {
  private readonly api = inject(OpsApi);
  private readonly fireApi = inject(FireApi);

  readonly refreshKey = input.required<number>();
  /** Región propuesta desde la lista de vigilancia. */
  readonly suggestedRegionId = input<number | null>(null);
  readonly changed = output<void>();

  protected readonly kinds: { value: ContactKind; label: string }[] = [
    { value: 'COMMUNITY', label: 'Responsable comunitario' },
    { value: 'AUTHORITY', label: 'Autoridad (bomberos, municipio…)' },
  ];

  protected readonly contacts = signal<LocalContact[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly created = signal<LocalContact | null>(null);
  protected readonly saving = signal(false);

  protected readonly fullName = signal('');
  protected readonly roleName = signal('');
  protected readonly kind = signal<ContactKind>('COMMUNITY');
  protected readonly phone = signal('');
  protected readonly region = signal<RegionDetail | null>(null);

  protected readonly searchText = signal('');
  private readonly debouncedSearch = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly matches = this.fireApi.regionSearch(this.debouncedSearch);
  private readonly suggested = this.fireApi.region(() => this.suggestedRegionId() ?? undefined);

  constructor() {
    effect(() => {
      this.refreshKey();
      untracked(() => void this.load());
    });
    effect(() => {
      const detail = this.suggested.value();
      if (detail) {
        untracked(() => this.region.set(detail));
      }
    });
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.debouncedSearch.set(text), SEARCH_DELAY_MS);
  }

  protected chooseRegion(detail: RegionDetail): void {
    this.region.set(detail);
    this.onSearch('');
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const region = this.region();
    if (!region || !this.fullName().trim() || !this.roleName().trim()) {
      this.error.set('Completa la zona, el nombre y el cargo.');
      return;
    }
    this.saving.set(true);
    try {
      const contact = await this.api.createContact({
        regionId: region.region.id,
        fullName: this.fullName().trim(),
        roleName: this.roleName().trim(),
        kind: this.kind(),
        phone: this.phone().trim() || undefined,
      });
      this.created.set(contact);
      this.contacts.update((contacts) => [contact, ...contacts]);
      this.fullName.set('');
      this.roleName.set('');
      this.phone.set('');
      this.error.set(null);
      this.changed.emit();
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo registrar.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async deactivate(contact: LocalContact): Promise<void> {
    if (!confirm(`¿Dar de baja a ${contact.fullName}? Dejará de recibir alertas.`)) {
      return;
    }
    try {
      await this.api.deactivateContact(contact.id);
      this.contacts.update((contacts) => contacts.filter((item) => item.id !== contact.id));
      this.changed.emit();
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudo dar de baja.');
    }
  }

  private async load(): Promise<void> {
    try {
      this.contacts.set(await this.api.contacts());
    } catch (failure) {
      this.error.set(failure instanceof ApiError ? failure.message : 'No se pudieron cargar los responsables.');
    } finally {
      this.loaded.set(true);
    }
  }
}
