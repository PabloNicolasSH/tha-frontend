import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthResponse } from './auth.models';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const session = (token: string): AuthResponse => ({
  accessToken: token,
  expiresInSeconds: 900,
  user: { id: 1, email: 'ana@example.org', name: 'Ana', surname: 'Prueba', roles: ['MEMBER'], scoutGroupId: null },
});

/** Deja correr las promesas pendientes (la renovación del token es asíncrona). */
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    const login = auth.login('ana@example.org', 'una-clave-larga-1', false);
    controller.expectOne('/api/auth/login').flush(session('viejo'));
    await login;
  });

  afterEach(() => controller.verify());

  it('añade el access token a las peticiones de la API', async () => {
    const result = firstValueFrom(http.get('/api/algo'));
    const req = controller.expectOne('/api/algo');
    expect(req.request.headers.get('Authorization')).toBe('Bearer viejo');
    req.flush({});
    await result;
  });

  it('si caduca (401) renueva una vez y reintenta con el token nuevo', async () => {
    const result = firstValueFrom(http.get('/api/algo'));
    controller.expectOne('/api/algo').flush(null, { status: 401, statusText: 'Unauthorized' });

    controller.expectOne('/api/auth/refresh').flush(session('nuevo'));
    await flushPromises();
    const retry = controller.expectOne('/api/algo');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
    retry.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
  });

  it('un 401 del código de verificación es "código incorrecto": no intenta renovar la sesión', async () => {
    const result = firstValueFrom(http.post('/api/auth/mfa/verify', {})).catch((e) => e);
    const req = controller.expectOne('/api/auth/mfa/verify');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ detail: 'Código incorrecto' }, { status: 401, statusText: 'Unauthorized' });

    expect((await result).status).toBe(401);
    controller.expectNone('/api/auth/refresh'); // sin bucles de renovación
  });

  it('las rutas públicas (login, comprobar enlace…) no llevan el token', async () => {
    const result = firstValueFrom(http.get('/api/auth/set-password/check?token=abc'));
    const req = controller.expectOne('/api/auth/set-password/check?token=abc');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null);
    await result;
  });
});
