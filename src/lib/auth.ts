/**
 * Control de acceso de la demo (100 % en el cliente).
 * Solo pueden entrar los correos que un supervisor haya autorizado.
 * NOTA: esto es una simulación para la demo; en producción la validación
 * debe hacerse en el servidor (SSO / IdP corporativo).
 */
export type Role = 'Supervisor' | 'Gerente';

export interface AuthorizedUser {
  email: string;
  name: string;
  role: Role;
  authorizedBy: string;
  date: string;
}

export interface AccessRequest {
  email: string;
  date: string;
}

export interface Session {
  email: string;
  name: string;
  role: Role;
}

export const DEMO_PASSWORD = 'fleet2026';

const SEED_USERS: AuthorizedUser[] = [
  { email: 'supervisor@fleetacademy.mx', name: 'Laura Saldaña', role: 'Supervisor', authorizedBy: 'Sistema', date: '01 ago 2026' },
  { email: 'gerencia@fleetacademy.mx', name: 'Gerencia de Operaciones', role: 'Gerente', authorizedBy: 'supervisor@fleetacademy.mx', date: '03 ago 2026' },
  { email: 'mantenimiento.norte@fleetacademy.mx', name: 'Jefatura Depósito Norte', role: 'Gerente', authorizedBy: 'supervisor@fleetacademy.mx', date: '12 sep 2026' },
];

const K_USERS = 'fa-users';
const K_REQ = 'fa-requests';
const K_SESSION = 'fa-session';

const read = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
};

export const normalize = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export const loadUsers = () => read<AuthorizedUser[]>(K_USERS, SEED_USERS);
export const saveUsers = (u: AuthorizedUser[]) => write(K_USERS, u);
export const loadRequests = () => read<AccessRequest[]>(K_REQ, [{ email: 'tecnico.lider@fleetacademy.mx', date: '22 nov 2026' }]);
export const saveRequests = (r: AccessRequest[]) => write(K_REQ, r);
export const loadSession = () => read<Session | null>(K_SESSION, null);
export const saveSession = (s: Session | null) => write(K_SESSION, s);

export const today = () => new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
