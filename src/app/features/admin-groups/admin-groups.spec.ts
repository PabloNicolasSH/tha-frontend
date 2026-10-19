import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GroupsService, ScoutGroup } from '../../core/groups/groups.service';
import { Dialog } from '../../shared/ui/dialog/dialog.service';
import { AdminGroups } from './admin-groups';

const bentaya: ScoutGroup = {
  id: 1, name: 'Bentaya', email: null, island: null, active: true, members: 0, createdAt: '2026-10-19T10:00:00Z',
};
const conGente: ScoutGroup = { ...bentaya, id: 2, name: 'Teide', island: 'TENERIFE', members: 4 };

/** Deja que terminen las promesas del componente y vuelve a pintar. */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

describe('AdminGroups', () => {
  let service: { list: ReturnType<typeof vi.fn>; islands: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; setActive: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { list: vi.fn().mockResolvedValue([bentaya, conGente]), islands: vi.fn().mockResolvedValue([{ code: 'TENERIFE', name: 'Tenerife' }]), create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: GroupsService, useValue: service }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(AdminGroups);
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  const buttons = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const byText = (root: HTMLElement, text: string) => buttons(root).filter((b) => b.textContent?.trim() === text);

  it('lista los grupos y solo permite borrar los que no tienen personas', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(root.textContent).toContain('Bentaya');
    expect(root.textContent).toContain('Teide');
    expect(root.textContent).toContain('Tenerife');
    expect(byText(root, 'Borrar').length).toBe(1);
  });

  it('no guarda un grupo sin nombre y muestra el error', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    byText(root, 'Nuevo grupo')[0].click();
    fixture.detectChanges();
    byText(root, 'Guardar')[0].click();
    fixture.detectChanges();

    expect(service.create).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Escribe el nombre del grupo.');
  });

  it('crea un grupo con email vacío como nulo', async () => {
    const created: ScoutGroup = { ...bentaya, id: 9, name: 'Nuevo' };
    service.create.mockResolvedValue(created);
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    byText(root, 'Nuevo grupo')[0].click();
    fixture.detectChanges();
    const name = root.querySelector<HTMLInputElement>('#group-name')!;
    name.value = '  Nuevo ';
    name.dispatchEvent(new Event('input'));
    byText(root, 'Guardar')[0].click();
    await settle(fixture);

    expect(service.create).toHaveBeenCalledWith({ name: 'Nuevo', email: null, island: null });
    expect(root.textContent).toContain('Nuevo');
  });

  it('desactivar pide confirmación y no hace nada si se cancela', async () => {
    const fixture = await render();
    const dialog = TestBed.inject(Dialog);
    vi.spyOn(dialog, 'confirm').mockResolvedValue(false);

    byText(fixture.nativeElement, 'Desactivar')[0].click();
    await settle(fixture);

    expect(dialog.confirm).toHaveBeenCalled();
    expect(service.setActive).not.toHaveBeenCalled();
  });
});
