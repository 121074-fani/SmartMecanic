/**
 * Servicio de autenticación unificado (Supervisor / Gerente / Técnico).
 *
 * - Lista de cuentas autorizadas y solicitudes: `localStorage` (gestionadas por el supervisor en AccessModal).
 * - Sesión del Dashboard  → `fa-session`
 * - Sesión de la app del técnico → `fa-session-tecnico` (la lee `tecnicos-del-manana/js/bridge.js`).
 *   Son claves separadas para que un supervisor y un técnico puedan convivir en el mismo navegador.
 * - Cada inicio de sesión se registra en la API local (`POST /api/auth/session`) para trazabilidad.
 *
 * NOTA: es una demo 100 % cliente. En producción la validación de credenciales debe hacerse
 * en el servidor (SSO / IdP corporativo) y el token debe ser firmado por el backend.
 */
import { HUB_KEYS, api, broadcast, readJSON, uuid, writeJSON } from './hubClient';
import type { AseSpecialty, LexicalLevel } from '../types';

export type Role = 'Supervisor' | 'Gerente' | 'Técnico';
export type AppRole = 'supervisor' | 'gerente' | 'tecnico';

/** Rol interno de la app del técnico (claves de `ROLES` en tecnicos-del-manana/js/data.js). */
export type TdmRole = 'ev' | 'diesel' | 'elec' | 'nuevo';

export interface TecnicoProfile {
  /** mismo id que el técnico del Dashboard (T01…T12) para que la telemetría se vincule */
  id: string;
  nombre: string;
  especialidadASE: AseSpecialty;
  nivelLexico: LexicalLevel;
  rolApp: TdmRole;
  depot: string;
}

export interface AuthorizedUser {
  email: string;
  name: string;
  role: Role;
  authorizedBy: string;
  date: string;
  tecnico?: TecnicoProfile;
}

export interface AccessRequest {
  email: string;
  date: string;
}

export interface Session {
  email: string;
  name: string;
  role: Role;
  appRole?: AppRole;
  token?: string;
  issuedAt?: number;
  expiresAt?: number;
  tecnico?: TecnicoProfile;
}

export const DEMO_PASSWORD = 'fleet2026';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** ASE → rol de la app del técnico (pesos de su ruta adaptativa). */
export const ASE_TO_TDM_ROLE: Record<AseSpecialty, TdmRole> = {
  T2: 'diesel', // Diesel Engines
  T6: 'elec', // Electrical / Electronic Systems
  L3: 'ev', // Light Duty Hybrid / Electric Vehicle
  H: 'nuevo', // Transit Bus (generalista, ruta balanceada)
};

const tecnicoSeed = (
  id: string,
  email: string,
  nombre: string,
  especialidadASE: AseSpecialty,
  nivelLexico: LexicalLevel,
  depot: string,
): AuthorizedUser => ({
  email,
  name: nombre,
  role: 'Técnico',
  authorizedBy: 'Sistema',
  date: '01 ago 2026',
  tecnico: { id, nombre, especialidadASE, nivelLexico, rolApp: ASE_TO_TDM_ROLE[especialidadASE], depot },
});

/** Técnicos de prueba: vinculados a técnicos existentes del Dashboard. */
export const SEED_TECNICOS: AuthorizedUser[] = [
  tecnicoSeed('T04', 'ricardo.montemayor@fleetacademy.mx', 'Ricardo Montemayor', 'L3', 'Operativo', 'Depósito Norte · Monterrey'),
  tecnicoSeed('T02', 'jose.trevino@fleetacademy.mx', 'José Luis Treviño', 'T2', 'Técnico', 'Depósito Centro · CDMX'),
  tecnicoSeed('T09', 'luis.benavides@fleetacademy.mx', 'Luis Ángel Benavides', 'T6', 'Ingeniero', 'Depósito Norte · Monterrey'),
];

const SEED_USERS: AuthorizedUser[] = [
  { email: 'supervisor@fleetacademy.mx', name: 'Laura Saldaña', role: 'Supervisor', authorizedBy: 'Sistema', date: '01 ago 2026' },
  { email: 'gerencia@fleetacademy.mx', name: 'Gerencia de Operaciones', role: 'Gerente', authorizedBy: 'supervisor@fleetacademy.mx', date: '03 ago 2026' },
  { email: 'mantenimiento.norte@fleetacademy.mx', name: 'Jefatura Depósito Norte', role: 'Gerente', authorizedBy: 'supervisor@fleetacademy.mx', date: '12 sep 2026' },
  ...SEED_TECNICOS,
];

/** Sube este número si agregas cuentas semilla: se añaden UNA vez sin re-autorizar las que el supervisor revocó. */
const SEED_VERSION = 2;

export const normalize = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
export const today = () => new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

