export interface TableColumn<T> {
  /** Identificador de la columna; también es el nombre de la propiedad si no hay `value`. */
  key: string;
  header: string;
  sortable?: boolean;
  /** Cifras: se alinean a la derecha y con números tabulares. */
  numeric?: boolean;
  /** La celda que identifica la fila (p. ej. el nombre): se marca como encabezado de fila para lectores de pantalla. */
  rowHeader?: boolean;
  /** Cómo obtener el valor para mostrar, ordenar y buscar. Por defecto, la propiedad `key` de la fila. */
  value?: (row: T) => string | number | null | undefined;
}

export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  key: string;
  direction: SortDirection;
}

/** Lo que pide la tabla cuando cambia la página, el orden o la búsqueda (para cargar datos del servidor). */
export interface TableQuery {
  /** Empieza en 0. */
  page: number;
  size: number;
  sort: TableSort | null;
  search: string;
}
