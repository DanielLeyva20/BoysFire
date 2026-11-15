import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';

import { FireApi } from '../../core/api/fire-api';
import { Region, RegionLevel } from '../../core/api/models';
import { SelectionStore } from '../../core/state/selection-store';
import { Icon } from '../icon/icon';
import { AnchoredPopover } from '../popover/anchored-popover';

const SEARCH_DELAY_MS = 220;

/** Qué se elige al bajar un nivel desde cada tipo de región. */
const CHILD_LEVEL_LABEL: Record<RegionLevel, string | null> = {
  COUNTRY: 'Departamentos',
  DEPARTMENT: 'Provincias',
  PROVINCE: 'Distritos',
  DISTRICT: null,
};

/**
 * Cadena país › departamento › provincia › distrito. Cada eslabón vuelve a ese nivel; el
 * botón final abre una hoja para bajar un nivel o buscar cualquier región por nombre.
 */
@Component({
  selector: 'app-region-picker',
  imports: [Icon, AnchoredPopover],
  templateUrl: './region-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
})
export class RegionPicker {
  private readonly api = inject(FireApi);
  protected readonly selection = inject(SelectionStore);

  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly searchField = viewChild.required<ElementRef<HTMLInputElement>>('searchField');

  protected readonly searchText = signal('');
  private readonly debouncedSearch = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly children = this.api.children(this.selection.regionId);
  protected readonly matches = this.api.regionSearch(this.debouncedSearch);

  protected readonly isSearching = computed(() => this.searchText().trim().length >= 2);
  protected readonly childLevelLabel = computed(() => {
    const level = this.selection.region()?.region.level;
    return level ? CHILD_LEVEL_LABEL[level] : null;
  });

  protected onSearchInput(text: string): void {
    this.searchText.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.debouncedSearch.set(text), SEARCH_DELAY_MS);
  }

  protected choose(region: Region): void {
    this.selection.selectRegion(region.id);
    this.sheet().nativeElement.hidePopover();
  }

  /** Al abrirse, el foco va al buscador; al cerrarse, la búsqueda se limpia. */
  protected onToggle(event: ToggleEvent): void {
    if (event.newState === 'open') {
      this.searchField().nativeElement.focus();
    } else {
      this.onSearchInput('');
    }
  }
}
