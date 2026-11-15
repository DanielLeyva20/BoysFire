import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Level } from '../../core/domain/intensity';

const ORDER: Level[] = ['low', 'mid', 'high'];

/** Leyenda de los tres niveles. Cada nivel lleva color y forma propios. */
@Component({
  selector: 'app-level-legend',
  templateUrl: './level-legend.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class LevelLegend {
  /** Texto de cada nivel; cambia según lo que se esté clasificando (días, focos, celdas). */
  readonly labels = input.required<Record<Level, string>>();
  /** Muestra también la marca rayada de "estimado". */
  readonly showEstimated = input(false);

  protected readonly entries = computed(() => ORDER.map((level) => ({ level, label: this.labels()[level] })));
}
