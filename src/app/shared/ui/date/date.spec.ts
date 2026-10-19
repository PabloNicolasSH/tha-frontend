import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ThaDate } from './date';

@Component({
  imports: [ReactiveFormsModule, ThaDate],
  template: `<tha-date
    fieldId="inicio"
    label="Fecha de inicio"
    [formControl]="control"
    [min]="min()"
    [max]="max()"
    [nativeControl]="native()"
  />`,
})
class Host {
  control = new FormControl<string | null>(null);
  min = signal<string | null>(null);
  max = signal<string | null>(null);
  native = signal<boolean | null>(false);
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
  fixture.detectChanges();
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const input = () => root.querySelector<HTMLInputElement>('input')!;
  const toggle = () => root.querySelector<HTMLButtonElement>('.th-date__toggle')!;
  const day = (iso: string) => root.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)!;
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);
  };
  const blur = async () => {
    input().dispatchEvent(new Event('blur'));
    await settle(fixture);
  };
  const press = async (target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    await settle(fixture);
  };
  const error = () => root.querySelector('.th-error')?.textContent?.trim() ?? null;
  return { fixture, host, root, input, toggle, day, type, blur, press, error };
}

describe('ThaDate', () => {
  it('lee dd/mm/aaaa y entrega al formulario la fecha en ISO', async () => {
    const { host, type } = setup();
    await type('05/10/2026');
    expect(host.control.value).toBe('2026-10-05');
    expect(host.control.valid).toBe(true);
  });

  it('muestra en el campo la fecha que llega del formulario', async () => {
    const { host, input, fixture } = setup();
    host.control.setValue('2026-10-05');
    await settle(fixture);
    expect(input().value).toBe('05/10/2026');
  });

  it('valida el formato al escribir: incompleto no molesta hasta salir del campo', async () => {
    const { host, type, blur, error } = setup();

    await type('05/10');
    expect(error()).toBeNull();
    expect(host.control.value).toBeNull();
    expect(host.control.errors).toEqual({ dateFormat: true });

    await blur();
    expect(error()).toBe('Escribe la fecha como dd/mm/aaaa.');

    await type('31/02/2026');
    expect(error()).toBe('Escribe la fecha como dd/mm/aaaa.');
    expect(host.control.value).toBeNull();

    await type('');
    expect(error()).toBeNull();
    expect(host.control.valid).toBe(true);
  });

  it('respeta la fecha mínima y la máxima', async () => {
    const { host, type, error, fixture } = setup();
    host.min.set('2026-10-01');
    host.max.set('2027-09-30');
    fixture.detectChanges();

    await type('30/09/2026');
    expect(error()).toBe('No puede ser anterior al 01/10/2026.');
    expect(host.control.errors).toEqual({ dateMin: true });
    expect(host.control.value).toBeNull();

    await type('01/10/2027');
    expect(error()).toBe('No puede ser posterior al 30/09/2027.');
    expect(host.control.errors).toEqual({ dateMax: true });

    await type('01/10/2026');
    expect(error()).toBeNull();
    expect(host.control.value).toBe('2026-10-01');
  });

  describe('calendario', () => {
    it('se abre con el botón, empieza la semana en lunes y está en español', async () => {
      const { host, toggle, root, day, fixture } = setup();
      host.control.setValue('2026-10-14');
      await settle(fixture);

      toggle().click();
      await settle(fixture);

      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(root.querySelector('[role="dialog"]')).not.toBeNull();
      expect(root.querySelector('.th-date__title')!.textContent).toContain('octubre de 2026');
      expect(Array.from(root.querySelectorAll('th')).map((th) => th.getAttribute('abbr'))[0]).toBe('lunes');
      expect(day('2026-10-14').getAttribute('aria-label')).toBe('miércoles, 14 de octubre de 2026');
      expect(day('2026-10-14').classList).toContain('is-selected');
      expect(day('2026-10-14').getAttribute('tabindex')).toBe('0');
      expect(day('2026-10-15').getAttribute('tabindex')).toBe('-1');
    });

    it('elegir un día rellena el campo y cierra el calendario', async () => {
      const { host, toggle, root, day, input, fixture } = setup();
      host.control.setValue('2026-10-14');
      await settle(fixture);
      toggle().click();
      await settle(fixture);

      day('2026-10-20').click();
      await settle(fixture);

      expect(host.control.value).toBe('2026-10-20');
      expect(input().value).toBe('20/10/2026');
      expect(root.querySelector('[role="dialog"]')).toBeNull();
    });

    it('se navega con el teclado: flechas, Inicio/Fin y cambio de mes', async () => {
      const { host, toggle, root, day, press, fixture } = setup();
      host.control.setValue('2026-10-14'); // miércoles
      await settle(fixture);
      toggle().click();
      await settle(fixture);
      const grid = root.querySelector<HTMLElement>('[role="grid"]')!;

      await press(grid, 'ArrowRight');
      expect(day('2026-10-15').getAttribute('tabindex')).toBe('0');
      await press(grid, 'ArrowDown');
      expect(day('2026-10-22').getAttribute('tabindex')).toBe('0');
      await press(grid, 'Home');
      expect(day('2026-10-19').getAttribute('tabindex')).toBe('0'); // lunes
      await press(grid, 'End');
      expect(day('2026-10-25').getAttribute('tabindex')).toBe('0'); // domingo
      await press(grid, 'PageDown');
      expect(root.querySelector('.th-date__title')!.textContent).toContain('noviembre de 2026');
      await press(grid, 'PageUp', { shiftKey: true });
      expect(root.querySelector('.th-date__title')!.textContent).toContain('noviembre de 2025');
    });

    it('Esc cierra el calendario y devuelve el foco al botón', async () => {
      const { toggle, root, press, fixture } = setup();
      toggle().click();
      await settle(fixture);

      await press(root.querySelector<HTMLElement>('[role="grid"]')!, 'Escape');
      expect(root.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement === toggle() || toggle().isConnected).toBe(true);
    });

    it('los días fuera del rango no se pueden elegir y las flechas no se salen de él', async () => {
      const { host, toggle, root, day, press, fixture } = setup();
      host.min.set('2026-10-10');
      host.max.set('2026-10-20');
      host.control.setValue('2026-10-15');
      fixture.detectChanges();
      await settle(fixture);
      toggle().click();
      await settle(fixture);

      expect(day('2026-10-09').disabled).toBe(true);
      expect(day('2026-10-21').disabled).toBe(true);
      expect(day('2026-10-10').disabled).toBe(false);

      const grid = root.querySelector<HTMLElement>('[role="grid"]')!;
      for (let i = 0; i < 10; i++) await press(grid, 'ArrowRight');
      expect(day('2026-10-20').getAttribute('tabindex')).toBe('0');
    });
  });

  it('en móvil usa el control nativo con mínimo y máximo', async () => {
    const { host, root, fixture } = setup();
    host.native.set(true);
    host.min.set('2026-10-01');
    host.max.set('2027-09-30');
    fixture.detectChanges();
    await settle(fixture);

    const input = root.querySelector<HTMLInputElement>('input')!;
    expect(input.type).toBe('date');
    expect(input.min).toBe('2026-10-01');
    expect(input.max).toBe('2027-09-30');
    expect(root.querySelector('.th-date__toggle')).toBeNull();

    input.value = '2026-12-24';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);
    expect(host.control.value).toBe('2026-12-24');
  });

  it('enlaza la ayuda y el error con el campo', async () => {
    const { input, root, type, blur } = setup();
    expect(input().getAttribute('aria-describedby')).toBe('inicio-msg');
    expect(root.querySelector('#inicio-msg')!.textContent).toContain('dd/mm/aaaa');

    await type('mal');
    await blur();
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#inicio-msg')!.classList).toContain('th-error');
  });
});
