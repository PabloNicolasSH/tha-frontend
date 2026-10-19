import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MfaMethod, MfaStatus, RecoveryCodes, TotpSetup } from './auth.models';

/** Gestión del segundo factor de quien ya tiene sesión ("Seguridad de la cuenta"). */
@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/auth/mfa';

  status(): Promise<MfaStatus> {
    return firstValueFrom(this.http.get<MfaStatus>(this.base));
  }

  startTotpSetup(): Promise<TotpSetup> {
    return firstValueFrom(this.http.post<TotpSetup>(`${this.base}/totp/setup`, {}));
  }

  confirmTotp(code: string): Promise<RecoveryCodes> {
    return firstValueFrom(this.http.post<RecoveryCodes>(`${this.base}/totp/confirm`, { code }));
  }

  /** Envía un código al correo para comprobar que funciona. */
  startEmailEnable(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/email/enable`, {}));
  }

  confirmEmail(code: string): Promise<RecoveryCodes> {
    return firstValueFrom(this.http.post<RecoveryCodes>(`${this.base}/email/confirm`, { code }));
  }

  /** Pide la contraseña para que una sesión robada no pueda quitar el segundo factor. */
  disable(method: MfaMethod, password: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/${method}/disable`, { password }));
  }

  regenerateRecoveryCodes(password: string): Promise<RecoveryCodes> {
    return firstValueFrom(this.http.post<RecoveryCodes>(`${this.base}/recovery-codes`, { password }));
  }

  setPreferred(method: MfaMethod): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.base}/preferred`, { method }));
  }
}
