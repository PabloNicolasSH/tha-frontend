import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { AdminRequestsService } from '../../core/auth/admin-requests.service';
import { AccountRequest } from '../../core/auth/auth.models';
import { rise } from '../../core/motion/motion';
import { Dialog } from '../../shared/ui/dialog/dialog.service';
import { Toast } from '../../shared/ui/toast/toast.service';

/** Bandeja de solicitudes de cuenta: la federación aprueba (y se envía el enlace) o rechaza. */
@Component({
  selector: 'tha-admin-requests',
  imports: [DatePipe],
  templateUrl: './admin-requests.html',
})
export class AdminRequests implements OnInit, AfterViewInit {
  private readonly service = inject(AdminRequestsService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(Toast);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rows = signal<AccountRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<number | null>(null);

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
      this.replace(await this.service.approve(row.id));
      this.toast.success(`Aprobada. Hemos enviado a ${row.email} el enlace para crear su contraseña.`);
    });
  }

  protected async resend(row: AccountRequest): Promise<void> {
    await this.run(row, async () => {
      this.replace(await this.service.resendInvitation(row.id));
      this.toast.success(`Enlace nuevo enviado a ${row.email}. El anterior ya no vale.`);
    });
  }

  protected async reject(row: AccountRequest): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: `¿Rechazar la solicitud de ${row.name}?`,
      text: `Se eliminará la solicitud de ${row.email}. Si más adelante quiere una cuenta, tendrá que volver a pedirla.`,
      confirmLabel: 'Sí, rechazar',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(row, async () => {
      await this.service.reject(row.id);
      this.rows.update((rows) => rows.filter((r) => r.id !== row.id));
      this.toast.success(`Solicitud de ${row.email} rechazada.`);
    });
  }

  private async run(row: AccountRequest, action: () => Promise<void>): Promise<void> {
    this.busyId.set(row.id);
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
    this.toast.error(e instanceof HttpErrorResponse && e.error?.detail ? String(e.error.detail) : fallback);
  }
}
