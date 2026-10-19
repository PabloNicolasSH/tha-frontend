import { Component, effect, inject, signal } from '@angular/core';
import { Dialog, PendingConfirm } from './dialog.service';
import { ThaDialog } from './dialog';

/** Se coloca una sola vez en la raíz de la aplicación y pinta las confirmaciones de `Dialog.confirm()`. */
@Component({
  selector: 'tha-dialog-host',
  imports: [ThaDialog],
  templateUrl: './dialog-host.html',
})
export class DialogHost {
  protected readonly dialog = inject(Dialog);

  /** La confirmación que está en pantalla (se mantiene hasta que termina la animación de salida). */
  protected readonly shown = signal<PendingConfirm | null>(null);
  protected readonly open = signal(false);

  private decided = false;

  constructor() {
    effect(() => {
      const next = this.dialog.current();
      if (next && !this.shown()) {
        this.decided = false;
        this.shown.set(next);
        this.open.set(true);
      }
    });
  }

  protected decide(accepted: boolean): void {
    if (this.decided) return;
    this.decided = true;
    this.dialog.settle(accepted);
    this.open.set(false);
  }

  /** Esc o clic en el fondo: cuenta como cancelar. */
  protected onOpenChange(open: boolean): void {
    this.open.set(open);
    if (!open) this.decide(false);
  }

  /** La animación de salida ha terminado: ya puede mostrarse la siguiente de la cola. */
  protected onClosed(): void {
    this.shown.set(null);
  }
}
