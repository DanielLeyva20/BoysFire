import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Trazos de cada icono sobre una cuadrícula de 20 × 20, todos con el mismo grosor. */
const ICON_PATHS = {
  'chevron-left': 'M12.5 4.5 7 10l5.5 5.5',
  'chevron-right': 'M7.5 4.5 13 10l-5.5 5.5',
  'chevron-down': 'M4.5 7.5 10 13l5.5-5.5',
  close: 'M5 5l10 10M15 5 5 15',
  search: 'M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12Zm4.5-1.5L17 17',
  layers: 'M10 3 3 7l7 4 7-4-7-4ZM3 11l7 4 7-4M3 14.5l7 4 7-4',
  play: 'M6.5 4.5v11l9-5.5-9-5.5Z',
  pause: 'M7 4.5v11M13 4.5v11',
  target: 'M10 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-14v3m0 10v3M2 10h3m10 0h3',
  arrow: 'M4 10h12m-4.5-4.5L16 10l-4.5 4.5',
  pin: 'M10 17.5s5.5-4.9 5.5-9a5.5 5.5 0 0 0-11 0c0 4.1 5.5 9 5.5 9Zm0-7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-none', 'aria-hidden': 'true' },
  templateUrl: './icon.html',
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => ICON_PATHS[this.name()]);
}
