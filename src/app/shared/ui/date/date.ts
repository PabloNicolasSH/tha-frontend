import { Component, ElementRef, computed, effect, forwardRef, inject, input, signal } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import {
  CalendarDay, MONTHS, WEEKDAYS, addDays, addMonths, clamp, describe, formatSpanish, isValidIso, monthGrid, parseSpanish,
  todayIso, weekdayIndex,
} from './date-utils';

/**
 * Selector de fecha: campo de texto `dd/mm/aaaa` con calendario desplegable (semana en lunes, en español).
 * El valor del formulario es el texto ISO `aaaa-mm-dd` (o nulo si está vacío o no es válido) y el propio campo
 * informa de los errores (`dateFormat`, `dateMin`, `dateMax`). En móvil (puntero táctil) usa el control nativo del
 * sistema, que ya trae teclado numérico y calendario.
 *
 * Teclado en el calendario: flechas ±1 día / ±1 semana, Inicio/Fin principio y fin de semana, RePág/AvPág ±1 mes
 * (con Mayús, ±1 año), Intro elige, Esc cierra y devuelve el foco al campo.
 */
@Component({
  selector: 'tha-date',
  templateUrl: './date.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ThaDate), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => ThaDate), multi: true },
  ],
})
export class ThaDate implements ControlValueAccessor, Validator {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly label = input.required<string>();
  readonly fieldId = input.required<string>();
  /** Fecha mínima y máxima, en ISO (`aaaa-mm-dd`). */
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly hint = input<string | null>(null);
  /** Error propio del formulario; si no hay, se muestra el de formato o rango del campo. */
  readonly error = input<string | null>(null);
  /** Fuerza el control nativo (`true`) o el propio (`false`); por defecto, según el dispositivo. */
  readonly nativeControl = input<boolean | null>(null);

  protected readonly weekdays = WEEKDAYS;
  protected readonly text = signal('');
  protected readonly value = signal<string | null>(null);
  protected readonly touched = signal(false);
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  protected readonly focusIso = signal(todayIso());
  protected readonly viewYear = computed(() => Number(this.focusIso().slice(0, 4)));
  protected readonly viewMonth = computed(() => Number(this.focusIso().slice(5, 7)));
  protected readonly title = computed(() => `${MONTHS[this.viewMonth() - 1]} de ${this.viewYear()}`);
  protected readonly grid = computed<CalendarDay[][]>(() => monthGrid(this.viewYear(), this.viewMonth()));
  protected readonly today = todayIso();

  protected readonly native = computed(
    () => this.nativeControl() ?? (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches),
  );

  private onChange: (value: string | null) => void = () => {};
  private onValidatorChange: () => void = () => {};

  constructor() {
    // Los errores dependen del texto y del rango: cuando cambian, el formulario debe volver a validar
    effect(() => {
      this.problem();
      this.text();
      this.onValidatorChange();
    });
  }
  protected onTouched: () => void = () => {};

  /** Texto del error del campo: el del formulario, o el de formato o rango de lo escrito. */
  protected readonly message = computed<string | null>(() => {
    const external = this.error();
    if (external) return external;
    const code = this.problem();
    if (code === 'dateFormat') return 'Escribe la fecha como dd/mm/aaaa.';
    if (code === 'dateMin') return `No puede ser anterior al ${formatSpanish(this.min())}.`;
    if (code === 'dateMax') return `No puede ser posterior al ${formatSpanish(this.max())}.`;
    return null;
  });

  protected readonly helper = computed(() => this.hint() ?? 'Formato dd/mm/aaaa');
  protected readonly messageId = computed(() => `${this.fieldId()}-msg`);
  protected readonly dialogId = computed(() => `${this.fieldId()}-calendar`);

  /** Qué le pasa a lo escrito (si algo); el formato solo se señala al salir del campo o al completar la fecha. */
  private readonly problem = computed<'dateFormat' | 'dateMin' | 'dateMax' | null>(() => {
    const raw = this.text().trim();
    if (!raw) return null;
    const iso = this.native() ? this.value() : parseSpanish(raw);
    if (!iso) return this.touched() || raw.length >= 10 ? 'dateFormat' : null;
    return this.rangeProblem(iso);
  });

