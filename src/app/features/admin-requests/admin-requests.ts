import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { AdminRequestsService } from '../../core/auth/admin-requests.service';
import { AccountRequest } from '../../core/auth/auth.models';
import { rise } from '../../core/motion/motion';

/** Bandeja de solicitudes de cuenta: la federación aprueba (y se envía el enlace) o rechaza. */
@Component({
  selector: 'tha-admin-requests',
  imports: [DatePipe],
  templateUrl: './admin-requests.html',
})
export class AdminRequests implements OnInit, AfterViewInit {
  private readonly service = inject(AdminRequestsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rows = signal<AccountRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<number | null>(null);
  protected readonly confirmingId = signal<number | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.rows.set(await this.service.list());
    } catch (e) {
      this.fail(e, 'No se han podido cargar las solicitudes.');
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }

  protected async approve(row: AccountRequest): Promise<void> {
    await this.run(row, async () => {
      const updated = await this.service.approve(row.id);
      this.replace(updated);
      this.message.set(`Aprobada. Hemos enviado a ${row.email} el enlace para crear su contraseña.`);
    });
  }

  protected async resend(row: AccountRequest): Promise<void> {
    await this.run(row, async () => {
      this.replace(await this.service.resendInvitation(row.id));
      this.message.set(`Enlace nuevo enviado a ${row.email}. El anterior ya no vale.`);
    });
  }

  protected async reject(row: AccountRequest): Promise<void> {
    await this.run(row, async () => {
      await this.service.reject(row.id);
      this.rows.update((rows) => rows.filter((r) => r.id !== row.id));
      this.message.set(`Solicitud de ${row.email} rechazada.`);
    });
  }

  private async run(row: AccountRequest, action: () => Promise<void>): Promise<void> {
    this.busyId.set(row.id);
    this.confirmingId.set(null);
    this.message.set(null);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.fail(e, 'No se ha podido completar la acción.');
    } finally {
      this.busyId.set(null);
    }
  }

  private replace(updated: AccountRequest): void {
    this.rows.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
  }

  private fail(e: unknown, fallback: string): void {
    this.error.set(e instanceof HttpErrorResponse && e.error?.detail ? String(e.error.detail) : fallback);
  }
}
