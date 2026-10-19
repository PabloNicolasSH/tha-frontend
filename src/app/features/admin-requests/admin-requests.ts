import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { AdminRequestsService } from '../../core/auth/admin-requests.service';
import { AccountRequest } from '../../core/auth/auth.models';
import { PublicGroup, PublicListsService } from '../../core/groups/public-lists.service';
import { rise } from '../../core/motion/motion';
import { Dialog } from '../../shared/ui/dialog/dialog.service';
import { ThaActions, ThaCell } from '../../shared/ui/table/table.directives';
import { TableColumn } from '../../shared/ui/table/table.models';
import { ThaTable } from '../../shared/ui/table/table';
import { Toast } from '../../shared/ui/toast/toast.service';

/** Bandeja de solicitudes de cuenta: la federación aprueba (y se envía el enlace) o rechaza. */
@Component({
  selector: 'tha-admin-requests',
  imports: [DatePipe, ThaTable, ThaCell, ThaActions],
  templateUrl: './admin-requests.html',
})
export class AdminRequests implements OnInit, AfterViewInit {
  private readonly service = inject(AdminRequestsService);
  private readonly lists = inject(PublicListsService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(Toast);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rows = signal<AccountRequest[]>([]);
  protected readonly groups = signal<PublicGroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<number | null>(null);

  protected readonly columns: TableColumn<AccountRequest>[] = [
    { key: 'person', header: 'Persona', sortable: true, rowHeader: true, value: (r) => `${r.name} ${r.surname}` },
    { key: 'group', header: 'Grupo', sortable: true, value: (r) => r.scoutGroupName },
    { key: 'branch', header: 'Rama', sortable: true, value: (r) => r.branchName },
    { key: 'createdAt', header: 'Solicitada', sortable: true, numeric: true, value: (r) => r.createdAt },
    { key: 'status', header: 'Estado', sortable: true, value: (r) => (r.status === 'PENDING' ? 'Pendiente' : 'Enlace enviado') },
  ];

  /** Las plantillas de celda reciben la fila sin tipo; aquí se recupera. */
  protected asRequest(row: unknown): AccountRequest {
    return row as AccountRequest;
  }

  async ngOnInit(): Promise<void> {
    try {
      const [rows, groups] = await Promise.allSettled([this.service.list(), this.lists.groups()]);
      if (groups.status === 'fulfilled') this.groups.set(groups.value);
      if (rows.status === 'rejected') throw rows.reason;
      this.rows.set(rows.value);
    } catch (e) {
      this.fail(e, 'No se han podido cargar las solicitudes.');
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }

  /** Corrige el grupo antes de aprobar: la persona lo declara ella y quien aprueba lo verifica. */
  protected async changeGroup(row: AccountRequest, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const groupId = select.value ? Number(select.value) : null;
    await this.run(row, async () => {
      try {
        this.replace(await this.service.changeGroup(row.id, groupId));
        this.toast.success('Grupo actualizado.');
      } catch (e) {
        select.value = row.scoutGroupId === null ? '' : String(row.scoutGroupId); // vuelve al valor guardado
        throw e;
      }
    });
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
