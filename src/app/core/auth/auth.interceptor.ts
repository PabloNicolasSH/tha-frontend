import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Endpoints públicos de /api/auth: no llevan Bearer y un 401 suyo ("código incorrecto", "credenciales
 * incorrectas") es una respuesta normal, no una sesión caducada que haya que renovar.
 */
const PUBLIC_AUTH = /^\/api\/auth\/(login|register|refresh|logout|set-password|set-password\/check|mfa\/verify|mfa\/email\/send|sso\/providers)$/;

const isPublicAuthEndpoint = (url: string) => PUBLIC_AUTH.test(url.split('?')[0]);

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api') || isPublicAuthEndpoint(req.url)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(withToken(req, auth.accessToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      // Access token caducado: renovar una vez y reintentar la petición.
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            router.navigateByUrl('/entrar');
            return throwError(() => error);
          }
          return next(withToken(req, auth.accessToken));
        }),
      );
    }),
  );
};
