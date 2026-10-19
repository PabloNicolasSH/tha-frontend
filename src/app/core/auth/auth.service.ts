import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AuthResponse,
  LoginResult,
  MfaChallenge,
  MfaCodeType,
  RegisterRequest,
  Role,
  SsoProvider,
  User,
} from './auth.models';

/**
 * Sesión del usuario.
 *
 * El access token (JWT de 15 min) vive solo en memoria: nunca en localStorage.
 * El refresh token viaja en una cookie HttpOnly que el navegador envía a /api/auth,
 * así que desde aquí no se ve ni se puede robar con JavaScript.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private token: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  get accessToken(): string | null {
    return this.token;
  }

  hasRole(...roles: Role[]): boolean {
    const mine = this.user()?.roles ?? [];
    return roles.some((r) => mine.includes(r));
  }

  /**
   * Paso 1: email y contraseña. Si la cuenta tiene segundo factor no hay sesión todavía:
   * se devuelve el desafío que hay que completar con {@link verifyMfa}.
   * `rememberMe` ("Mantener sesión iniciada") hace persistente la cookie del refresh token.
   */
  async login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse | MfaChallenge>('/api/auth/login', { email, password, rememberMe }),
    );
    if ('mfaRequired' in res) {
      return { kind: 'mfa', challenge: res };
    }
    this.apply(res);
    return { kind: 'session' };
  }

  /** Paso 2: el código de la app autenticadora, del correo o de recuperación abre la sesión. */
  async verifyMfa(mfaToken: string, type: MfaCodeType, code: string): Promise<void> {
    const res = await firstValueFrom(this.http.post<AuthResponse>('/api/auth/mfa/verify', { mfaToken, type, code }));
    this.apply(res);
  }

  /** "Reenviar código" por correo durante el inicio de sesión. */
  sendMfaEmailCode(mfaToken: string): Promise<unknown> {
    return firstValueFrom(this.http.post('/api/auth/mfa/email/send', { mfaToken }));
  }

  register(request: RegisterRequest): Promise<unknown> {
    return firstValueFrom(this.http.post('/api/auth/register', request));
  }

  /** ¿Sigue valiendo el enlace de invitación? (410 si ha caducado o ya se usó). */
  async isSetupLinkValid(token: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get('/api/auth/set-password/check', { params: { token } }));
      return true;
    } catch {
      return false;
    }
  }

  setPassword(token: string, password: string): Promise<unknown> {
    return firstValueFrom(this.http.post('/api/auth/set-password', { token, password }));
  }

  /** Proveedores SSO configurados; vacío si el SSO no está activado. */
  async ssoProviders(): Promise<SsoProvider[]> {
    try {
      return await firstValueFrom(this.http.get<SsoProvider[]>('/api/auth/sso/providers'));
    } catch {
      return [];
    }
  }

  /** Al arrancar la app: si hay cookie de refresh válida, recupera la sesión sin pedir la contraseña. */
  async restore(): Promise<void> {
    await this.refresh();
  }

  /**
   * Renueva el access token. Si varias peticiones fallan a la vez con 401 comparten una única
   * renovación: el refresh token rota en cada uso y una segunda llamada lo daría por robado.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= firstValueFrom(this.http.post<AuthResponse>('/api/auth/refresh', {}))
      .then((res) => {
        this.apply(res);
        return true;
      })
      .catch(() => {
        this.clear();
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.clear();
      await this.router.navigateByUrl('/entrar');
    }
  }

  private apply(res: AuthResponse): void {
    this.token = res.accessToken;
    this.user.set(res.user);
  }

  private clear(): void {
    this.token = null;
    this.user.set(null);
  }
}
