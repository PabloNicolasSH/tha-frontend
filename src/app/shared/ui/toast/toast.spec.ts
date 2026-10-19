import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ToastHost } from './toast-host';
import { MAX_TOASTS, TOAST_DURATION_MS, Toast } from './toast.service';

describe('Toast (servicio)', () => {
  let toast: Toast;

  beforeEach(() => {
    vi.useFakeTimers();
    toast = TestBed.inject(Toast);
  });

  afterEach(() => vi.useRealTimers());

  const states = () => toast.items().map((t) => t.state);

  it('añade avisos de cada tipo con su mensaje', () => {
    toast.success('Hecho');
    toast.error('Falló');
    toast.info('Ojo');

    expect(toast.items().map((t) => [t.kind, t.message])).toEqual([
      ['success', 'Hecho'],
      ['error', 'Falló'],
      ['info', 'Ojo'],
    ]);
  });

  it('se cierra solo a los 5 segundos', () => {
    toast.success('Hecho');

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(states()).toEqual(['open']);
    vi.advanceTimersByTime(1);
    expect(states()).toEqual(['leaving']);

    toast.remove(toast.items()[0].id);
    expect(toast.items()).toEqual([]);
  });

  it('se pausa mientras se tiene el ratón encima y sigue con el tiempo que quedaba', () => {
    const id = toast.success('Hecho');

    vi.advanceTimersByTime(3000);
    toast.pause(id);
    vi.advanceTimersByTime(60_000); // por mucho que pase, no se cierra
    expect(states()).toEqual(['open']);

    toast.resume(id);
    vi.advanceTimersByTime(1999);
    expect(states()).toEqual(['open']);
    vi.advanceTimersByTime(1);
    expect(states()).toEqual(['leaving']);
  });

  it('pausar o reanudar dos veces seguidas no altera la cuenta atrás', () => {
    const id = toast.success('Hecho');
    vi.advanceTimersByTime(1000);

    toast.pause(id);
    toast.pause(id);
    toast.resume(id);
    toast.resume(id);

    vi.advanceTimersByTime(3999);
    expect(states()).toEqual(['open']);
    vi.advanceTimersByTime(1);
    expect(states()).toEqual(['leaving']);
  });

  it(`se apilan como máximo ${MAX_TOASTS}: al llegar uno más, se retira el más antiguo`, () => {
    toast.info('uno');
    toast.info('dos');
    toast.info('tres');
    toast.info('cuatro');

    expect(toast.items().map((t) => [t.message, t.state])).toEqual([
      ['uno', 'leaving'],
      ['dos', 'open'],
      ['tres', 'open'],
      ['cuatro', 'open'],
    ]);
  });

  it('cerrar a mano cancela su cuenta atrás', () => {
    const id = toast.success('Hecho');
    toast.dismiss(id);
    toast.remove(id);

    vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    expect(toast.items()).toEqual([]);
  });
});

describe('ToastHost (interfaz)', () => {
  let fixture: ComponentFixture<ToastHost>;
  let toast: Toast;
  const el = () => fixture.nativeElement as HTMLElement;
  const rendered = () => [...el().querySelectorAll('.th-toast')] as HTMLElement[];

  async function flush(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ToastHost] });
    fixture = TestBed.createComponent(ToastHost);
    toast = TestBed.inject(Toast);
    await flush();
  });

  it('es una región con nombre para lectores de pantalla', () => {
    expect(el().querySelector('section')?.getAttribute('aria-label')).toBe('Avisos');
  });

  it('un error se anuncia de forma asertiva y el resto de forma cortés', async () => {
    toast.error('Falló');
    toast.success('Hecho');
    await flush();

    const [error, success] = rendered();
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.getAttribute('aria-live')).toBe('assertive');
    expect(success.getAttribute('role')).toBe('status');
    expect(success.getAttribute('aria-live')).toBe('polite');
    expect(error.classList).toContain('th-toast--error');
    expect(success.classList).toContain('th-toast--success');
    expect(error.textContent).toContain('Falló');
  });

  it('el botón de cerrar es alcanzable, lleva nombre y retira el aviso', async () => {
    toast.info('Ojo');
    await flush();

    const close = rendered()[0].querySelector('button')!;
    expect(close.getAttribute('aria-label')).toBe('Cerrar aviso');
    expect(close.type).toBe('button');
    close.click();
    await flush();

    expect(rendered().length).toBe(0);
    expect(toast.items()).toEqual([]);
  });

  it('Escape con el foco en un aviso lo cierra', async () => {
    toast.info('Ojo');
    await flush();

    rendered()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();

    expect(rendered().length).toBe(0);
  });

  it('el foco dentro del aviso pausa su cuenta atrás y al salir se reanuda', async () => {
    vi.useFakeTimers();
    try {
      const id = toast.info('Ojo');
      await flush();

      rendered()[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      vi.advanceTimersByTime(TOAST_DURATION_MS * 3);
      expect(toast.items().find((t) => t.id === id)?.state).toBe('open');

      rendered()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      vi.advanceTimersByTime(TOAST_DURATION_MS);
      expect(toast.items().find((t) => t.id === id)?.state).toBe('leaving');
    } finally {
      vi.useRealTimers();
    }
  });

  it('el icono es decorativo (no lo lee el lector de pantalla)', async () => {
    toast.success('Hecho');
    await flush();

    expect(rendered()[0].querySelector('svg.th-toast__icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
