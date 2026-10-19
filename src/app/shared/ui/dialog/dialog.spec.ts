import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThaDialog } from './dialog';
import { DialogHost } from './dialog-host';
import { Dialog } from './dialog.service';

/** jsdom no implementa showModal() ni close(): se simulan lo justo para comprobar la lógica. El foco atrapado y Esc son del navegador. */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

/** Deja que Angular procese efectos y promesas pendientes. */
async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

describe('Dialog.confirm() con DialogHost', () => {
  let fixture: ComponentFixture<DialogHost>;
  let dialog: Dialog;
  const el = () => fixture.nativeElement as HTMLElement;
  const dialogEl = () => el().querySelector('dialog') as HTMLDialogElement | null;
  const button = (text: string) =>
    [...el().querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

  beforeEach(async () => {
    document.body.classList.remove('th-scroll-locked');
    TestBed.configureTestingModule({ imports: [DialogHost] });
    fixture = TestBed.createComponent(DialogHost);
    dialog = TestBed.inject(Dialog);
    await flush(fixture);
  });

  it('no pinta nada hasta que alguien pide una confirmación', () => {
    expect(dialogEl()).toBeNull();
  });

  it('se abre como modal, con título asociado y el texto', async () => {
    void dialog.confirm({ title: '¿Eliminar?', text: 'No se puede deshacer.' });
    await flush(fixture);

    const d = dialogEl()!;
    expect(d.hasAttribute('open')).toBe(true);
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    const title = el().querySelector(`#${d.getAttribute('aria-labelledby')}`);
    expect(title?.textContent).toContain('¿Eliminar?');
    expect(el().textContent).toContain('No se puede deshacer.');
  });

  it('devuelve true al aceptar y false al cancelar', async () => {
    const accepted = dialog.confirm({ title: 'Uno', confirmLabel: 'Sí' });
    await flush(fixture);
    button('Sí').click();
    expect(await accepted).toBe(true);
    await flush(fixture);
    expect(dialogEl()).toBeNull(); // se retira tras cerrarse

    const cancelled = dialog.confirm({ title: 'Dos' });
    await flush(fixture);
    button('Cancelar').click();
    expect(await cancelled).toBe(false);
  });

  it('en una acción destructiva el botón rojo no tiene el foco inicial: lo tiene "Cancelar"', async () => {
    void dialog.confirm({ title: '¿Rechazar?', confirmLabel: 'Sí, rechazar', danger: true });
    await flush(fixture);

    expect(button('Cancelar').hasAttribute('autofocus')).toBe(true);
    expect(button('Sí, rechazar').hasAttribute('autofocus')).toBe(false);
    expect(button('Sí, rechazar').classList).toContain('th-btn--danger-solid');
  });

  it('en una confirmación normal el foco inicial es la acción principal', async () => {
    void dialog.confirm({ title: '¿Enviar?', confirmLabel: 'Enviar' });
    await flush(fixture);

    expect(button('Enviar').hasAttribute('autofocus')).toBe(true);
    expect(button('Cancelar').hasAttribute('autofocus')).toBe(false);
    expect(button('Enviar').classList).toContain('th-btn--primary');
  });

  it('Esc cancela, evitando el cierre brusco del navegador', async () => {
    const result = dialog.confirm({ title: '¿Seguro?' });
    await flush(fixture);

    const cancel = new Event('cancel', { cancelable: true });
    dialogEl()!.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(await result).toBe(false);
  });

  it('un clic en el fondo cancela; un clic dentro del diálogo no', async () => {
    const result = dialog.confirm({ title: '¿Seguro?' });
    await flush(fixture);

    el().querySelector('.th-dialog')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush(fixture);
    expect(dialogEl()).not.toBeNull(); // sigue abierto

    dialogEl()!.dispatchEvent(new MouseEvent('click')); // el objetivo es el propio <dialog>: el fondo
    expect(await result).toBe(false);
  });

  it('bloquea el desplazamiento del fondo mientras está abierto y lo libera al cerrar', async () => {
    const result = dialog.confirm({ title: '¿Seguro?' });
    await flush(fixture);
    expect(document.body.classList).toContain('th-scroll-locked');

    button('Cancelar').click();
    await result;
    await flush(fixture);
    expect(document.body.classList).not.toContain('th-scroll-locked');
  });

  it('si el diálogo se destruye estando abierto (p. ej. al cambiar de ruta), el desplazamiento se libera', async () => {
    void dialog.confirm({ title: '¿Seguro?' });
    await flush(fixture);
    expect(document.body.classList).toContain('th-scroll-locked');

    fixture.destroy();

    expect(document.body.classList).not.toContain('th-scroll-locked');
  });

  it('si se piden varias a la vez, se muestran una detrás de otra, en orden', async () => {
    const first = dialog.confirm({ title: 'Primera' });
    const second = dialog.confirm({ title: 'Segunda' });
    await flush(fixture);
    expect(el().textContent).toContain('Primera');
    expect(el().textContent).not.toContain('Segunda');

    button('Aceptar').click();
    expect(await first).toBe(true);
    await flush(fixture);
    expect(el().textContent).toContain('Segunda');

    button('Cancelar').click();
    expect(await second).toBe(false);
  });
});

@Component({
  imports: [ThaDialog],
  template: `
    <tha-dialog heading="Contenido propio" [dismissible]="dismissible()" [(open)]="open">
      <p id="custom">Cualquier contenido</p>
    </tha-dialog>
  `,
})
class CustomHost {
  open = signal(true);
  dismissible = signal(true);
}

describe('tha-dialog con contenido propio', () => {
  let fixture: ComponentFixture<CustomHost>;
  const dialogEl = () => (fixture.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CustomHost] });
    fixture = TestBed.createComponent(CustomHost);
    await flush(fixture);
  });

  it('muestra el contenido proyectado bajo el título', () => {
    expect(dialogEl().textContent).toContain('Contenido propio');
    expect(dialogEl().querySelector('#custom')?.textContent).toContain('Cualquier contenido');
    expect(dialogEl().hasAttribute('open')).toBe(true);
  });

  it('Esc lo cierra si es descartable', async () => {
    dialogEl().dispatchEvent(new Event('cancel', { cancelable: true }));
    await flush(fixture);

    expect(fixture.componentInstance.open()).toBe(false);
    expect(dialogEl().hasAttribute('open')).toBe(false);
  });

  it('con dismissible=false, Esc y el clic en el fondo no lo cierran', async () => {
    fixture.componentInstance.dismissible.set(false);
    await flush(fixture);

    dialogEl().dispatchEvent(new Event('cancel', { cancelable: true }));
    dialogEl().dispatchEvent(new MouseEvent('click'));
    await flush(fixture);

    expect(fixture.componentInstance.open()).toBe(true);
    expect(dialogEl().hasAttribute('open')).toBe(true);
  });

  it('se puede volver a abrir y cerrar desde fuera', async () => {
    fixture.componentInstance.open.set(false);
    await flush(fixture);
    expect(dialogEl().hasAttribute('open')).toBe(false);

    fixture.componentInstance.open.set(true);
    await flush(fixture);
    expect(dialogEl().hasAttribute('open')).toBe(true);
  });
});