  private rangeProblem(iso: string): 'dateMin' | 'dateMax' | null {
    if (this.min() && iso < this.min()!) return 'dateMin';
    if (this.max() && iso > this.max()!) return 'dateMax';
    return null;
  }

  // ---------- Campo de texto ----------

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.text.set(raw);
    const iso = parseSpanish(raw);
    const valid = iso !== null && this.rangeProblem(iso) === null;
    this.commit(valid ? iso : null);
    if (iso) this.focusIso.set(clamp(iso, this.min(), this.max()));
  }

  protected onBlur(): void {
    this.touched.set(true);
    this.onTouched();
  }

  protected onNativeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value; // ya viene en ISO o vacío
    this.text.set(raw);
    const valid = isValidIso(raw) && this.rangeProblem(raw) === null;
    this.commit(valid ? raw : null);
  }

  private commit(value: string | null): void {
    if (value === this.value()) return;
    this.value.set(value);
    this.onChange(value);
  }

  // ---------- Calendario ----------

  protected toggle(): void {
    if (this.disabled()) return;
    this.open() ? this.close(true) : this.openCalendar();
  }

  private openCalendar(): void {
    const start = this.value() ?? clamp(todayIso(), this.min(), this.max());
    this.focusIso.set(start);
    this.open.set(true);
    this.focusDay();
  }

  protected close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('.th-date__toggle')?.focus());
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.open() && !(next && this.host.nativeElement.contains(next))) this.close(false);
  }

  protected shiftMonth(step: number): void {
    this.focusIso.set(clamp(addMonths(this.focusIso(), step), this.min(), this.max()));
  }

  protected isDisabled(iso: string): boolean {
    return this.rangeProblem(iso) !== null;
  }

  protected tabindex(day: CalendarDay): number {
    return day.iso === this.focusIso() ? 0 : -1;
  }

  protected label_(iso: string): string {
    return describe(iso);
  }

  protected pick(iso: string): void {
    if (this.isDisabled(iso)) return;
    this.text.set(formatSpanish(iso));
    this.touched.set(true);
    this.commit(iso);
    this.close(true);
  }

  protected onGridKeydown(event: KeyboardEvent): void {
    const current = this.focusIso();
    let next: string | null = null;
    switch (event.key) {
      case 'ArrowLeft': next = addDays(current, -1); break;
      case 'ArrowRight': next = addDays(current, 1); break;
      case 'ArrowUp': next = addDays(current, -7); break;
      case 'ArrowDown': next = addDays(current, 7); break;
      case 'Home': next = addDays(current, -weekdayIndex(current)); break;
      case 'End': next = addDays(current, 6 - weekdayIndex(current)); break;
      case 'PageUp': next = addMonths(current, event.shiftKey ? -12 : -1); break;
      case 'PageDown': next = addMonths(current, event.shiftKey ? 12 : 1); break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // dentro de un diálogo, Esc cierra solo el calendario
        this.close(true);
        return;
      default:
        return;
    }
    event.preventDefault();
    this.focusIso.set(clamp(next, this.min(), this.max()));
    this.focusDay();
  }

  private focusDay(): void {
    queueMicrotask(() => setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-iso="${this.focusIso()}"]`)?.focus()));
  }

  // ---------- ControlValueAccessor y Validator ----------

  writeValue(value: string | null): void {
    const iso = value && isValidIso(value) ? value : null;
    this.value.set(iso);
    this.text.set(iso ? (this.native() ? iso : formatSpanish(iso)) : '');
    if (iso) this.focusIso.set(clamp(iso, this.min(), this.max()));
  }
  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    const code = this.problem();
    if (code) return { [code]: true };
    // Texto a medias: todavía no es un error de formato visible, pero el formulario no debe darlo por bueno
    return this.text().trim() && this.value() === null ? { dateFormat: true } : null;
  }
}
