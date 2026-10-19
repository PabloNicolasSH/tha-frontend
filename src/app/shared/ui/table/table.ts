import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, computed, contentChild, contentChildren, input, model, output } from '@angular/core';
import { ThaActions, ThaCell } from './table.directives';
import { SortDirection, TableColumn, TableQuery, TableSort } from './table.models';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Para buscar sin importar mayúsculas ni tildes ("maria" encuentra "María"). */
const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Tabla de datos con orden por columna, búsqueda, paginación y estados de carga, error y vacío.
 *
 * Dos modos:
 * - **Local** (por defecto): recibe todas las filas y ordena, busca y pagina ella misma.
 * - **Servidor** (`[serverSide]="true"`): recibe solo la página actual y el `total`, y avisa de los cambios
 *   de página, orden y búsqueda con `(queryChange)` para que quien la usa pida los datos.
 *
 * Accesible: encabezados asociados a las celdas, `aria-sort`, botones reales para ordenar y paginar. En pantallas
 * estrechas cada fila se ve como una tarjeta, sin desplazamiento horizontal de la página.
 *
 * Contenido propio con `<ng-template thaCell="clave" let-row>` y acciones con `<ng-template thaActions let-row>`.
 */
@Component({
  selector: 'tha-table',
  imports: [NgTemplateOutlet],
  templateUrl: './table.html',
})
export class ThaTable<T extends object> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  /** Nombre accesible de la tabla (lo anuncian los lectores de pantalla). */
  readonly label = input.required<string>();

  readonly serverSide = input(false);
  /** Solo en modo servidor: cuántas filas hay en total (no solo en esta página). */
  readonly total = input<number | undefined>(undefined);
  readonly loading = input(false);
  /** Mensaje de error: si existe, se muestra en lugar de los datos, con un botón para reintentar. */
  readonly error = input<string | null>(null);
  readonly searchable = input(false);
  readonly searchLabel = input('Buscar');
  readonly emptyTitle = input('No hay nada que mostrar');
  readonly emptyText = input('');
  readonly pageSizes = input([10, 25, 50]);

  readonly page = model(0);
  readonly pageSize = model(25);
  readonly sort = model<TableSort | null>(null);
  readonly search = model('');

  readonly queryChange = output<TableQuery>();
  readonly retry = output<void>();

  private readonly cells = contentChildren(ThaCell);
  protected readonly actions = contentChild(ThaActions);

  // ---------- Datos que se muestran ----------

  private readonly filtered = computed(() => {
    const text = normalize(this.search()).trim();
    if (this.serverSide() || !text) return this.rows();
    const cols = this.columns();
    return this.rows().filter((row) => cols.some((c) => normalize(this.valueOf(c, row)).includes(text)));
  });

  private readonly sorted = computed(() => {
    const sort = this.sort();
    if (this.serverSide() || !sort) return this.filtered();
    const col = this.columns().find((c) => c.key === sort.key);
    if (!col) return this.filtered();
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((rowA, rowB) => {
      const a = this.valueOf(col, rowA);
      const b = this.valueOf(col, rowB);
      // Los vacíos van siempre al final, tanto en orden ascendente como descendente
      if (a == null || a === '') return b == null || b === '' ? 0 : 1;
      if (b == null || b === '') return -1;
      return factor * this.compare(a, b);
    });
  });

  protected readonly visibleRows = computed(() => {
    if (this.serverSide()) return this.rows();
    const start = this.page() * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  protected readonly totalCount = computed(() =>
    this.serverSide() ? (this.total() ?? this.rows().length) : this.sorted().length,
  );

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));
  protected readonly firstShown = computed(() => (this.totalCount() === 0 ? 0 : this.page() * this.pageSize() + 1));
  protected readonly lastShown = computed(() => Math.min(this.totalCount(), (this.page() + 1) * this.pageSize()));
  protected readonly showPager = computed(() => this.totalCount() > Math.min(...this.pageSizes()));
  protected readonly skeleton = computed(() => Array.from({ length: Math.min(this.pageSize(), 5) }));

  // ---------- Plantillas y valores ----------

  protected cellTemplate(key: string): TemplateRef<{ $implicit: unknown }> | null {
    return this.cells().find((c) => c.column() === key)?.template ?? null;
  }

  protected display(column: TableColumn<T>, row: T): string {
    const value = this.valueOf(column, row);
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }

  protected ariaSort(column: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    const sort = this.sort();
    if (sort?.key !== column.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  private valueOf(column: TableColumn<T>, row: T): string | number | null | undefined {
    return column.value ? column.value(row) : ((row as Record<string, unknown>)[column.key] as string | number | null | undefined);
  }

  private compare(a: string | number, b: string | number): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return collator.compare(String(a), String(b));
  }

  // ---------- Acciones de la persona ----------

  protected toggleSort(column: TableColumn<T>): void {
    const current = this.sort();
    const direction: SortDirection = current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc';
    this.sort.set({ key: column.key, direction });
    this.page.set(0); // al cambiar el orden se vuelve a la primera página
    this.emitQuery();
  }

  protected goTo(page: number): void {
    const next = Math.min(Math.max(0, page), this.pageCount() - 1);
    if (next === this.page()) return;
    this.page.set(next);
    this.emitQuery();
  }

  protected setPageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.page.set(0);
    this.emitQuery();
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** La búsqueda espera 300 ms tras la última tecla para no pedir datos con cada letra. */
  protected onSearch(text: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.search.set(text);
      this.page.set(0);
      this.emitQuery();
    }, 300);
  }

  private emitQuery(): void {
    this.queryChange.emit({ page: this.page(), size: this.pageSize(), sort: this.sort(), search: this.search() });
  }
}
