export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  /** Texto secundario opcional (por ejemplo, el email de una persona). */
  hint?: string;
}

/** Búsqueda asíncrona para listas grandes: recibe lo escrito y devuelve las opciones que encajan. */
export type SelectSearch = (query: string) => Promise<SelectOption[]>;
