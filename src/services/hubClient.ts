/**
 * Cliente del "hub" compartido entre el Dashboard del Supervisor y la app del técnico.
 *
 * Dos capas de persistencia:
 *  1. API local (`/api/*`, middleware de Vite en `server/hubApi.ts`, persiste en `.data/hub.json`).
 *     Permite que un técnico en otro dispositivo de la red sincronice con el supervisor.
 *  2. `localStorage` estructurado (mismo origen): caché + cola offline. Funciona aunque la API no exista
 *     (build estático / `file://`).
 *
 * IMPORTANTE: las claves están duplicadas en `tecnicos-del-manana/js/bridge.js` (JS plano, sin bundler).
 * Si cambias una aquí, cámbiala allá.
 */

export const HUB_KEYS = {
  users: 'fa-users',
  requests: 'fa-requests',
  /** sesión del Dashboard (supervisor / gerente) */
  session: 'fa-session',
  /** sesión de la app del técnico (independiente para que ambos roles convivan en el mismo navegador) */
  sessionTecnico: 'fa-session-tecnico',
  usersSeedVersion: 'fa-users-seed',
  modules: 'fa-hub-modules',
  modulesOutbox: 'fa-hub-modules-outbox',
  events: 'fa-hub-events',
  /** cola offline de eventos del técnico (la escribe bridge.js) */
  eventsOutbox: 'fa-hub-outbox',
  /** marca que la app del técnico usa para saber dónde está el login unificado */
  hubInfo: 'fa-hub',
} as const;

export const HUB_CHANNEL = 'fa-hub';
export const API_BASE = '/api';

export const readJSON = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeJSON = (k: string, v: unknown) => {
  try {
    if (v === null || v === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* almacenamiento no disponible o lleno: la app sigue en memoria */
  }
};

let channel: BroadcastChannel | null = null;
const getChannel = () => {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  try {
    channel = new BroadcastChannel(HUB_CHANNEL);
  } catch {
    channel = null;
  }
  return channel;
};

export type HubTopic = 'modules' | 'events' | 'session';

/** Notifica a otras pestañas del mismo origen (Dashboard ⇄ app del técnico). */
export const broadcast = (topic: HubTopic) => getChannel()?.postMessage({ topic, at: Date.now() });

/**
 * Se suscribe a cambios del hub: BroadcastChannel + evento `storage` (otras pestañas)
 * + sondeo periódico de la API (otros dispositivos).
 */
export const subscribeHub = (onChange: (topic: HubTopic) => void, poll?: () => Promise<void>, pollMs = 5000) => {
  const ch = getChannel();
  const onMsg = (e: MessageEvent) => onChange((e.data?.topic as HubTopic) ?? 'events');
  const onStorage = (e: StorageEvent) => {
    if (e.key === HUB_KEYS.modules) onChange('modules');
    else if (e.key === HUB_KEYS.events || e.key === HUB_KEYS.eventsOutbox) onChange('events');
    else if (e.key === HUB_KEYS.session) onChange('session');
  };
  ch?.addEventListener('message', onMsg);
  window.addEventListener('storage', onStorage);
  const timer = poll ? window.setInterval(() => void poll().catch(() => undefined), pollMs) : null;
  return () => {
    ch?.removeEventListener('message', onMsg);
    window.removeEventListener('storage', onStorage);
    if (timer) window.clearInterval(timer);
  };
};

let apiDown = 0;
/**
 * Llamada JSON a la API local con timeout. Devuelve `null` si la API no está disponible
 * (sin servidor, offline, build estático) para que el llamador use la capa localStorage.
 */
export async function api<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T | null> {
  // si la API falló hace < 15 s no insistimos en cada llamada
  if (Date.now() - apiDown < 15_000) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 4000);
  try {
    const res = await fetch(API_BASE + path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (res.status === 404 && !res.headers.get('content-type')?.includes('json')) {
      apiDown = Date.now();
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    apiDown = Date.now();
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

export const resetApiBackoff = () => {
  apiDown = 0;
};

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
