import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { Shell } from './core/shell/shell';

export const routes: Routes = [
  // Acceso (solo para quien no tiene sesión)
  {
    path: 'entrar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/register/register').then((m) => m.Register),
  },
  {
    // Enlace del email de aprobación: crear la contraseña
    path: 'crear-contrasena',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/set-password/set-password').then((m) => m.SetPassword),
  },
  {
    // Destino tras el SSO: el backend ya dejó la cookie de sesión
    path: 'sso/completar',
    loadComponent: () => import('./features/sso-complete/sso-complete').then((m) => m.SsoComplete),
  },

  // La app (requiere sesión)
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
      {
        path: 'cuenta/seguridad',
        loadComponent: () => import('./features/security/security').then((m) => m.Security),
      },
      {
        path: 'admin/solicitudes',
        canActivate: [roleGuard('ADMIN', 'SECRETARY')],
        loadComponent: () => import('./features/admin-requests/admin-requests').then((m) => m.AdminRequests),
      },
      {
        path: 'admin/grupos',
        canActivate: [roleGuard('ADMIN', 'SECRETARY')],
        loadComponent: () => import('./features/admin-groups/admin-groups').then((m) => m.AdminGroups),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
