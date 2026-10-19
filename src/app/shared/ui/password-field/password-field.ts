import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Campo de contraseña con botón para mostrarla u ocultarla. Funciona con formularios reactivos
 * (`formControlName`). Por defecto se muestra oculta; el botón lo anuncia con aria-pressed.
 */
@Component({
  selector: 'tha-password-field',
  templateUrl: './password-field.html',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordField), multi: true }],
})
export class PasswordField implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly fieldId = input.required<string>();
  /** "current-password" al entrar, "new-password" al crear una contraseña (los gestores la proponen/guardan). */
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);

  protected readonly visible = signal(false);
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected toggle(): void {
    this.visible.update((v) => !v);
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
