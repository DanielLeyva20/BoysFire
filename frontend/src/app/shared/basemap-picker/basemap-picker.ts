import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';

import { BASEMAPS, BasemapId, basemapOf } from '../../features/map/basemaps';
import { Icon } from '../icon/icon';
import { AnchoredPopover } from '../popover/anchored-popover';

let nextId = 0;

/** Botón "Mapa: Satélite ▾" con la lista de mapas base. */
@Component({
  selector: 'app-basemap-picker',
  imports: [Icon, AnchoredPopover],
  templateUrl: './basemap-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class BasemapPicker {
  readonly value = model.required<BasemapId>();

  protected readonly options = BASEMAPS;
  protected readonly current = computed(() => basemapOf(this.value()));
  protected readonly sheetId = `basemap-sheet-${nextId++}`;

  protected choose(id: BasemapId, sheet: HTMLElement): void {
    this.value.set(id);
    sheet.hidePopover();
  }
}
