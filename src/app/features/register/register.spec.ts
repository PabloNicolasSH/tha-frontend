import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { PublicListsService } from '../../core/groups/public-lists.service';
import { Register } from './register';

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

describe('Register', () => {
  let auth: { register: ReturnType<typeof vi.fn> };
  let lists: { groups: ReturnType<typeof vi.fn>; branches: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { register: vi.fn().mockResolvedValue(undefined) };
    lists = {
      groups: vi.fn().mockResolvedValue([{ id: 7, name: 'Bentaya' }]),
      branches: vi.fn().mockResolvedValue([
        { id: 1, code: 'CASTORES', name: 'Castores' },
        { id: 2, code: 'LOBATOS', name: 'Lobatos' },
      ]),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: PublicListsService, useValue: lists },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    const field = (id: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    const fill = (id: string, value: string) => {
      const el = field(id);
      el.value = value;
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    };
    const fillPerson = () => {
      fill('name', 'Ana');
      fill('surname', 'Pérez');
      fill('email', 'ana@example.org');
    };
    const submit = async () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle(fixture);
    };
    return { fixture, root, field, fill, fillPerson, submit };
  }

  it('ofrece los grupos con «Ninguno (federación)» y las ramas con «Ninguna»', async () => {
    const { field } = await render();

    const groups = Array.from(field('scoutGroupId').querySelectorAll('option')).map((o) => o.textContent!.trim());
    const branches = Array.from(field('branchId').querySelectorAll('option')).map((o) => o.textContent!.trim());
    expect(groups).toEqual(['Ninguno (federación)', 'Bentaya']);
    expect(branches).toEqual(['Ninguna', 'Castores', 'Lobatos']);
  });

  it('envía grupo y rama como números cuando se eligen', async () => {
    const { fill, fillPerson, submit } = await render();
    fillPerson();
    fill('scoutGroupId', '7');
    fill('branchId', '2');
    await submit();

    expect(auth.register).toHaveBeenCalledWith({
      name: 'Ana', surname: 'Pérez', email: 'ana@example.org', scoutGroupId: 7, branchId: 2,
    });
  });

  it('grupo y rama son opcionales: sin elegir se envían como nulos', async () => {
    const { fillPerson, submit } = await render();
    fillPerson();
    await submit();

    expect(auth.register).toHaveBeenCalledWith({
      name: 'Ana', surname: 'Pérez', email: 'ana@example.org', scoutGroupId: null, branchId: null,
    });
  });

  it('si las listas no cargan, la solicitud sigue siendo posible', async () => {
    lists.groups.mockRejectedValue(new Error('sin red'));
    lists.branches.mockRejectedValue(new Error('sin red'));
    const { field, fillPerson, submit } = await render();

    expect(field('scoutGroupId').querySelectorAll('option').length).toBe(1);
    fillPerson();
    await submit();
    expect(auth.register).toHaveBeenCalled();
  });
});