export const appRoleOf = (r: Role): AppRole => (r === 'Técnico' ? 'tecnico' : r === 'Supervisor' ? 'supervisor' : 'gerente');

export function loadUsers(): AuthorizedUser[] {
  const stored = readJSON<AuthorizedUser[] | null>(HUB_KEYS.users, null);
  if (!stored) return SEED_USERS;
  const v = readJSON<number>(HUB_KEYS.usersSeedVersion, 1);
  if (v >= SEED_VERSION) return stored;
  // migración: incorpora las cuentas semilla nuevas (técnicos) a una lista ya existente
  const merged = [...stored, ...SEED_USERS.filter((s) => !stored.some((u) => u.email === s.email))];
  writeJSON(HUB_KEYS.users, merged);
  writeJSON(HUB_KEYS.usersSeedVersion, SEED_VERSION);
  return merged;
}
export const saveUsers = (u: AuthorizedUser[]) => {
  writeJSON(HUB_KEYS.users, u);
  writeJSON(HUB_KEYS.usersSeedVersion, SEED_VERSION);
};
export const loadRequests = () => readJSON<AccessRequest[]>(HUB_KEYS.requests, [{ email: 'tecnico.lider@fleetacademy.mx', date: '22 nov 2026' }]);
export const saveRequests = (r: AccessRequest[]) => writeJSON(HUB_KEYS.requests, r);

/** Valida credenciales contra la lista de cuentas autorizadas. */
export function authenticate(email: string, password: string): { ok: true; user: AuthorizedUser } | { ok: false; reason: 'unauthorized' | 'password' } {
  const user = loadUsers().find((u) => u.email === normalize(email));
  if (!user) return { ok: false, reason: 'unauthorized' };
  if (password !== DEMO_PASSWORD) return { ok: false, reason: 'password' };
  return { ok: true, user };
}

const isExpired = (s: Session) => !!s.expiresAt && s.expiresAt < Date.now();

/** Completa una sesión mínima ({email,name,role}) con token, expiración y perfil de técnico. */
export function issueSession(s: Pick<Session, 'email' | 'name' | 'role'>): Session {
  const user = loadUsers().find((u) => u.email === s.email);
  const now = Date.now();
  return {
    email: s.email,
    name: user?.name ?? s.name,
    // el rol lo decide la opción elegida en el login (Técnico / Supervisor)
    role: s.role,
    appRole: appRoleOf(s.role),
    token: uuid(),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    tecnico: s.role === 'Técnico' ? user?.tecnico : undefined,
  };
}

const keyFor = (s: Session) => (s.role === 'Técnico' ? HUB_KEYS.sessionTecnico : HUB_KEYS.session);

/** Guarda la sesión en la clave del rol y la registra en la API local (trazabilidad). */
export function startSession(base: Pick<Session, 'email' | 'name' | 'role'>): Session {
  const s = issueSession(base);
  writeJSON(keyFor(s), s);
  broadcast('session');
  void api('/auth/session', { method: 'POST', body: JSON.stringify({ ...s, userAgent: navigator.userAgent }) });
  return s;
}

/** Sesión del Dashboard (login abierto: basta con que exista y no haya expirado). */
export function loadSession(): Session | null {
  const s = readJSON<Session | null>(HUB_KEYS.session, null);
  if (!s || isExpired(s) || s.role === 'Técnico') return null;
  return s;
}

export function saveSession(s: Session | null) {
  if (s) {
    writeJSON(keyFor(s), s);
  } else {
    const prev = readJSON<Session | null>(HUB_KEYS.session, null);
    writeJSON(HUB_KEYS.session, null);
    if (prev?.token) void api('/auth/logout', { method: 'POST', body: JSON.stringify({ token: prev.token }) });
  }
  broadcast('session');
}

export function loadTecnicoSession(): Session | null {
  const s = readJSON<Session | null>(HUB_KEYS.sessionTecnico, null);
  return s && !isExpired(s) ? s : null;
}

/** URL de la app del técnico (configurable para builds donde vive en otra ruta). */
export const TECNICO_APP_URL: string = (import.meta.env.VITE_TECNICO_APP_URL as string | undefined) ?? '/tecnicos-del-manana/index.html';

/**
 * Publica dónde está el login unificado; `bridge.js` lo usa para redirigir a un técnico sin sesión.
 * También publica los perfiles autorizados, para que el bridge revalide al técnico sin depender del Dashboard.
 */
export function announceHub() {
  const users = loadUsers();
  writeJSON(HUB_KEYS.hubInfo, {
    loginUrl: `${location.origin}/?app=tecnico`,
    dashboardUrl: `${location.origin}/`,
    tecnicoAppUrl: new URL(TECNICO_APP_URL, location.origin).href,
    apiBase: '/api',
    tecnicosAutorizados: users.filter((u) => u.role === 'Técnico').map((u) => u.email),
    at: Date.now(),
  });
}
