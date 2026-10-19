import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupsService, IslandOption, ScoutGroup } from '../../core/groups/groups.service';
import { rise } from '../../core/motion/motion';
import { Dialog } from '../../shared/ui/dialog/dialog.service';
import { ThaActions, ThaCell } from '../../shared/ui/table/table.directives';
import { ThaTable } from '../../shared/ui/table/table';
import { TableColumn } from '../../shared/ui/table/table.models';
import { Toast } from '../../shared/ui/toast/toast.service';

/** Listado de grupos scout: alta, edición, desactivación y borrado (solo si no tienen personas). */
@Component({
  selector: 'tha-admin-groups',
  imports: [ReactiveFormsModule, ThaTable, ThaCell, ThaActions],
  templateUrl: './admin-groups.html',
})
export class AdminGroups implements OnInit, AfterViewInit {
  private readonly service = inject(GroupsService);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(Toast);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rows = signal<ScoutGroup[]>([]);
  protected readonly islands = signal<IslandOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<number | null>(null);

  /** null: formulario cerrado · 'new': alta · identificador: edición de ese grupo. */
  protected readonly editing = signal<'new' | number | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    island: [''],
  });

  protected readonly formTitle = computed(() => (this.editing() === 'new' ? 'Nuevo grupo' : 'Editar grupo'));

  protected readonly columns: TableColumn<ScoutGroup>[] = [
    { key: 'name', header: 'Grupo', sortable: true, rowHeader: true, value: (g) => g.name },
    { key: 'island', header: 'Isla', sortable: true, value: (g) => this.islandName(g.island) },
    { key: 'email', header: 'Contacto', sortable: true, value: (g) => g.email },
    { key: 'members', header: 'Personas', sortable: true, numeric: true, value: (g) => g.members },
    { key: 'active', header: 'Estado', sortable: true, value: (g) => (g.active ? 'Activo' : 'Desactivado') },
  ];

  protected asGroup(row: unknown): ScoutGroup {
    return row as ScoutGroup;
  }

  protected islandName(code: string | null): string {
    return this.islands().find((i) => i.code === code)?.name ?? '';
  }

  async ngOnInit(): Promise<void> {
    try {
      const [groups, islands] = await Promise.all([this.service.list(), this.service.islands()]);
      this.islands.set(islands);
      this.rows.set(groups);
    } catch (e) {
      this.fail(e, 'No se han podido cargar los grupos.');
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewInit(): void {
    rise(this.host.nativeElement.querySelectorAll('[data-rise]'));
  }

  protected openNew(): void {
    this.form.reset({ name: '', email: '', island: '' });
    this.openForm('new');
  }

  protected openEdit(group: ScoutGroup): void {
    this.form.reset({ name: group.name, email: group.email ?? '', island: group.island ?? '' });
    this.openForm(group.id);
  }

  protected closeForm(): void {
    this.editing.set(null);
  }

  protected invalid(control: 'name' | 'email'): 'true' | null {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || this.submitted()) ? 'true' : null;
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const input = { name: value.name.trim(), email: value.email.trim() || null, island: value.island || null };
    const target = this.editing();
    this.saving.set(true);
    try {
      if (target === 'new') {
        const created = await this.service.create(input);
        this.rows.update((rows) => [...rows, created]);
        this.toast.success(`Grupo ${created.name} creado.`);
      } else if (target !== null) {
        this.replace(await this.service.update(target, input));
        this.toast.success('Cambios guardados.');
      }
      this.editing.set(null);
    } catch (e) {
      this.formError.set(this.message(e, 'No se han podido guardar los cambios.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleActive(group: ScoutGroup): Promise<void> {
    if (group.active) {
      const confirmed = await this.dialog.confirm({
        title: `¿Desactivar ${group.name}?`,
        text: 'Dejará de aparecer al solicitar una cuenta. Sus personas se conservan y puedes reactivarlo cuando quieras.',
        confirmLabel: 'Sí, desactivar',
        danger: true,
      });
      if (!confirmed) return;
    }
    await this.run(group, async () => {
      this.replace(await this.service.setActive(group.id, !group.active));
      this.toast.success(group.active ? `${group.name} desactivado.` : `${group.name} reactivado.`);
    });
  }

  protected async remove(group: ScoutGroup): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: `¿Borrar ${group.name}?`,
      text: 'Se eliminará del listado. No se puede deshacer.',
      confirmLabel: 'Sí, borrar',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(group, async () => {
      await this.service.remove(group.id);
      this.rows.update((rows) => rows.filter((r) => r.id !== group.id));
      this.toast.success(`${group.name} borrado.`);
    });
  }

  private openForm(target: 'new' | number): void {
    this.submitted.set(false);
    this.formError.set(null);
    this.editing.set(target);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLInputElement>('#group-name')?.focus());
  }

  private async run(group: ScoutGroup, action: () => Promise<void>): Promise<void> {
    this.busyId.set(group.id);
    try {
      await action();
    } catch (e) {
      this.fail(e, 'No se ha podido completar la acción.');
    } finally {
      this.busyId.set(null);
    }
  }

  private replace(updated: ScoutGroup): void {
    this.rows.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
  }

  private message(e: unknown, fallback: string): string {
    return e instanceof HttpErrorResponse && e.error?.detail ? String(e.error.detail) : fallback;
  }

  private fail(e: unknown, fallback: string): void {
    this.toast.error(this.message(e, fallback));
  }
}
