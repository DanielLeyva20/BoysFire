import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SelectionStore } from './core/state/selection-store';
import { RegionPicker } from './shared/region-picker/region-picker';

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RegionPicker],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col lg:h-dvh' },
})
export class App {
  protected readonly selection = inject(SelectionStore);

  protected readonly links: NavLink[] = [
    { path: '/', label: 'Mapa' },
    { path: '/calendario', label: 'Calendario' },
    { path: '/linea-de-tiempo', label: 'Línea de tiempo' },
    { path: '/estadisticas', label: 'Estadísticas' },
  ];
}
