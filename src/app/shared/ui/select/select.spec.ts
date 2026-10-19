import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { vi } from 'vitest';
import { ThaSelect } from './select';
import { SelectOption, SelectSearch } from './select.models';

const ISLANDS: SelectOption[] = [
  { value: 'TF', label: 'Tenerife' },
  { value: 'GC', label: 'Gran Canaria' },
  { value: 'LP', label: 'La Palma' },
  { value: 'EH', label: 'El Hierro' },
];

@Component({
  imports: [ReactiveFormsModule, ThaSelect],
  template: `<tha-select
    fieldId="isla"
    label="Isla"
    [formControl]="control"
    [options]="options"
    [search]="search"
    [valueLabel]="valueLabel"
    [debounce]="0"
    [error]="error()"
    hint="Elige una isla"
  />`,
})
class Host {
  control = new FormControl<string | null>(null);
  options = ISLANDS;
  search: SelectSearch | null = null;
  valueLabel: string | null = null;
  error = signal<string | null>(null);
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

function setup(configure?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  configure?.(fixture.componentInstance);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const input = () => root.querySelector<HTMLInputElement>('input')!;
  const options = () => Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
  const key = async (name: string) => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    await settle(fixture);
  };
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);
  };
  return { fixture, host: fixture.componentInstance, root, input, options, key, type };
}

describe('ThaSelect', () => {
  it('sigue el patrón combobox: roles, lista y estado expandido', async () => {
    const { input, options, key, root } = setup();

    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('label')!.textContent).toContain('Isla');

    await key('ArrowDown');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[role="listbox"]')!.id).toBe(input().getAttribute('aria-controls'));
    expect(options().length).toBe(4);
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('filtra al escribir sin distinguir tildes ni mayúsculas', async () => {
    const { options, type } = setup();

    await type('CANARÍA');
    expect(options().map((o) => o.textContent!.trim())).toEqual(['Gran Canaria']);
    await type('la ');
    expect(options().map((o) => o.textContent!.trim())).toEqual(['La Palma']);
  });

  it('muestra «no hay resultados» cuando nada encaja', async () => {
    const { root, type, options } = setup();
    await type('zzz');
    expect(options().length).toBe(0);
    expect(root.querySelector('[role="status"]')!.textContent).toContain('No hay resultados');
  });

  it('flechas, Intro y Esc: elige con teclado y Esc deshace', async () => {
    const { host, input, options, key, type } = setup();

    await key('ArrowDown'); // abre
    await key('ArrowDown');
    await key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[2].id);
    await key('ArrowUp');
    await key('Enter');
    expect(host.control.value).toBe('GC');
    expect(input().value).toBe('Gran Canaria');
    expect(input().getAttribute('aria-expanded')).toBe('false');

    await type('hier');
    await key('Escape');
    expect(host.control.value).toBe('GC');
    expect(input().value).toBe('Gran Canaria');
  });

  it('Inicio y Fin saltan al primero y al último; Intro sin lista abierta no hace nada', async () => {
    const { host, input, options, key } = setup();
    await key('Enter');
    expect(host.control.value).toBeNull();

    await key('ArrowDown');
    await key('End');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[3].id);
    await key('Home');
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('elige con el ratón y marca la opción elegida', async () => {
    const { host, input, options, key, fixture } = setup();
    await key('ArrowDown');
    options()[1].click();
    await settle(fixture);
    expect(host.control.value).toBe('GC');
    expect(input().value).toBe('Gran Canaria');
  });

  it('muestra el valor que llega del formulario y lo borra al vaciar el texto', async () => {
    const { host, input, fixture, type } = setup();
    host.control.setValue('LP');
    await settle(fixture);
    expect(input().value).toBe('La Palma');

    await type('');
    input().dispatchEvent(new Event('blur'));
    await settle(fixture);
    expect(host.control.value).toBeNull();
    expect(input().value).toBe('');
  });

  it('enlaza el error y la ayuda con el campo', async () => {
    const { host, input, fixture, root } = setup();
    expect(input().getAttribute('aria-describedby')).toBe('isla-msg');
    expect(root.querySelector('#isla-msg')!.textContent).toContain('Elige una isla');

    host.error.set('Elige una isla.');
    fixture.detectChanges();
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#isla-msg')!.textContent).toContain('Elige una isla.');
  });

  it('respeta el estado deshabilitado del formulario', async () => {
    const { host, input, fixture } = setup();
    host.control.disable();
    await settle(fixture);
    expect(input().disabled).toBe(true);
  });

  describe('modo asíncrono', () => {
    const people: SelectOption[] = [
      { value: 1, label: 'Ana Pérez', hint: 'ana@example.org' },
      { value: 2, label: 'Luis Gil', hint: 'luis@example.org' },
    ];

    it('busca en el servidor al escribir y muestra la carga', async () => {
      let release: (o: SelectOption[]) => void = () => {};
      const search = vi.fn<SelectSearch>(() => new Promise((resolve) => (release = resolve)));
      const { input, options, root, type, fixture } = setup((h) => (h.search = search));

      await type('an');
      expect(search).toHaveBeenLastCalledWith('an');
      expect(root.querySelector('[role="status"]')!.textContent).toContain('Buscando');

      release(people);
      await settle(fixture);
      expect(options().length).toBe(2);
      expect(options()[0].textContent).toContain('ana@example.org');
      expect(input().getAttribute('aria-expanded')).toBe('true');
    });

    it('ignora respuestas antiguas que llegan tarde', async () => {
      const resolvers: Array<(o: SelectOption[]) => void> = [];
      const search = vi.fn<SelectSearch>(() => new Promise((resolve) => resolvers.push(resolve)));
      const { options, type, fixture } = setup((h) => (h.search = search));

      await type('a');
      await type('an');
      expect(resolvers.length).toBe(2);
      resolvers[1]([people[0]]);
      await settle(fixture);
      resolvers[0](people);
      await settle(fixture);
      expect(options().length).toBe(1);
    });

    it('sin resultados lo dice, y al elegir conserva la etiqueta', async () => {
      const search = vi.fn<SelectSearch>(async (q) => (q === 'ana' ? people : []));
      const { host, input, options, root, type, key, fixture } = setup((h) => (h.search = search));

      await type('nadie');
      expect(root.querySelector('[role="status"]')!.textContent).toContain('No hay resultados');

      await type('ana'); // al llegar los resultados, la primera opción queda activa
      await key('Enter');
      await settle(fixture);
      expect(host.control.value).toBe(1);
      expect(input().value).toBe('Ana Pérez');
      expect(options().length).toBe(0);
    });

    it('usa valueLabel para mostrar un valor que llega antes que la lista', async () => {
      const search = vi.fn<SelectSearch>(async () => people);
      const { host, input, fixture } = setup((h) => {
        h.search = search;
        h.valueLabel = 'Luis Gil';
      });
      host.control.setValue(2 as unknown as string);
      await settle(fixture);
      expect(input().value).toBe('Luis Gil');
    });
  });
});

