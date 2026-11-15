import { Directive, ElementRef, afterNextRender, effect, inject, input, output, DestroyRef } from '@angular/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { ECharts, EChartsCoreOption, init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// Solo se registran los tipos de gráfico que la aplicación usa.
use([
  BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent,
  DataZoomComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer,
]);

/**
 * Dibuja un gráfico de ECharts en el elemento y lo mantiene al día con `options`.
 * El elemento necesita una altura (por ejemplo, `class="h-80"`).
 */
@Directive({ selector: '[appChart]' })
export class Chart {
  readonly options = input.required<EChartsCoreOption>({ alias: 'appChart' });
  /** Índice del dato sobre el que se hizo clic. */
  readonly pointClick = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private chart: ECharts | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.chart = init(this.host);
      this.chart.setOption(this.options(), true);
      this.chart.on('click', (event) => this.pointClick.emit(event.dataIndex));

      const resizeObserver = new ResizeObserver(() => this.chart?.resize());
      resizeObserver.observe(this.host);
      destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        this.chart?.dispose();
      });
    });

    effect(() => {
      // Se leen siempre las opciones: así el efecto queda suscrito aunque el gráfico aún no exista.
      const options = this.options();
      this.chart?.setOption(options, true);
    });
  }
}
