import { Injectable, computed, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  text?: string;
  /** Texto del botón principal. Por defecto "Aceptar". */
  confirmLabel?: string;
  /** Texto del botón secundario. Por defecto "Cancelar". */
  cancelLabel?: string;
  /** Acción destructiva: botón en rojo y el foco empieza en "Cancelar", no en la acción. */
  danger?: boolean;
}

export interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (accepted: boolean) => void;
}

/**
 * Confirmaciones modales: `if (await dialog.confirm({ title: '¿Eliminar?', danger: true })) { … }`.
 * Si se piden varias a la vez, se muestran una detrás de otra. El diálogo lo pinta `tha-dialog-host`.
 */
@Injectable({ providedIn: 'root' })
export class Dialog {
  private readonly queue = signal<PendingConfirm[]>([]);

  /** La confirmación que toca mostrar ahora. */
  readonly current = computed(() => this.queue()[0] ?? null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => this.queue.update((q) => [...q, { options, resolve }]));
  }

  /** La llama el host al decidir la persona: cumple la promesa y pasa a la siguiente de la cola. */
  settle(accepted: boolean): void {
    const [first, ...rest] = this.queue();
    this.queue.set(rest);
    first?.resolve(accepted);
  }
}
