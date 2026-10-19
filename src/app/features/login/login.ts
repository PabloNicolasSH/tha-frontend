import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MfaChallenge, MfaCodeType, SsoProvider } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { nudge, rise } from '../../core/motion/motion';
import { PasswordField } from '../../shared/ui/password-field/password-field';

/** Lo que se le cuenta a la persona cuando vuelve del proveedor SSO sin haber podido entrar. */
const SSO_MESSAGES: Record<string, string> = {
  'sin-cuenta':
    'Ese usuario no está vinculado a ninguna cuenta de Tha. La federación debe aprobar tu cuenta primero: solicítala o entra con tu email.',
  'cuenta-no-activa':
    'Tu cuenta todavía no está activa. Si te enviaron un enlace para crear tu contraseña, úsalo primero.',
  error: 'No se ha podido iniciar sesión con el proveedor. Inténtalo de nuevo.',
};

const CODE_LABELS: Record<MfaCodeType, string> = {
  TOTP: 'App autenticadora',
  EMAIL: 'Correo',
  RECOVERY: 'Recuperación',
};

@Component({
  selector: 'tha-login',
  imports: [ReactiveFormsModule, RouterLink, PasswordField],
  templateUrl: './login.html',
})
export class Login implements OnInit, AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false],
  });
  protected readonly code = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected readonly step = signal<'credentials' | 'mfa'>('credentials');
  protected readonly challenge = signal<MfaChallenge | null>(null);
  protected readonly codeType = signal<MfaCodeType>('TOTP');
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly providers = signal<SsoProvider[]>([]);
  protected readonly resendIn = signal(0);

  protected readonly codeLabels = CODE_LABELS;

  private emailCodeSent = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const sso = this.route.snapshot.queryParamMap.get('sso');
    if (sso) {
      this.error.set(SSO_MESSAGES[sso] ?? SSO_MESSAGES['error']);
    }
    if (this.route.snapshot.queryParamMap.get('contrasena') === 'creada') {
      this.notice.set('Contraseña creada. Ya puedes entrar.');
    }
    void this.auth.ssoProviders().then((p) => this.providers.set(p));
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }

  /** Los tipos de código disponibles: los métodos activados y, siempre, el de recuperación. */
  protected codeTypes(): MfaCodeType[] {
    return [...(this.challenge()?.methods ?? []), 'RECOVERY'];
  }

  // ---------- Paso 1: contraseña ----------

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const { email, password, rememberMe } = this.form.getRawValue();
      const result = await this.auth.login(email, password, rememberMe);
      if (result.kind === 'session') {
        await this.router.navigateByUrl('/');
        return;
      }
      this.startMfa(result.challenge);
    } catch (e) {
      this.fail(e, 'No se ha podido iniciar sesión. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  // ---------- Paso 2: segundo factor ----------

  private startMfa(challenge: MfaChallenge): void {
    this.challenge.set(challenge);
    this.codeType.set(challenge.preferredMethod);
    this.emailCodeSent = challenge.preferredMethod === 'EMAIL'; // el servidor ya lo envió al hacer login
    if (this.emailCodeSent) {
      this.startCooldown();
    }
    this.code.reset('');
    this.step.set('mfa');
    this.focusCode();
  }

  protected async chooseType(type: MfaCodeType): Promise<void> {
    this.codeType.set(type);
    this.code.reset('');
    this.error.set(null);
    this.focusCode();
    if (type === 'EMAIL' && !this.emailCodeSent) {
      await this.resend();
    }
  }

  protected onCodeInput(): void {
    if (this.codeType() === 'RECOVERY') {
      return;
    }
    // Solo dígitos, y al escribir el sexto se envía solo
    const digits = this.code.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== this.code.value) {
      this.code.setValue(digits, { emitEvent: false });
    }
    if (digits.length === 6) {
      void this.verify();
    }
  }

  protected async verify(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.code.invalid || this.busy()) {
      this.code.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.verifyMfa(challenge.mfaToken, this.codeType(), this.code.value.trim());
      await this.router.navigateByUrl('/');
    } catch (e) {
      // El token temporal dura 5 minutos: si caducó, se vuelve al principio
      if (e instanceof HttpErrorResponse && e.status === 401 && /caducado/i.test(String(e.error?.detail))) {
        this.backToCredentials();
      }
      this.fail(e, 'No se ha podido verificar el código.');
      this.code.reset('');
      this.focusCode();
    } finally {
      this.busy.set(false);
    }
  }

  protected async resend(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.resendIn() > 0) {
      return;
    }
    try {
      await this.auth.sendMfaEmailCode(challenge.mfaToken);
      this.emailCodeSent = true;
      this.startCooldown();
      this.notice.set('Te hemos enviado un código nuevo por correo.');
    } catch (e) {
      this.fail(e, 'No se ha podido enviar el código.');
    }
  }

  protected backToCredentials(): void {
    this.step.set('credentials');
    this.challenge.set(null);
    this.code.reset('');
    this.error.set(null);
    this.notice.set(null);
    this.stopTimer();
    this.resendIn.set(0);
  }

  // ---------- Internos ----------

  private startCooldown(): void {
    this.stopTimer();
    this.resendIn.set(30);
    this.timer = setInterval(() => {
      this.resendIn.update((s) => Math.max(0, s - 1));
      if (this.resendIn() === 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private focusCode(): void {
    setTimeout(() => this.codeInput()?.nativeElement.focus());
  }

  private fail(e: unknown, fallback: string): void {
    this.error.set(e instanceof HttpErrorResponse && e.error?.detail ? String(e.error.detail) : fallback);
    nudge(this.host.nativeElement.querySelector('form'));
  }
}
