import { Component, DestroyRef, ElementRef, effect, inject, input, model, output, viewChild } from '@angular/core';
import { enter, leave } from '../../../core/motion/motion';

let nextId = 0;
/** Cuántos diálogos hay abiertos: el desplazamiento del fondo solo se libera al cerrar el último. */
let openCount = 0;

const lockScroll = (): void => {
  openCount++;
  document.body.classList.add('th-scroll-locked');
};

const unlockScroll = (): void => {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.classList.remove('th-scroll-locked');
};

/**
 * Diálogo modal con contenido propio, sobre el elemento nativo {@code <dialog>}.
 *
 * Lo que da el navegador al abrirlo con showModal(): el foco queda atrapado dentro, el resto de la
 * página es inerte, Esc lo cierra y al cerrarse el foco vuelve al elemento que lo abrió.
 * Aquí se añade: título asociado, cierre con clic en el fondo, bloqueo del desplazamiento y animación.
 *
 * Uso: `<tha-dialog heading="Título" [(open)]="visible">contenido y acciones</tha-dialog>`.
 * Si algún elemento interior lleva `autofocus`, el navegador le da el foco al abrir.
 */
@Component({
  selector: 'tha-dialog',
  templateUrl: './dialog.html',
})
export class ThaDialog {
  readonly heading = input.required<string>();
  /** Si es false, ni Esc ni el clic en el fondo lo cierran (hay que usar una acción del diálogo). */
  readonly dismissible = input(true);
  readonly open = model(false);
  /** Se emite cuando el diálogo ya se ha cerrado del todo (tras la animación de salida). */
  readonly closed = output<void>();

  protected readonly titleId = `tha-dialog-title-${nextId++}`;
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  private shown = false;

  constructor() {
    // Si el componente se destruye con el diálogo abierto (p. ej. al cambiar de ruta), hay que liberar el bloqueo
    // del desplazamiento; si no, la página se quedaría sin scroll.
    inject(DestroyRef).onDestroy(() => {
      if (this.shown) {
        this.shown = false;
        unlockScroll();
      }
    });

    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (!el) return;
      if (this.open()) {
        this.show(el);
      } else {
        void this.hide(el);
      }
    });
  }

  private show(el: HTMLDialogElement): void {
    if (this.shown) return;
    this.shown = true;
    lockScroll();
    if (!el.open) el.showModal();
    const panel = this.panel()?.nativeElement;
    if (panel) enter(panel);
  }

  private async hide(el: HTMLDialogElement): Promise<void> {
    if (!this.shown) return;
    this.shown = false;
    const panel = this.panel()?.nativeElement;
    if (panel) await leave(panel);
    if (el.open) el.close();
    unlockScroll();
    this.closed.emit();
  }

  /** Esc: se anima la salida en lugar del cierre brusco del navegador. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    if (this.dismissible()) this.open.set(false);
  }

  /** Clic en el fondo: el propio <dialog> recibe el clic, no su contenido. */
  protected onClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement && this.dismissible()) this.open.set(false);
  }

  /** Por si el navegador lo cierra por su cuenta (p. ej. un formulario method="dialog"). */
  protected onNativeClose(): void {
    if (this.open()) this.open.set(false);
  }
}
