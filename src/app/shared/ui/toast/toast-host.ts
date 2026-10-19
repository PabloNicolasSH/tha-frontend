import { AfterViewInit, Component, ElementRef, effect, inject, input } from '@angular/core';
import { enter, leave } from '../../../core/motion/motion';
import { Toast, ToastItem } from './toast.service';

/** Un aviso. Anima su entrada y, cuando el servicio lo marca como "leaving", su salida. */
@Component({
  selector: 'tha-toast-item',
  templateUrl: './toast-item.html',
  host: { style: 'display: block' }, // un bloque, para poder animar su transformación
})
export class ToastItemView implements AfterViewInit {
  readonly item = input.required<ToastItem>();
  protected readonly toast = inject(Toast);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private leaving = false;

  constructor() {
    effect(() => {
      if (this.item().state === 'leaving' && !this.leaving) {
        this.leaving = true;
        void leave(this.host.nativeElement).then(() => this.toast.remove(this.item().id));
      }
    });
  }

  ngAfterViewInit(): void {
    enter(this.host.nativeElement, { y: 12, scale: 1 });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.toast.dismiss(this.item().id);
  }
}

/**
 * Zona de avisos, una sola vez en la raíz de la aplicación. Es una región con nombre; los errores se anuncian
 * con role="alert" (asertivo) y el resto con role="status" (cortés).
 */
@Component({
  selector: 'tha-toast-host',
  imports: [ToastItemView],
  templateUrl: './toast-host.html',
})
export class ToastHost {
  protected readonly toast = inject(Toast);
}
