export type Role =
  | 'MEMBER'
  | 'GROUP_COORDINATOR'
  | 'MODERATOR'
  | 'SECRETARY'
  | 'TREASURER'
  | 'LOGISTICS'
  | 'ADMIN';

export interface User {
  id: number;
  email: string;
  name: string;
  surname: string;
  roles: Role[];
  scoutGroupId: number | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: User;
}

/** La cuenta es de solicitud y no lleva contraseña: la crea la persona con el enlace que recibe al ser aprobada. */
export interface RegisterRequest {
  email: string;
  name: string;
  surname: string;
  scoutGroupId?: number | null;
}

// ---------- Segundo factor ----------

/** Métodos que la persona puede activar. */
export type MfaMethod = 'TOTP' | 'EMAIL';

/** Qué se escribe al iniciar sesión: código de la app, del correo o de recuperación. */
export type MfaCodeType = 'TOTP' | 'EMAIL' | 'RECOVERY';

/** Respuesta del login cuando la cuenta tiene segundo factor: aún no hay sesión. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  methods: MfaMethod[];
  preferredMethod: MfaMethod;
}

export type LoginResult = { kind: 'session' } | { kind: 'mfa'; challenge: MfaChallenge };

export interface MfaStatus {
  enabled: boolean;
  methods: MfaMethod[];
  preferredMethod: MfaMethod | null;
  recoveryCodesLeft: number;
  totpSetupPending: boolean;
}

export interface TotpSetup {
  /** Secreto en Base32, para teclearlo a mano si no se puede escanear el QR. */
  secret: string;
  otpauthUri: string;
  /** Imagen del QR (data-URI SVG), se muestra con un simple <img>. */
  qrDataUri: string;
}

/** Vacío salvo al activar el primer método: entonces trae los códigos de recuperación (única vez que se ven). */
export interface RecoveryCodes {
  recoveryCodes: string[];
}

export interface SsoProvider {
  id: string;
  name: string;
  /** A donde navega el botón "Entrar con …" (navegación completa, no XHR). */
  loginUrl: string;
}

// ---------- Solicitudes de cuenta (secretaría) ----------

export type AccountRequestStatus = 'PENDING' | 'INVITED';

export interface AccountRequest {
  id: number;
  email: string;
  name: string;
  surname: string;
  status: AccountRequestStatus;
  scoutGroupName: string | null;
  createdAt: string;
}
