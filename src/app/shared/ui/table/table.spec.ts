import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThaTable } from './table';
import { ThaActions, ThaCell } from './table.directives';
import { TableColumn, TableQuery } from './table.models';

interface Person {
  id: number;
  name: string;
  age: number | null;
  city: string | null;
}

const people = (...names: string[]): Person[] => names.map((name, i) => ({ id: i + 1, name, age: 20 + i, city: i % 2 ? 'Telde' : 'Arucas' }));

const COLUMNS: TableColumn<Person>[] = [
  { key: 'name', header: 'Nombre', sortable: true, rowHeader: true },
  { key: 'age', header: 'Edad', sortable: true, numeric: true },
  { key: 'city', header: 'Ciudad' },
];

@Component({
  imports: [ThaTable, ThaCell, ThaActions],
  template: `
    <tha-table
      label="Personas"
      [columns]="columns"
      [rows]="rows()"
      [serverSide]="serverSide()"
      [total]="total()"
      [loading]="loading()"
      [error]="error()"
      [searchable]="true"
      emptyTitle="Sin personas"
      emptyText="Todavía no hay nadie."
      (queryChange)="queries.push($event)"
      (retry)="retries = retries + 1"
    >
      <ng-template thaCell="city" let-row><em class="city">{{ $any(row).city }}!</em></ng-template>
      <ng-template thaActions let-row><button type="button" class="act">Ver {{ $any(row).name }}</button></ng-template>
    </tha-table>
  `,
})
class Host {
  columns = COLUMNS;
  rows = signal<Person[]>([]);
  serverSide = signal(false);
  total = signal<number | undefined>(undefined);
  loading = signal(false);
  error = signal<string | null>(null);
  queries: TableQuery[] = [];
  retries = 0;
}

async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

