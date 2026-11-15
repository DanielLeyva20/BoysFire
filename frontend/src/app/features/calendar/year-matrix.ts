import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input,
  output, signal, viewChild,
} from '@angular/core';

import { CalendarDay, IsoDate } from '../../core/api/models';
import { MONTH_ABBREVIATIONS, formatLongDate, isoOf, leapDayIndex, yearOf } from '../../core/domain/dates';
import { formatIndex } from '../../core/domain/format';
import { DAY_LEVEL_LABELS, Level, dayLevel } from '../../core/domain/intensity';
import { CHART_COLORS, CHART_FONT } from '../../shared/chart/chart-theme';

const DAYS_PER_ROW = 366;
const ROW_HEIGHT = 17;
const ROW_GAP = 1;
const HEADER_HEIGHT = 20;
const LABEL_WIDTH = 40;
/** Con menos ancho por día las celdas no se distinguen: la matriz se desplaza en horizontal. */
const MIN_DAY_WIDTH = 2.4;

const LEVEL_FILL: Record<Level, string> = {
  none: '#e6e9f0',
  low: CHART_COLORS.low,
  mid: CHART_COLORS.mid,
  high: CHART_COLORS.high,
};

interface Hover {
  day: CalendarDay;
  x: number;
  y: number;
}

/**
 * Todos los años a la vez: una fila por año y una columna por día del año. Se dibuja en un
 * lienzo porque son cerca de diez mil celdas. Las tablas de la página dan los mismos datos
 * en texto para lectores de pantalla.
 */
@Component({
  selector: 'app-year-matrix',
  templateUrl: './year-matrix.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block overflow-x-auto' },
})
export class YearMatrix {
  readonly days = input.required<CalendarDay[]>();
  readonly selectedYear = input.required<number>();
  readonly selectedDate = input<IsoDate | undefined>(undefined);
  readonly daySelect = output<IsoDate>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly width = signal(0);

  protected readonly hover = signal<Hover | undefined>(undefined);
  protected readonly hoverText = computed(() => {
    const day = this.hover()?.day;
    return day && {
      date: formatLongDate(day.date),
      detail: `${DAY_LEVEL_LABELS[dayLevel(day)]} · índice ${formatIndex(day.harmonizedIndex)}`,
    };
  });

  private readonly years = computed(() => [...new Set(this.days().map((day) => yearOf(day.date)))].sort((a, b) => a - b));
  private readonly dayByCell = computed(() => new Map(this.days().map((day) => [cellKey(yearOf(day.date), leapDayIndex(day.date)), day])));

  protected readonly height = computed(() => HEADER_HEIGHT + this.years().length * (ROW_HEIGHT + ROW_GAP));
  protected readonly canvasWidth = computed(() => Math.max(this.width(), LABEL_WIDTH + DAYS_PER_ROW * MIN_DAY_WIDTH));
  private readonly dayWidth = computed(() => (this.canvasWidth() - LABEL_WIDTH) / DAYS_PER_ROW);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => this.width.set(Math.floor(entry.contentRect.width)));
      observer.observe(this.host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    effect(() => this.draw());
  }

  protected onPointerMove(event: PointerEvent): void {
    const day = this.dayAt(event.offsetX, event.offsetY);
    this.hover.set(day && { day, x: event.offsetX, y: event.offsetY });
  }

  protected onClick(event: MouseEvent): void {
    const day = this.dayAt(event.offsetX, event.offsetY);
    if (day) {
      this.daySelect.emit(day.date);
    }
  }

  private dayAt(x: number, y: number): CalendarDay | undefined {
    const row = Math.floor((y - HEADER_HEIGHT) / (ROW_HEIGHT + ROW_GAP));
    const column = Math.floor((x - LABEL_WIDTH) / this.dayWidth());
    const year = this.years()[row];
    return year === undefined || column < 0 ? undefined : this.dayByCell().get(cellKey(year, column));
  }

  private draw(): void {
    const width = this.canvasWidth();
    const height = this.height();
    const years = this.years();
    const dayWidth = this.dayWidth();
    const cells = this.dayByCell();
    const selectedYear = this.selectedYear();
    const selectedDate = this.selectedDate();
    if (this.width() === 0) {
      return;
    }

    const canvas = this.canvas().nativeElement;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d')!;
    context.scale(scale, scale);
    context.clearRect(0, 0, width, height);
    context.textBaseline = 'middle';

    // Encabezado: los meses, con una marca fina donde empieza cada uno.
    context.font = `600 11px ${CHART_FONT}`;
    context.fillStyle = CHART_COLORS.ink2;
    MONTH_ABBREVIATIONS.forEach((month, monthIndex) => {
      const x = LABEL_WIDTH + leapDayIndex(isoOf(2000, monthIndex + 1, 1)) * dayWidth;
      context.fillText(month, x + 2, HEADER_HEIGHT / 2);
      context.fillRect(x, HEADER_HEIGHT - 4, 1, 4);
    });

    years.forEach((year, row) => {
      const y = HEADER_HEIGHT + row * (ROW_HEIGHT + ROW_GAP);
      const isSelected = year === selectedYear;
      context.font = `${isSelected ? 800 : 500} 11px ${CHART_FONT}`;
      context.fillStyle = isSelected ? CHART_COLORS.accent : CHART_COLORS.ink2;
      context.fillText(String(year), 2, y + ROW_HEIGHT / 2);

      for (let column = 0; column < DAYS_PER_ROW; column++) {
        const day = cells.get(cellKey(year, column));
        if (day) {
          context.fillStyle = LEVEL_FILL[dayLevel(day)];
          // Medio píxel de solape evita rayas blancas entre celdas de ancho fraccionario.
          context.fillRect(LABEL_WIDTH + column * dayWidth, y, dayWidth + 0.5, ROW_HEIGHT);
        }
      }
      if (isSelected) {
        context.strokeStyle = CHART_COLORS.accent;
        context.lineWidth = 2;
        context.strokeRect(LABEL_WIDTH - 1, y - 1, DAYS_PER_ROW * dayWidth + 2, ROW_HEIGHT + 2);
      }
    });

    if (selectedDate) {
      const row = years.indexOf(yearOf(selectedDate));
      if (row >= 0) {
        const x = LABEL_WIDTH + leapDayIndex(selectedDate) * dayWidth;
        const y = HEADER_HEIGHT + row * (ROW_HEIGHT + ROW_GAP);
        context.strokeStyle = CHART_COLORS.ink;
        context.lineWidth = 2;
        context.strokeRect(x - 2, y - 3, Math.max(dayWidth, 3) + 4, ROW_HEIGHT + 6);
      }
    }
  }
}

function cellKey(year: number, dayIndex: number): number {
  return year * 1000 + dayIndex;
}
