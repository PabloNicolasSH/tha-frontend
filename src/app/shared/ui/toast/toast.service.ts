import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** "leaving" mientras se anima su salida; después se elimina de la lista. */
  state: 'open' | 'leaving';
}

/** Cuántos avisos puede haber a la vez: al llegar uno más, el más antiguo se retira. */
export const MAX_TOASTS = 3;
/** A los cuántos milisegundos se cierra solo un aviso. */
export const TOAST_DURATION_MS = 5000;

interface Timer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

/**
 * Avisos breves de resultado: `toast.success('Solicitud aprobada')`.
 * Se apilan (máximo 3), se cierran solos a los 5 s y se pausan mientras la persona tiene el ratón encima o el foco dentro.
 * Los errores se anuncian a lectores de pantalla de forma asertiva (lo decide `tha-toast-host`).
 * Un aviso nunca es el único canal para algo crítico: ese dato también debe estar en pantalla.
 */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly items = signal<ToastItem[]>([]);

  private nextId = 1;
  private readonly timers = new Map<number, Timer>();

  success(message: string): number {
    return this.show('success', message);
  }

  error(message: string): number {
    return this.show('error', message);
  }

  info(message: string): number {
    return this.show('info', message);
  }

  /** Empieza a retirar un aviso: la interfaz anima la salida y después llama a {@link remove}. */
  dismiss(id: number): void {
    this.clearTimer(id);
    this.items.update((list) => list.map((t) => (t.id === id && t.state === 'open' ? { ...t, state: 'leaving' } : t)));
  }

  /** Lo elimina de la lista (tras la animación de salida). */
  remove(id: number): void {
    this.clearTimer(id);
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  /** Detiene la cuenta atrás (ratón encima o foco dentro). */
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle === null) return;
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  }

  /** Reanuda la cuenta atrás con el tiempo que quedaba. */
  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle !== null) return;
    this.arm(id, timer);
  }

  private show(kind: ToastKind, message: string): number {
    const id = this.nextId++;
    this.items.update((list) => {
      const open = list.filter((t) => t.state === 'open');
      // El más antiguo se retira cuando llega el cuarto
      const overflow = open.length + 1 - MAX_TOASTS;
      const retire = new Set(open.slice(0, Math.max(0, overflow)).map((t) => t.id));
      retire.forEach((rid) => this.clearTimer(rid));
      return [...list.map((t) => (retire.has(t.id) ? { ...t, state: 'leaving' as const } : t)), { id, kind, message, state: 'open' as const }];
    });
    const timer: Timer = { handle: null, remaining: TOAST_DURATION_MS, startedAt: 0 };
    this.timers.set(id, timer);
    this.arm(id, timer);
    return id;
  }

  private arm(id: number, timer: Timer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
  }
}
