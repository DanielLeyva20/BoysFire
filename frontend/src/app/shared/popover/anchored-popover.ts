import { Directive, ElementRef, inject, input } from '@angular/core';

const GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

/**
 * Coloca una hoja emergente nativa (`popover`) justo debajo de su botón al abrirse, sin
 * salirse de la pantalla. El navegador se encarga del resto: cerrar con Escape o al
 * hacer clic fuera, y dibujarla por encima de todo.
 */
@Directive({
  selector: '[appAnchoredPopover]',
  host: { '(beforetoggle)': 'onBeforeToggle($event)' },
})
export class AnchoredPopover {
  readonly anchor = input.required<HTMLElement>({ alias: 'appAnchoredPopover' });

  private readonly sheet = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected onBeforeToggle(event: ToggleEvent): void {
    if (event.newState !== 'open') {
      return;
    }
    const anchor = this.anchor().getBoundingClientRect();
    // Todavía no está visible: se mide tras mostrarse, en el siguiente cuadro.
    requestAnimationFrame(() => {
      const maxLeft = window.innerWidth - this.sheet.offsetWidth - VIEWPORT_MARGIN_PX;
      this.sheet.style.left = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.left, maxLeft))}px`;
    });
    this.sheet.style.left = `${anchor.left}px`;
    this.sheet.style.top = `${anchor.bottom + GAP_PX}px`;
  }
}
