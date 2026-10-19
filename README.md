# tha-frontend

[![CI](https://github.com/PabloNicolasSH/tha-frontend/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/PabloNicolasSH/tha-frontend/actions/workflows/ci.yml)

Web de **Tha** (Scouts de Canarias). Angular 22 · componentes propios (sin librería de UI) · GSAP · Vitest.

## Arrancar en local

Necesita Node ≥ 24.15 y el backend en marcha (ver `../tha-backend/README.md`).

```bash
npm install
npm start        # http://localhost:4200
```

`proxy.conf.json` reenvía `/api` a `http://localhost:8080`. Así el navegador solo habla con un origen y la cookie del refresh token (`SameSite=Strict`) viaja sin configurar CORS.
Cuenta de desarrollo: `admin@tha.local` / `admin12345`.

```bash
npm test -- --watch=false    # tests unitarios
npm run build                # compilación de producción
```

El **CI** de GitHub Actions (`.github/workflows/ci.yml`) ejecuta `npm ci`, los tests y la compilación de producción en cada pull request hacia `develop` o `main` y en cada `push` a esas ramas. La compilación falla si se superan los presupuestos de tamaño de `angular.json`.

## Marca y diseño

Los tokens (`src/styles/tokens.css`) y los componentes base (`src/styles/components.css`, clases `th-*`) vienen de `../brand/`. **`brand/` es la fuente de verdad**: si cambias el diseño, edita allí y copia los archivos aquí. La guía visual está en `../brand/guide/index.html`.

## Acceso y sesión

Pantallas: `/entrar` (con "Mantener sesión iniciada", segundo paso de 2FA y botón de SSO si hay proveedor), `/registro` (solicitud **sin contraseña**), `/crear-contrasena?token=…` (enlace del email de aprobación), `/sso/completar` (destino tras el SSO), `/cuenta/seguridad` (2FA: app autenticadora, correo, códigos de recuperación) y `/admin/solicitudes` (solo ADMIN/SECRETARY).

- El **access token** (JWT de 15 min) vive solo en memoria (`AuthService`), nunca en `localStorage`.
- El **refresh token** va en cookie `HttpOnly`; la app no lo ve. Al arrancar, `provideAppInitializer` intenta recuperar la sesión con él.
- `authInterceptor` añade el `Bearer` y, ante un 401, renueva una vez y reintenta. Varias peticiones fallidas a la vez comparten una única renovación (el refresh token rota en cada uso). Los endpoints públicos de `/api/auth` (login, código de verificación, enlace…) quedan fuera: su 401 es "código incorrecto", no una sesión caducada.
- Guardas: `authGuard`, `guestGuard`, `roleGuard(...)`.
- `shared/ui/password-field`: campo de contraseña con botón para mostrarla u ocultarla (compatible con formularios reactivos). Úsalo en cualquier campo de contraseña.
- El SSO es una **navegación completa** (`<a href="/oauth2/authorization/…">`), no una petición XHR; por eso `proxy.conf.json` también reenvía `/oauth2` y `/login/oauth2`.

## Estructura

```
src/app/
  core/       auth, shell (marco), motion (GSAP)
  features/   login, register, home, … (una carpeta por funcionalidad, carga diferida)
src/styles/   tokens.css y components.css (marca)
```

## Movimiento

`core/motion/motion.ts` concentra las animaciones GSAP (entrada escalonada, sacudida de error). Solo `transform` y `opacity`, y nada se anima con `prefers-reduced-motion`.
