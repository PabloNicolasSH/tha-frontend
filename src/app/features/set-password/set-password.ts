import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { nudge, rise } from '../../core/motion/motion';
import { PasswordField } from '../../shared/ui/password-field/password-field';

const sameAs = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

/**
 * Crear la contraseña con el enlace que llega por correo al aprobarse la cuenta.
 * El token se lee de la URL y se quita de ella enseguida, para que no quede en el historial ni en capturas.
 */
@Component({
  selector: 'tha-set-password',
  imports: [ReactiveFormsModule, RouterLink, PasswordField],
  templateUrl: './set-password.html',
})
export class SetPassword implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private token = '';

  protected readonly state = signal<'checking' | 'invalid' | 'form'>('checking');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(100)]],
      confirm: ['', Validators.required],
    },
    { validators: sameAs },
  );

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    // Fuera de la URL cuanto antes (replaceUrl: tampoco queda en el historial de navegación)
    await this.router.navigate([], { replaceUrl: true, queryParams: {} });

    const valid = this.token !== '' && (await this.auth.isSetupLinkValid(this.token));
    this.state.set(valid ? 'form' : 'invalid');
    queueMicrotask(() => rise(this.host.nativeElement.querySelectorAll('[data-rise]')));
  }

  protected get passwordError(): string | null {
    const c = this.form.controls.password;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Escribe una contraseña.';
    if (c.hasError('minlength')) return 'Debe tener al menos 10 caracteres.';
    return null;
  }

  protected get confirmError(): string | null {
    const c = this.form.controls.confirm;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Repite la contraseña.';
    if (this.form.hasError('mismatch')) return 'Las contraseñas no coinciden.';
    return null;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.setPassword(this.token, this.form.getRawValue().password);
      await this.router.navigate(['/entrar'], { queryParams: { contrasena: 'creada' }, replaceUrl: true });
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 410) {
        this.state.set('invalid'); // caducó o ya se usó mientras escribía
        return;
      }
      this.error.set(
        e instanceof HttpErrorResponse && e.error?.detail ? e.error.detail : 'No se ha podido guardar la contraseña.',
      );
      nudge(this.host.nativeElement.querySelector('form'));
    } finally {
      this.busy.set(false);
    }
  }
}
