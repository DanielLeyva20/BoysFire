import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ZoneRisk } from '../../core/api/risk-models';
import { formatLongDate, formatShortDate, formatWeekday } from '../../core/domain/dates';
import { formatDecimal, formatInteger } from '../../core/domain/format';
import { RISK_LABELS, RISK_TO_LEVEL, describeFactor } from '../../core/domain/risk';
import { Icon } from '../../shared/icon/icon';

/** El riesgo de una zona en un día: nivel, por qué y qué hacer. */
@Component({
  selector: 'app-zone-risk-sheet',
  imports: [Icon],
  templateUrl: './zone-risk-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ZoneRiskSheet {
  readonly risk = input.required<ZoneRisk>();

  protected readonly formatInteger = formatInteger;
  protected readonly formatDecimal = formatDecimal;

  protected readonly level = computed(() => RISK_TO_LEVEL[this.risk().level]);
  protected readonly levelLabel = computed(() => RISK_LABELS[this.risk().level]);
  protected readonly dayTitle = computed(() => `${formatWeekday(this.risk().date)} ${formatLongDate(this.risk().date)}`);
  protected readonly factors = computed(() =>
    this.risk().factors.map((factor) => ({ ...factor, detail: describeFactor(factor), dots: Array.from({ length: factor.points }) })),
  );
  protected readonly hotspotDate = computed(() => {
    const date = this.risk().hotspotDataDate;
    return date ? formatShortDate(date) : null;
  });
  /** Ancho de la barra de puntaje, en % del máximo. */
  protected readonly scoreWidth = computed(() => (this.risk().score / this.risk().maxScore) * 100);
}
