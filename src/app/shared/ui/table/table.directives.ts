import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Contenido propio de una celda: `<ng-template thaCell="status" let-row>…</ng-template>`.
 * El valor de `thaCell` es la `key` de la columna; `row` es la fila.
 */
@Directive({ selector: 'ng-template[thaCell]' })
export class ThaCell {
  readonly column = input.required<string>({ alias: 'thaCell' });
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}

/** Columna de acciones al final de cada fila: `<ng-template thaActions let-row>botones</ng-template>`. */
@Directive({ selector: 'ng-template[thaActions]' })
export class ThaActions {
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}
