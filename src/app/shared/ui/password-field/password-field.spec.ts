import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PasswordField } from './password-field';

@Component({
  imports: [ReactiveFormsModule, PasswordField],
  template: `<tha-password-field fieldId="pwd" label="Contraseña" [formControl]="control" hint="Mínimo 10 caracteres." [error]="error()" />`,
})
class Host {
  control = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  error = signal<string | null>(null);
}

describe('PasswordField', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      input: () => el.querySelector('input') as HTMLInputElement,
      toggle: () => el.querySelector('button') as HTMLButtonElement,
      el,
    };
  };

  it('empieza oculta y el botón la muestra y la vuelve a ocultar', () => {
    const { fixture, input, toggle } = setup();

    expect(input().type).toBe('password');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Mostrar contraseña');

    toggle().click();
    fixture.detectChanges();
    expect(input().type).toBe('text');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Ocultar contraseña');

    toggle().click();
    fixture.detectChanges();
    expect(input().type).toBe('password');
  });

  it('el botón no envía el formulario', () => {
    const { toggle } = setup();
    expect(toggle().type).toBe('button');
  });

  it('muestra al mostrar lo mismo que se escribió, sin perder el valor', () => {
    const { fixture, host, input, toggle } = setup();

    input().value = 'una-clave-larga';
    input().dispatchEvent(new Event('input'));
    expect(host.control.value).toBe('una-clave-larga');

    toggle().click();
    fixture.detectChanges();
    expect(input().value).toBe('una-clave-larga');
  });

  it('refleja en el campo los cambios que se hacen desde el formulario', () => {
    const { fixture, host, input } = setup();

    host.control.setValue('desde-codigo');
    fixture.detectChanges();

    expect(input().value).toBe('desde-codigo');
  });

  it('marca el campo como tocado al salir y se deshabilita con el formulario', () => {
    const { fixture, host, input } = setup();

    input().dispatchEvent(new Event('blur'));
    expect(host.control.touched).toBe(true);

    host.control.disable();
    fixture.detectChanges();
    expect(input().disabled).toBe(true);
  });

  it('enlaza el mensaje de error con el campo para lectores de pantalla', () => {
    const { fixture, host, input, el } = setup();

    expect(input().getAttribute('aria-describedby')).toBe('pwd-msg'); // la ayuda
    host.error.set('Escribe tu contraseña.');
    fixture.detectChanges();

    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#pwd-msg')?.textContent).toContain('Escribe tu contraseña.');
  });

  it('usa etiqueta flotante: placeholder vacío y etiqueta enlazada al campo', () => {
    const { input, el } = setup();
    const label = el.querySelector('label.th-float__label') as HTMLLabelElement;

    expect(input().getAttribute('placeholder')).toBe(' '); // lo necesita :placeholder-shown
    expect(label.textContent).toContain('Contraseña');
    expect(label.htmlFor).toBe('pwd');
    expect(label.previousElementSibling).toBe(input()); // el CSS flota la etiqueta con input + label
  });

  it('pide a los gestores de contraseñas el tipo de campo correcto', () => {
    const { input } = setup();
    expect(input().getAttribute('autocomplete')).toBe('current-password');
  });
});
