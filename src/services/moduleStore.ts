/**
 * Almacén compartido de módulos publicados y eventos de telemetría.
 *
 * Escritura: localStorage (inmediato, mismo origen) + API local (otros dispositivos).
 * Si la API no responde, el paquete queda en `fa-hub-modules-outbox` y se reintenta en el siguiente sync.
 */
import { HUB_KEYS, api, broadcast, readJSON, writeJSON } from './hubClient';
import type { PublishedModule, PublishedModulePackage, TelemetryEvent } from '../types';

const MAX_EVENTS = 5000;

/* ───────────── Módulos ───────────── */

export const listModules = (): PublishedModulePackage[] => readJSON<PublishedModulePackage[]>(HUB_KEYS.modules, []);

const mergeModules = (a: PublishedModulePackage[], b: PublishedModulePackage[]) => {
  const map = new Map<string, PublishedModulePackage>();
  [...a, ...b].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((x, y) => y.fechaPublicacion.localeCompare(x.fechaPublicacion));
};

/** Siguiente versión para un código de módulo (1 si es nuevo). */
export const nextVersion = (codigo: string) =>
  listModules().reduce((v, m) => (m.codigo === codigo ? Math.max(v, m.version) : v), 0) + 1;

export async function publishModule(pkg: PublishedModulePackage): Promise<{ synced: boolean; json: string | null }> {
  writeJSON(HUB_KEYS.modules, mergeModules(listModules(), [pkg]));
  broadcast('modules');
  const res = await api<{ ok: boolean; json?: string | null }>('/modules', { method: 'POST', body: JSON.stringify(pkg), timeoutMs: 8000 });
  if (res?.ok) return { synced: true, json: res.json ?? null };
  const outbox = readJSON<PublishedModulePackage[]>(HUB_KEYS.modulesOutbox, []);
  writeJSON(HUB_KEYS.modulesOutbox, mergeModules(outbox, [pkg]));
  return { synced: false, json: null };
}

/** Sube pendientes y descarga los módulos publicados desde otros dispositivos. */
export async function syncModules(): Promise<PublishedModulePackage[]> {
  const outbox = readJSON<PublishedModulePackage[]>(HUB_KEYS.modulesOutbox, []);
  for (const pkg of outbox) {
    const r = await api<{ ok: boolean }>('/modules', { method: 'POST', body: JSON.stringify(pkg) });
    if (!r?.ok) break;
    writeJSON(
      HUB_KEYS.modulesOutbox,
      readJSON<PublishedModulePackage[]>(HUB_KEYS.modulesOutbox, []).filter((p) => p.id !== pkg.id),
    );
  }
  const remote = await api<PublishedModulePackage[]>('/modules');
  const local = listModules();
  if (!remote) return local;
  const merged = mergeModules(local, remote);
  if (merged.length !== local.length) {
    writeJSON(HUB_KEYS.modules, merged);
    broadcast('modules');
  }
  return merged;
}

/** Resumen para la lista "Módulos publicados recientemente" del Dashboard. */
export const toPublishedSummary = (p: PublishedModulePackage): PublishedModule => ({
  code: p.codigo,
  name: `${p.nombre} (${p.reglasSeguridad.length} reglas · ${p.paresApriete.length} pares · ${p.piezasSBOM.length} piezas)${p.version > 1 ? ` · v${p.version}` : ''}`,
  date: new Date(p.fechaPublicacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
  targets: p.destinos,
  packageId: p.id,
});

/* ───────────── Eventos de telemetría ───────────── */

export const listEvents = (): TelemetryEvent[] => {
  // eventos ya conocidos + cola offline del técnico en este mismo navegador
  const known = readJSON<TelemetryEvent[]>(HUB_KEYS.events, []);
  const outbox = readJSON<TelemetryEvent[]>(HUB_KEYS.eventsOutbox, []);
  return mergeEvents(known, outbox);
};

export const mergeEvents = (a: TelemetryEvent[], b: TelemetryEvent[]) => {
  const seen = new Map<string, TelemetryEvent>();
  [...a, ...b].forEach((e) => e && e.eventId && seen.set(e.eventId, e));
  return [...seen.values()].sort((x, y) => x.timestamp - y.timestamp).slice(-MAX_EVENTS);
};

/** Descarga eventos nuevos de la API (técnicos en otros dispositivos) y los fusiona. */
export async function syncEvents(): Promise<TelemetryEvent[]> {
  const local = listEvents();
  const since = local.length ? local[local.length - 1].timestamp - 60_000 : 0;
  const remote = await api<TelemetryEvent[]>(`/events?since=${since}`);
  if (!remote || !remote.length) return local;
  const merged = mergeEvents(readJSON<TelemetryEvent[]>(HUB_KEYS.events, []), remote);
  writeJSON(HUB_KEYS.events, merged);
  return mergeEvents(merged, readJSON<TelemetryEvent[]>(HUB_KEYS.eventsOutbox, []));
}
