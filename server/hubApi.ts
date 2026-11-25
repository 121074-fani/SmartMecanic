/**
 * API local del hub (Dashboard ⇄ app del técnico), montada como middleware de Vite
 * en `npm run dev` y `npm run preview`. Persiste en `.data/hub.json`.
 *
 *   GET  /api/health
 *   POST /api/auth/session        registra un inicio de sesión (trazabilidad)
 *   POST /api/auth/logout
 *   GET  /api/auth/sessions       auditoría de sesiones
 *   GET  /api/modules             PublishedModulePackage[]
 *   POST /api/modules             publica / versiona un paquete
 *   GET  /api/events?since=&tecnicoId=
 *   POST /api/events              { events: TelemetryEvent[] } (idempotente por eventId)
 *   GET  /api/ingest/status       motor de extracción disponible (IA Cloud / local)
 *   POST /api/ingest/extract      { fileName, pages[] } → extracción con IA o { mode: 'local' }
 *
 * Cada publicación también se exporta como JSON público y legible:
 *   public/data/manuales/<CODIGO>.json   (paquete completo, última versión)
 *   public/data/manuales/index.json      (catálogo de manuales publicados)
 * La app del técnico los lee como respaldo estático cuando la API no está activa.
 *
 * Es un backend de demo: sin autenticación de API ni cifrado. En producción se reemplaza
 * por un servicio con IdP corporativo y base de datos.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { aiExtract, aiProvider } from './aiExtract';

interface ModuleRecord {
  id: string;
  schema: string;
  fechaPublicacion: string;
  codigo?: string;
  version?: number;
  nombre?: string;
  categoria?: string;
  vehiculo?: string;
  fuente?: Record<string, unknown>;
  reglasSeguridad?: unknown[];
  paresApriete?: unknown[];
  piezasSBOM?: unknown[];
  entrenamiento?: { lecciones?: unknown[]; preguntas?: unknown[]; procedimientos?: unknown[] };
}

interface HubDb {
  modules: ModuleRecord[];
  events: { eventId: string; schema: string; tecnicoId: string; timestamp: number; receivedAt?: number }[];
  sessions: { token: string; email: string; role: string; issuedAt: number; expiresAt: number; revokedAt?: number }[];
}

const MAX_BODY = 24 * 1024 * 1024;
const MAX_EVENTS = 50_000;

const safeName = (codigo: string) => codigo.replace(/[^A-Za-z0-9._-]/g, '_');

/** Escribe public/data/manuales/<CODIGO>.json (última versión) e index.json. */
function exportManuales(dir: string, modules: ModuleRecord[]) {
  const latest = new Map<string, ModuleRecord>();
  const versions = new Map<string, number[]>();
  for (const m of modules) {
    const code = m.codigo ?? m.id.split('@')[0];
    versions.set(code, [...(versions.get(code) ?? []), m.version ?? 1]);
    const cur = latest.get(code);
    if (!cur || (m.version ?? 1) > (cur.version ?? 1)) latest.set(code, m);
  }
  mkdirSync(dir, { recursive: true });
  const write = (name: string, data: unknown) => {
    writeFileSync(`${dir}/${name}.tmp`, JSON.stringify(data, null, 2) + '\n');
    renameSync(`${dir}/${name}.tmp`, `${dir}/${name}`);
  };
  const manuales = [...latest.entries()]
    .sort((a, b) => b[1].fechaPublicacion.localeCompare(a[1].fechaPublicacion))
    .map(([code, m]) => {
      const archivo = `${safeName(code)}.json`;
      write(archivo, m);
      return {
        codigo: code,
        id: m.id,
        nombre: m.nombre,
        categoria: m.categoria,
        vehiculo: m.vehiculo,
        version: m.version ?? 1,
        versiones: [...new Set(versions.get(code))].sort((a, b) => a - b),
        fechaPublicacion: m.fechaPublicacion,
        archivo,
        fuente: m.fuente,
        totales: {
          reglasSeguridad: m.reglasSeguridad?.length ?? 0,
          paresApriete: m.paresApriete?.length ?? 0,
          piezasSBOM: m.piezasSBOM?.length ?? 0,
          lecciones: m.entrenamiento?.lecciones?.length ?? 0,
          preguntas: m.entrenamiento?.preguntas?.length ?? 0,
          procedimientos: m.entrenamiento?.procedimientos?.length ?? 0,
        },
      };
    });
  write('index.json', { schema: 'fa.manuales/v1', actualizado: new Date().toISOString(), total: manuales.length, manuales });
}