describe('ThaTable', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = () => fixture.nativeElement as HTMLElement;
  const headers = () => [...el().querySelectorAll('thead th')] as HTMLElement[];
  const header = (text: string) => headers().find((h) => h.textContent?.includes(text)) as HTMLElement;
  const rowNames = () => [...el().querySelectorAll('tbody tr')].map((r) => r.querySelector('th, td')?.textContent?.trim());
  const sortButton = (text: string) => header(text).querySelector('button') as HTMLButtonElement;
  const button = (text: string) => [...el().querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.rows.set(people('Zoe', 'Óscar', 'Ana', 'álvaro'));
    await flush(fixture);
  });

  // ---------- Estructura y accesibilidad ----------

  it('es una tabla con nombre, encabezados de columna y encabezado de fila', () => {
    expect(el().querySelector('table')?.getAttribute('aria-label')).toBe('Personas');
    expect(headers().slice(0, 3).every((h) => h.getAttribute('scope') === 'col')).toBe(true);
    expect(el().querySelector('tbody tr')?.firstElementChild?.tagName).toBe('TH'); // "Nombre" identifica la fila
    expect(el().querySelector('tbody tr th')?.getAttribute('scope')).toBe('row');
  });

  it('cada celda lleva su encabezado como etiqueta para la vista en tarjetas', () => {
    const cells = [...el().querySelectorAll('tbody tr:first-child > *')];
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['Nombre', 'Edad', 'Ciudad', null]);
  });

  it('las cifras se alinean como números y los vacíos se muestran como un guion', async () => {
    host.rows.set([{ id: 1, name: 'Ana', age: null, city: null }]);
    await flush(fixture);

    expect(header('Edad').classList).toContain('th-r');
    expect(el().querySelector('tbody td.th-r')?.textContent?.trim()).toBe('—');
  });

  it('acepta contenido propio por celda y una columna de acciones con encabezado accesible', () => {
    expect(el().querySelector('tbody em.city')?.textContent).toBe('Arucas!');
    expect(el().querySelectorAll('tbody button.act').length).toBe(4);
    expect(headers().at(-1)?.querySelector('.th-sr')?.textContent).toBe('Acciones');
  });

  // ---------- Orden ----------

  it('los encabezados ordenables son botones y los demás no llevan aria-sort', () => {
    expect(sortButton('Nombre')).toBeTruthy();
    expect(sortButton('Nombre').type).toBe('button');
    expect(header('Ciudad').querySelector('button')).toBeNull();
    expect(header('Ciudad').hasAttribute('aria-sort')).toBe(false);
    expect(header('Nombre').getAttribute('aria-sort')).toBe('none');
  });

  it('un clic ordena ascendente, el siguiente descendente, y se anuncia con aria-sort', async () => {
    sortButton('Nombre').click();
    await flush(fixture);
    expect(header('Nombre').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Edad').getAttribute('aria-sort')).toBe('none');

    sortButton('Nombre').click();
    await flush(fixture);
    expect(header('Nombre').getAttribute('aria-sort')).toBe('descending');
  });

  it('ordena con criterio español: sin distinguir tildes ni mayúsculas', async () => {
    sortButton('Nombre').click();
    await flush(fixture);
    expect(rowNames()).toEqual(['álvaro', 'Ana', 'Óscar', 'Zoe']);

    sortButton('Nombre').click();
    await flush(fixture);
    expect(rowNames()).toEqual(['Zoe', 'Óscar', 'Ana', 'álvaro']);
  });

  it('ordena las cifras como números (2 antes que 10) y deja los vacíos siempre al final', async () => {
    host.rows.set([
      { id: 1, name: 'a', age: 10, city: null },
      { id: 2, name: 'b', age: null, city: null },
      { id: 3, name: 'c', age: 2, city: null },
    ]);
    await flush(fixture);

    sortButton('Edad').click();
    await flush(fixture);
    expect(rowNames()).toEqual(['c', 'a', 'b']);

    sortButton('Edad').click();
    await flush(fixture);
    expect(rowNames()).toEqual(['a', 'c', 'b']); // el vacío sigue al final
  });

  // ---------- Búsqueda ----------

  it('busca sin importar mayúsculas ni tildes, tras una breve espera, y vuelve a la primera página', async () => {
    vi.useFakeTimers();
    try {
      host.rows.set(people('María', 'Marta', 'Luis'));
      await flush(fixture);

      const input = el().querySelector('input[type="search"]') as HTMLInputElement;
      input.value = 'MARIA';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(299);
      await flush(fixture);
      expect(rowNames().length).toBe(3); // aún no se ha aplicado

      vi.advanceTimersByTime(1);
      await flush(fixture);
      expect(rowNames()).toEqual(['María']);
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------- Paginación local ----------

  describe('paginación local', () => {
    beforeEach(async () => {
      host.rows.set(Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Persona ${String(i + 1).padStart(2, '0')}`, age: i, city: 'X' })));
      await flush(fixture);
    });

    it('muestra la primera página con su resumen y los controles', () => {
      expect(el().querySelector('.th-pager')?.textContent).toContain('1–25 de 30');
      expect(el().querySelectorAll('tbody tr').length).toBe(25);
      expect(button('Anterior').disabled).toBe(true);
      expect(button('Siguiente').disabled).toBe(false);
      expect(el().querySelector('nav.th-pager')?.getAttribute('aria-label')).toBe('Paginación de Personas');
    });

    it('navega a la página siguiente y vuelve a la anterior', async () => {
      button('Siguiente').click();
      await flush(fixture);

      expect(el().querySelector('.th-pager')?.textContent).toContain('26–30 de 30');
      expect(el().querySelector('.th-pager')?.textContent).toContain('Página 2 de 2');
      expect(rowNames().length).toBe(5);
      expect(button('Siguiente').disabled).toBe(true);

      button('Anterior').click();
      await flush(fixture);
      expect(rowNames().length).toBe(25);
    });

    it('cambiar las filas por página vuelve a la primera página', async () => {
      button('Siguiente').click();
      await flush(fixture);

      const select = el().querySelector('select') as HTMLSelectElement;
      select.value = '10';
      select.dispatchEvent(new Event('change'));
      await flush(fixture);

      expect(el().querySelectorAll('tbody tr').length).toBe(10);
      expect(el().querySelector('.th-pager')?.textContent).toContain('1–10 de 30');
    });

    it('cambiar el orden vuelve a la primera página', async () => {
      button('Siguiente').click();
      await flush(fixture);

      sortButton('Edad').click();
      await flush(fixture);

      expect(el().querySelector('.th-pager')?.textContent).toContain('1–25 de 30');
    });
  });

  it('no muestra la paginación si todo cabe en una página', () => {
    expect(el().querySelector('.th-pager')).toBeNull();
  });

  // ---------- Modo servidor ----------

  describe('modo servidor', () => {
    beforeEach(async () => {
      host.serverSide.set(true);
      host.rows.set(people('Zoe', 'Ana')); // solo la página actual
      host.total.set(120);
      await flush(fixture);
    });

    it('usa el total del servidor para la paginación y no reordena los datos', async () => {
      expect(el().querySelector('.th-pager')?.textContent).toContain('1–25 de 120');
      expect(el().querySelector('.th-pager')?.textContent).toContain('Página 1 de 5');

      sortButton('Nombre').click();
      await flush(fixture);
      expect(rowNames()).toEqual(['Zoe', 'Ana']); // el orden lo pone el servidor, no la tabla
    });

    it('avisa con la consulta completa al cambiar de orden o de página', async () => {
      sortButton('Nombre').click();
      await flush(fixture);
      button('Siguiente').click();
      await flush(fixture);

      expect(host.queries).toEqual([
        { page: 0, size: 25, sort: { key: 'name', direction: 'asc' }, search: '' },
        { page: 1, size: 25, sort: { key: 'name', direction: 'asc' }, search: '' },
      ]);
    });

    it('avisa de la búsqueda con la página reiniciada', async () => {
      vi.useFakeTimers();
      try {
        button('Siguiente').click();
        await flush(fixture);

        const input = el().querySelector('input[type="search"]') as HTMLInputElement;
        input.value = 'ana';
        input.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(300);

        expect(host.queries.at(-1)).toEqual({ page: 0, size: 25, sort: null, search: 'ana' });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ---------- Estados ----------

  it('mientras carga, muestra un esqueleto, marca la tabla como ocupada y lo anuncia', async () => {
    host.loading.set(true);
    await flush(fixture);

    expect(el().querySelector('table')?.getAttribute('aria-busy')).toBe('true');
    expect(el().querySelectorAll('tbody tr[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(el().querySelectorAll('.th-skeleton').length).toBeGreaterThan(0);
    expect(el().textContent).toContain('Cargando…');
    expect(el().querySelector('tbody em.city')).toBeNull(); // no se mezclan datos con el esqueleto
  });

  it('sin datos, muestra el estado vacío con su título y texto', async () => {
    host.rows.set([]);
    await flush(fixture);

    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelector('.th-empty h3')?.textContent).toBe('Sin personas');
    expect(el().querySelector('.th-empty p')?.textContent).toBe('Todavía no hay nadie.');
    expect(el().querySelector('.th-empty img')?.getAttribute('alt')).toBe('');
  });

  it('con un error, lo anuncia y ofrece reintentar', async () => {
    host.error.set('El servidor no responde.');
    await flush(fixture);

    const alert = el().querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('El servidor no responde.');
    expect(el().querySelector('table')).toBeNull();

    button('Reintentar').click();
    expect(host.retries).toBe(1);
  });
});
