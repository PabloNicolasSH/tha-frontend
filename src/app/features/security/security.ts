import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MfaMethod, MfaStatus, RecoveryCodes, TotpSetup } from '../../core/auth/auth.models';
import { MfaService } from '../../core/auth/mfa.service';
import { rise } from '../../core/motion/motion';
import { PasswordField } from '../../shared/ui/password-field/password-field';

type Panel = null | 'totp' | 'email' | 'disable-TOTP' | 'disable-EMAIL' | 'regenerate';

/**
 * Seguridad de la cuenta: elegir el segundo factor (app autenticadora y/o código por correo),
 * ver el estado y gestionar los códigos de recuperación.
 */
@Component({
  selector: 'tha-security',
  imports: [ReactiveFormsModule, PasswordField],
  templateUrl: './security.html',
})
export class Security implements OnInit, AfterViewInit {
  private readonly mfa = inject(MfaService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly status = signal<MfaStatus | null>(null);
  protected readonly panel = signal<Panel>(null);
  protected readonly totpSetup = signal<TotpSetup | null>(null);
  /** Códigos de recuperación recién generados. Se muestran una sola vez. */
  protected readonly newCodes = signal<string[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected readonly code = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly passwordForm = inject(FormBuilder).nonNullable.group({ password: ['', Validators.required] });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }

  protected has(method: MfaMethod): boolean {
    return this.status()?.methods.includes(method) ?? false;
  }

  protected cancel(): void {
    this.panel.set(null);
    this.totpSetup.set(null);
    this.code.reset('');
    this.passwordForm.reset();
    this.error.set(null);
  }

  // ---------- App autenticadora ----------

  protected async startTotp(): Promise<void> {
    await this.run(async () => {
      this.totpSetup.set(await this.mfa.startTotpSetup());
      this.open('totp');
    });
  }

  protected async confirmTotp(): Promise<void> {
    await this.run(async () => {
      this.afterActivation(await this.mfa.confirmTotp(this.code.value.trim()), 'App autenticadora activada.');
    });
  }

  // ---------- Código por correo ----------

  protected async startEmail(): Promise<void> {
    await this.run(async () => {
      await this.mfa.startEmailEnable();
      this.open('email');
      this.notice.set('Te hemos enviado un código por correo para comprobar que llega.');
    });
  }

  protected async confirmEmail(): Promise<void> {
    await this.run(async () => {
      this.afterActivation(await this.mfa.confirmEmail(this.code.value.trim()), 'Código por correo activado.');
    });
  }

  // ---------- Desactivar, preferido y códigos de recuperación ----------

  protected ask(panel: Panel): void {
    this.open(panel);
  }

  protected async confirmDisable(method: MfaMethod): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    await this.run(async () => {
      await this.mfa.disable(method, this.passwordForm.getRawValue().password);
      this.cancel();
      await this.reload();
      this.notice.set(method === 'TOTP' ? 'App autenticadora desactivada.' : 'Código por correo desactivado.');
    });
  }

  protected async confirmRegenerate(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    await this.run(async () => {
      const result = await this.mfa.regenerateRecoveryCodes(this.passwordForm.getRawValue().password);
      this.cancel();
      this.newCodes.set(result.recoveryCodes);
      await this.reload();
    });
  }

  protected async setPreferred(method: MfaMethod): Promise<void> {
    await this.run(async () => {
      await this.mfa.setPreferred(method);
      await this.reload();
      this.notice.set('Método preferido actualizado.');
    });
  }

  protected async copyCodes(): Promise<void> {
    await navigator.clipboard.writeText((this.newCodes() ?? []).join('\n'));
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2500);
  }

  protected downloadCodes(): void {
    const text =
      'Códigos de recuperación de Tha\n' +
      'Cada código sirve una sola vez. Guárdalos en un lugar seguro.\n\n' +
      (this.newCodes() ?? []).join('\n') +
      '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tha-codigos-recuperacion.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async copySecret(): Promise<void> {
    const secret = this.totpSetup()?.secret;
    if (secret) {
      await navigator.clipboard.writeText(secret);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    }
  }

  // ---------- Internos ----------

  private afterActivation(result: RecoveryCodes, message: string): void {
    this.cancel();
    this.notice.set(message);
    if (result.recoveryCodes.length > 0) {
      this.newCodes.set(result.recoveryCodes); // primer método activado: se entregan los códigos de recuperación
    }
    void this.reload();
  }

  private open(panel: Panel): void {
    this.panel.set(panel);
    this.code.reset('');
    this.passwordForm.reset();
    this.error.set(null);
    if (panel !== 'email') {
      this.notice.set(null);
    }
  }

  private async reload(): Promise<void> {
    try {
      this.status.set(await this.mfa.status());
    } catch (e) {
      this.fail(e, 'No se ha podido cargar el estado de la seguridad.');
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.fail(e, 'No se ha podido completar la acción.');
    } finally {
      this.busy.set(false);
    }
  }

  private fail(e: unknown, fallback: string): void {
    this.error.set(e instanceof HttpErrorResponse && e.error?.detail ? String(e.error.detail) : fallback);
  }
}
