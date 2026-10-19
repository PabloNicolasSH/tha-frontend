import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountRequest } from './auth.models';

/** Solicitudes de cuenta que gestiona la federación (administración y secretaría). */
@Injectable({ providedIn: 'root' })
export class AdminRequestsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin/account-requests';

  list(): Promise<AccountRequest[]> {
    return firstValueFrom(this.http.get<AccountRequest[]>(this.base));
  }

  /** Aprueba la solicitud y envía a la persona el enlace para crear su contraseña. */
  approve(id: number): Promise<AccountRequest> {
    return firstValueFrom(this.http.post<AccountRequest>(`${this.base}/${id}/approve`, {}));
  }

  /** Genera un enlace nuevo (el anterior deja de valer). */
  resendInvitation(id: number): Promise<AccountRequest> {
    return firstValueFrom(this.http.post<AccountRequest>(`${this.base}/${id}/resend-invitation`, {}));
  }

  reject(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
