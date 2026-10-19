import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthResponse, MfaChallenge } from './auth.models';
import { AuthService } from './auth.service';

const response = (token: string): AuthResponse => ({
  accessToken: token,
  expiresInSeconds: 900,
  user: { id: 1, email: 'ana@example.org', name: 'Ana', surname: 'Prueba', roles: ['MEMBER', 'TREASURER'], scoutGroupId: null },
});

const challenge: MfaChallenge = { mfaRequired: true, mfaToken: 'tmp', methods: ['TOTP', 'EMAIL'], preferredMethod: 'TOTP' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('login guarda el usuario y el access token solo en memoria', async () => {
    const done = auth.login('ana@example.org', 'una-clave-larga-1', false);
    http.expectOne('/api/auth/login').flush(response('t1'));

    expect(await done).toEqual({ kind: 'session' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken).toBe('t1');
    expect(auth.hasRole('TREASURER')).toBe(true);
    expect(auth.hasRole('ADMIN')).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('login envía "mantener sesión iniciada"', async () => {
    const done = auth.login('ana@example.org', 'una-clave-larga-1', true);
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'ana@example.org', password: 'una-clave-larga-1', rememberMe: true });
    req.flush(response('t1'));
    await done;
  });

  it('con segundo factor el login no abre sesión: devuelve el desafío', async () => {
    const done = auth.login('ana@example.org', 'una-clave-larga-1', false);
    http.expectOne('/api/auth/login').flush(challenge);

    expect(await done).toEqual({ kind: 'mfa', challenge });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken).toBeNull();
  });

  it('verifyMfa abre la sesión con el código', async () => {
    const done = auth.verifyMfa('tmp', 'TOTP', '123456');
    const req = http.expectOne('/api/auth/mfa/verify');
    expect(req.request.body).toEqual({ mfaToken: 'tmp', type: 'TOTP', code: '123456' });
    req.flush(response('t3'));
    await done;

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken).toBe('t3');
  });

  it('un código incorrecto no deja sesión a medias', async () => {
    const done = auth.verifyMfa('tmp', 'EMAIL', '000000');
    http.expectOne('/api/auth/mfa/verify').flush({ detail: 'Código incorrecto' }, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toBeTruthy();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('varias renovaciones a la vez comparten una sola petición de refresh', async () => {
    const a = auth.refresh();
    const b = auth.refresh();
    http.expectOne('/api/auth/refresh').flush(response('t2'));

    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(auth.accessToken).toBe('t2');
  });

  it('si el refresh falla, la sesión queda vacía', async () => {
    const result = auth.refresh();
    http.expectOne('/api/auth/refresh').flush({ detail: 'Sesión no válida' }, { status: 401, statusText: 'Unauthorized' });

    expect(await result).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken).toBeNull();
  });

  it('el enlace de invitación se comprueba sin gastarlo y 410 significa caducado', async () => {
    const ok = auth.isSetupLinkValid('abc');
    const req = http.expectOne((r) => r.url === '/api/auth/set-password/check');
    expect(req.request.params.get('token')).toBe('abc');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await ok).toBe(true);

    const expired = auth.isSetupLinkValid('viejo');
    http.expectOne((r) => r.url === '/api/auth/set-password/check').flush(null, { status: 410, statusText: 'Gone' });
    expect(await expired).toBe(false);
  });

  it('sin SSO configurado no hay proveedores', async () => {
    const providers = auth.ssoProviders();
    http.expectOne('/api/auth/sso/providers').flush([]);
    expect(await providers).toEqual([]);

    const failing = auth.ssoProviders();
    http.expectOne('/api/auth/sso/providers').flush(null, { status: 500, statusText: 'Error' });
    expect(await failing).toEqual([]); // un fallo aquí nunca debe romper la pantalla de login
  });
});