export function hubApi(opts: { file?: string; publicDir?: string; env?: Record<string, string | undefined> } = {}): Plugin {
  const file = resolve(opts.file ?? '.data/hub.json');
  const manualesDir = resolve(opts.publicDir ?? 'public', 'data/manuales');
  /** en `vite preview` se sirve dist/: el JSON también se escribe ahí para que sea visible sin recompilar */
  const extraDirs: string[] = [];
  const exportAll = () => [manualesDir, ...extraDirs].forEach((d) => exportManuales(d, db.modules));
  const env = { ...process.env, ...(opts.env ?? {}) };
  let db: HubDb = { modules: [], events: [], sessions: [] };
  try {
    if (existsSync(file)) db = { ...db, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    /* archivo corrupto: se arranca vacío */
  }
  // regenera los JSON públicos si hay módulos guardados pero falta el catálogo
  if (db.modules.length && !existsSync(`${manualesDir}/index.json`)) {
    try {
      exportManuales(manualesDir, db.modules);
    } catch {
      /* sin permisos de escritura en public/ */
    }
  }
  let timer: NodeJS.Timeout | null = null;
  const persist = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify(db));
      renameSync(`${file}.tmp`, file);
    }, 250);
  };

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<unknown>((ok, fail) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) {
          fail(new Error('payload demasiado grande'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        try {
          ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch (e) {
          fail(e);
        }
      });
      req.on('error', fail);
    });

  const isEvent = (e: unknown): e is HubDb['events'][number] =>
    !!e && typeof e === 'object' && (e as { schema?: string }).schema === 'fa.telemetry/v1' && typeof (e as { eventId?: unknown }).eventId === 'string' && typeof (e as { tecnicoId?: unknown }).tecnicoId === 'string' && typeof (e as { timestamp?: unknown }).timestamp === 'number';

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://hub.local');
    if (!url.pathname.startsWith('/api/')) return next();
    const route = `${req.method} ${url.pathname.replace(/\/+$/, '')}`;
    try {
      switch (route) {
        case 'GET /api/health':
          return send(res, 200, { ok: true, modules: db.modules.length, events: db.events.length, at: Date.now() });

        case 'POST /api/auth/session': {
          const s = (await readBody(req)) as HubDb['sessions'][number];
          if (!s?.token || !s.email) return send(res, 400, { ok: false, error: 'sesión inválida' });
          db.sessions = [...db.sessions.filter((x) => x.token !== s.token), { ...s }].slice(-2000);
          persist();
          return send(res, 200, { ok: true });
        }
        case 'POST /api/auth/logout': {
          const { token } = (await readBody(req)) as { token?: string };
          db.sessions = db.sessions.map((x) => (x.token === token ? { ...x, revokedAt: Date.now() } : x));
          persist();
          return send(res, 200, { ok: true });
        }
        case 'GET /api/auth/sessions':
          return send(res, 200, db.sessions.map(({ token: _t, ...rest }) => rest));

        case 'GET /api/modules':
          return send(res, 200, db.modules);
        case 'POST /api/modules': {
          const pkg = (await readBody(req)) as HubDb['modules'][number];
          if (pkg?.schema !== 'fa.module/v1' || typeof pkg.id !== 'string') return send(res, 400, { ok: false, error: 'se esperaba un PublishedModulePackage (fa.module/v1)' });
          db.modules = [pkg, ...db.modules.filter((m) => m.id !== pkg.id)];
          persist();
          let exported: string | null = null;
          try {
            exportAll();
            exported = `/data/manuales/${safeName(pkg.codigo ?? pkg.id.split('@')[0])}.json`;
          } catch (e) {
            console.warn('[hub] no se pudo exportar el JSON público:', (e as Error).message);
          }
          return send(res, 200, { ok: true, id: pkg.id, json: exported });
        }

        case 'GET /api/ingest/status': {
          const provider = aiProvider(env);
          return send(res, 200, { ok: true, engine: provider ? 'ia-cloud' : 'local', provider });
        }
        case 'POST /api/ingest/extract': {
          const body = (await readBody(req)) as { fileName?: string; pages?: unknown };
          const pages = Array.isArray(body?.pages) ? body.pages.map((p) => String(p ?? '')) : [];
          const result = await aiExtract(env, String(body?.fileName ?? 'documento.pdf'), pages);
          return send(res, 200, result);
        }

        case 'GET /api/events': {
          const since = Number(url.searchParams.get('since') ?? 0) || 0;
          const tec = url.searchParams.get('tecnicoId');
          return send(res, 200, db.events.filter((e) => e.timestamp >= since && (!tec || e.tecnicoId === tec)));
        }
        case 'POST /api/events': {
          const body = (await readBody(req)) as { events?: unknown[] };
          const incoming = Array.isArray(body?.events) ? body.events : [];
          const known = new Set(db.events.map((e) => e.eventId));
          const accepted = incoming.filter(isEvent).filter((e) => !known.has(e.eventId));
          const now = Date.now();
          db.events = [...db.events, ...accepted.map((e) => ({ ...e, receivedAt: now }))].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_EVENTS);
          if (accepted.length) persist();
          // el cliente borra de su cola todo lo aceptado o duplicado (idempotencia)
          return send(res, 200, { ok: true, accepted: accepted.length, ids: incoming.filter(isEvent).map((e) => e.eventId) });
        }
        default:
          return send(res, 404, { ok: false, error: `ruta no encontrada: ${route}` });
      }
    } catch (e) {
      return send(res, 400, { ok: false, error: (e as Error).message });
    }
  };

  return {
    name: 'fleet-hub-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      extraDirs.push(resolve(server.config.root, server.config.build.outDir, 'data/manuales'));
      server.middlewares.use(handler);
    },
  };
}
