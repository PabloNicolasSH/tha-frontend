import { Component, ElementRef, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectOption, SelectSearch } from './select.models';

/** Quita tildes y mayúsculas para que «Canarias» se encuentre escribiendo «canarias» o «CANARÍAS». */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Selector con búsqueda al escribir (patrón ARIA *combobox* con lista). Dos modos:
 * - con `options`: filtra la lista que ya tiene;
 * - con `search`: pregunta al servidor (con espera de `debounce` ms) para listas grandes, como las personas.
 * Funciona con formularios reactivos (`formControlName`) y con la etiqueta flotante.
 *
 * Teclado: ↓/↑ mueven la selección (↓ abre la lista), Inicio/Fin saltan al primero/último, Intro elige, Esc cierra
 * y devuelve el texto al valor elegido, Tab cierra.
 */
@Component({
  selector: 'tha-select',
  templateUrl: './select.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ThaSelect), multi: true }],
})
export class ThaSelect implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly label = input.required<string>();
  readonly fieldId = input.required<string>();
  readonly options = input<SelectOption[]>([]);
  /** Si se indica, la lista se pide al servidor en vez de filtrar `options`. */
  readonly search = input<SelectSearch | null>(null);
  /** Etiqueta de la opción elegida cuando el valor llega antes que la lista (modo asíncrono). */
  readonly valueLabel = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly emptyText = input('No hay resultados');
  readonly loadingText = input('Buscando…');
  /** Milisegundos de espera tras escribir antes de preguntar al servidor. */
  readonly debounce = input(250);
  /** Permite dejar el campo vacío (valor nulo) borrando el texto. */
  readonly clearable = input(true);

  protected readonly open = signal(false);
  protected readonly query = signal('');
  /** Se ha escrito desde que se abrió: hasta entonces la lista se ve entera aunque haya algo elegido. */
  protected readonly typed = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly loading = signal(false);
  protected readonly remote = signal<SelectOption[]>([]);
  protected readonly disabled = signal(false);

  private readonly value = signal<SelectOption['value'] | null>(null);
  /** La última opción elegida, para conservar su etiqueta aunque la lista cambie. */
  private readonly chosen = signal<SelectOption | null>(null);
  private onChange: (value: SelectOption['value'] | null) => void = () => {};
  protected onTouched: () => void = () => {};
  private timer: ReturnType<typeof setTimeout> | undefined;
  private requestId = 0;

  protected readonly listId = computed(() => `${this.fieldId()}-list`);
  protected readonly messageId = computed(() => `${this.fieldId()}-msg`);

  protected readonly selected = computed<SelectOption | null>(() => {
    const value = this.value();
    if (value === null) return null;
    const chosen = this.chosen();
    if (chosen && chosen.value === value) return chosen;
    const found = this.options().find((o) => o.value === value);
    if (found) return found;
    const label = this.valueLabel();
    return label ? { value, label } : null;
  });

  protected readonly shown = computed<SelectOption[]>(() => {
    if (this.search()) return this.remote();
    if (!this.typed()) return this.options();
    const needle = normalize(this.query().trim());
    return needle ? this.options().filter((o) => normalize(`${o.label} ${o.hint ?? ''}`).includes(needle)) : this.options();
  });

  protected readonly text = computed(() => (this.typed() ? this.query() : (this.selected()?.label ?? '')));

  protected readonly activeId = computed(() => (this.open() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null));

  protected optionId(index: number): string {
    return `${this.fieldId()}-opt-${index}`;
  }

  protected isSelected(option: SelectOption): boolean {
    return this.value() === option.value;
  }

  // ---------- Eventos ----------

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.typed.set(true);
    this.show();
    this.activeIndex.set(this.search() ? -1 : this.shown().length > 0 ? 0 : -1);
    this.scheduleSearch();
  }

  protected onClick(): void {
    if (this.disabled()) return;
    this.open() ? this.close() : this.show();
  }

  protected onBlur(): void {
    this.onTouched();
    this.commitEmpty();
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.shown().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.show();
        else this.move(1, count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) this.show();
        else this.move(-1, count);
        break;
      case 'Home':
        if (this.open() && count > 0) {
          event.preventDefault();
          this.setActive(0);
        }
        break;
      case 'End':
        if (this.open() && count > 0) {
          event.preventDefault();
          this.setActive(count - 1);
        }
        break;
      case 'Enter':
        if (this.open()) {
          event.preventDefault();
          const option = this.shown()[this.activeIndex()];
          if (option) this.choose(option);
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation(); // dentro de un diálogo, Esc cierra solo la lista
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  protected choose(option: SelectOption): void {
    this.chosen.set(option);
    this.value.set(option.value);
    this.onChange(option.value);
    this.close();
  }

  // ---------- Lista ----------

  private show(): void {
    if (this.open() || this.disabled()) {
      this.scheduleSearch();
      return;
    }
    this.open.set(true);
    const selectedIndex = this.shown().findIndex((o) => o.value === this.value());
    this.activeIndex.set(selectedIndex >= 0 ? selectedIndex : this.search() ? -1 : this.shown().length > 0 ? 0 : -1);
    // Al abrir sin haber escrito se pide la lista inicial; si se abre escribiendo, la petición la programa onInput
    if (this.search() && !this.typed()) this.runSearch('');
    this.scrollToActive();
  }

  private close(): void {
    clearTimeout(this.timer);
    this.requestId++; // descarta respuestas que lleguen tarde
    this.loading.set(false);
    this.open.set(false);
    this.typed.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  private move(step: number, count: number): void {
    if (count === 0) return;
    const current = this.activeIndex();
    this.setActive(current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count);
  }

  private setActive(index: number): void {
    this.activeIndex.set(index);
    this.scrollToActive();
  }

  private scrollToActive(): void {
    queueMicrotask(() => {
      const id = this.activeId();
      if (id) this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  /** Si se borra todo el texto y se sale del campo, el valor pasa a nulo (si se permite). */
  private commitEmpty(): void {
    if (this.clearable() && this.typed() && this.query().trim() === '' && this.value() !== null) {
      this.chosen.set(null);
      this.value.set(null);
      this.onChange(null);
    }
  }

  private scheduleSearch(): void {
    if (!this.search()) return;
    clearTimeout(this.timer);
    this.loading.set(true);
    this.timer = setTimeout(() => this.runSearch(this.query()), this.debounce());
  }

  private async runSearch(query: string): Promise<void> {
    const search = this.search();
    if (!search) return;
    const id = ++this.requestId;
    this.loading.set(true);
    try {
      const results = await search(query);
      if (id !== this.requestId) return;
      this.remote.set(results);
      this.activeIndex.set(results.length > 0 ? 0 : -1);
    } catch {
      if (id !== this.requestId) return;
      this.remote.set([]);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  // ---------- ControlValueAccessor ----------

  writeValue(value: SelectOption['value'] | null): void {
    this.value.set(value ?? null);
  }
  registerOnChange(fn: (value: SelectOption['value'] | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
