import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Destino al que el backend redirige tras el SSO. El backend ya dejó la cookie del refresh token; al arrancar,
 * la app intentó recuperar la sesión con ella. Aquí solo se decide a dónde ir.
 */
@Component({
  selector: 'tha-sso-complete',
  template: '<p class="auth__lead" role="status" style="padding: var(--s-7)">Entrando…</p>',
})
export class SsoComplete implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const ok = this.auth.isAuthenticated() || (await this.auth.refresh());
    await this.router.navigateByUrl(ok ? '/' : '/entrar?sso=error', { replaceUrl: true });
  }
}
