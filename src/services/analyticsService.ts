/**
 * Analítica en tiempo real a partir de la telemetría REAL de los técnicos.
 *
 * Fórmulas
 * ────────
 * • IRE ponderado (ver `lib/retention.ts › ireValue`):
 *       IRE = Σ_c w_c · repetidos_c / Σ_c w_c · totales_c ,   w = {loto 3, aislamiento 2.5, torque 1.5, sbom 1, diagnóstico 1}
 *   Un error cuenta como "repetido" cuando el mismo técnico vuelve a fallar en el mismo componente / regla.
 *
 * • Retención R(t) = e^(−t/S). Cada examen (post o diferido) reinicia t y ajusta la estabilidad S:
 *       S' = ½ · S·k + ½ · S_obs,   k = 1.6 si aprueba (≥ 70) · 0.85 si reprueba
 *       S_obs = −Δt / ln(R_obs),    R_obs = score / 100   (estimación empírica del propio examen)
 *
 * • ITT (Índice de Transferencia al Taller):
 *       ITT = media(puntaje práctico en Taller / Rescate) / media(puntaje teórico: diagnóstico, post, diferido)
 *   ITT < 0.7 ⇒ el técnico "sabe la teoría pero no la transfiere al taller" → alerta temprana.
 */
import { CATEGORY_LABEL, dayToDate, lastReview, PASS_THRESHOLD, projectedRetention, retention } from '../lib/retention';
import type { ERROR_RECURRENCE } from '../data/mock';
import type {
  AseSpecialty,
  ErrorCategory,
  FeedbackEntry,
  IreBreakdown,
  LexicalLevel,
  Specialty,
  SupervisorAlert,
  TelemetryEvent,
  Technician,
} from '../types';

export { fleetIre, IRE_WEIGHTS, ireValue } from '../lib/retention';

const ASE_TO_SPECIALTY: Record<AseSpecialty, Specialty> = {
  L3: 'Alto Voltaje',
  T6: 'Alto Voltaje',
  T2: 'Mecánica Pesada',
  H: 'Mecánica Pesada',
};

const ERROR_TYPES = new Set(['seguridad.error_critico', 'error.registrado']);

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const emptyIre = (): IreBreakdown => ({
  loto: { total: 0, repeated: 0 },
  torque: { total: 0, repeated: 0 },
  sbom: { total: 0, repeated: 0 },
  aislamiento: { total: 0, repeated: 0 },
  diagnostico: { total: 0, repeated: 0 },
});

/** Técnico que aún no existe en el Dashboard (p. ej. una cuenta nueva autorizada). */
function newTechnician(e: TelemetryEvent): Technician {
  const specialty = ASE_TO_SPECIALTY[e.tecnico.especialidadASE] ?? 'Mecánica Pesada';
  return {
    id: e.tecnicoId,
    name: e.tecnico.nombre,
    initials: initials(e.tecnico.nombre),
    depot: 'App del técnico',
    specialty,
    lexicalLevel: e.tecnico.nivelLexico as LexicalLevel,
    sections: [
      { id: 1, title: 'Fundamentos y seguridad', progress: 5, status: 'en curso' },
      { id: 2, title: 'Módulos publicados', progress: 0, status: 'bloqueada' },
      { id: 3, title: 'Diagnóstico y rescate', progress: 0, status: 'bloqueada' },
    ],
    delegationScore: 60,
    hvCertified: false,
    currentDay: 0,
    reviews: [{ day: 0, stability: 10, score: null }],
    ire: emptyIre(),
    log: [],
    reinforcement: null,
  };
}

const advanceSections = (t: Technician, pts: number) => {
  const sections = t.sections.map((s) => ({ ...s }));
  const active = sections.find((s) => s.status === 'en curso');
  if (!active) return sections;
  active.progress = Math.min(100, active.progress + pts);
  if (active.progress >= 100) {
    active.status = 'aprobada';
    const next = sections.find((s) => s.status === 'bloqueada');
    if (next) {
      next.status = 'en curso';
      next.progress = 5;
    }
  }
  return sections;
};

/** Ajuste de estabilidad S tras un examen (ver encabezado). */
export function adjustStability(prevS: number, dt: number, score: number) {
  const passed = score >= PASS_THRESHOLD;
  const k = passed ? 1.6 : 0.85;
  const Robs = Math.min(0.99, Math.max(0.05, score / 100));
  const Sobs = dt > 0 ? -dt / Math.log(Robs) : prevS;
  return Math.max(4, Math.min(160, 0.5 * prevS * k + 0.5 * Sobs));
}

export interface TechLiveStats {
  eventos: number;
  practico: number | null;
  teorico: number | null;
  itt: number | null;
  erroresCriticos: number;
  ultimoEvento: number | null;
}

export interface LiveAnalytics {
  technicians: Technician[];
  alerts: SupervisorAlert[];
  stats: Record<string, TechLiveStats>;
  errorRecurrence: typeof ERROR_RECURRENCE;
  fleet: { eventos: number; tecnicosActivos: number; itt: number | null; retencionPromedio: number };
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/**
 * Funde los técnicos base (+ simulaciones del supervisor) con la telemetría real.
 * `anchors` = día del programa en que cada técnico empezó a usar la app (día simulado 0).
 */
export function applyTelemetry(
  base: Technician[],
  events: TelemetryEvent[],
  anchors: Record<string, number>,
  baseRecurrence: typeof ERROR_RECURRENCE,
): LiveAnalytics {
  const byTech = new Map<string, TelemetryEvent[]>();
  [...events].sort((a, b) => a.timestamp - b.timestamp).forEach((e) => {
    if (!byTech.has(e.tecnicoId)) byTech.set(e.tecnicoId, []);
    byTech.get(e.tecnicoId)!.push(e);
  });

  const alerts: SupervisorAlert[] = [];
  const stats: Record<string, TechLiveStats> = {};
  const recurrence = structuredClone(baseRecurrence);
  const out = new Map(base.map((t) => [t.id, t]));
  const catRow: Record<ErrorCategory, string> = {
    loto: 'Protocolo LOTO',
    torque: 'Pares de apriete',
    sbom: 'Selección SBOM',
    aislamiento: 'Aislamiento AV',
    diagnostico: 'Diagnóstico CAN',
  };
  const now = Date.now();

  for (const [id, evs] of byTech) {
    let t: Technician = out.get(id) ?? newTechnician(evs[0]);
    const anchor = anchors[id] ?? t.currentDay;
    const dayOf = (e: TelemetryEvent) => anchor + Math.max(0, e.diaSimulado || 0);
    const ire: IreBreakdown = structuredClone(t.ire);
    const reviews = [...t.reviews];
    const log: FeedbackEntry[] = [...t.log];
    const seen = new Map<string, number>();
    let sections = t.sections;
    let delegation = t.delegationScore;
    let currentDay = t.currentDay;
    const practical: number[] = [];
    const theory: number[] = [];
    let critical = 0;

    const entry = (e: TelemetryEvent, p: Omit<FeedbackEntry, 'id' | 'day' | 'date'>) => {
      const day = dayOf(e);
      log.unshift({ id: e.eventId, day, date: dayToDate(day), ...p });
    };
    const alert = (e: TelemetryEvent, nivel: SupervisorAlert['nivel'], mensaje: string) =>
      alerts.push({ id: `${e.eventId}-${nivel}`, tecnicoId: id, tecnico: t.name, nivel, mensaje, timestamp: e.timestamp });

    for (const e of evs) {
      const p = e.payload;
      currentDay = Math.max(currentDay, dayOf(e));

      if (ERROR_TYPES.has(e.tipo) && p.categoria) {
        const cat = p.categoria;
        const key = `${cat}|${p.componente ?? p.tag ?? ''}`;
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        ire[cat] = { total: ire[cat].total + 1, repeated: ire[cat].repeated + (n >= 2 ? 1 : 0) };
        const mode = e.modo === 'Rescate en Ruta' ? 'Rescate en Ruta' : 'Taller';
        (['30d', '90d'] as const).forEach((per) => {
          const row = recurrence[per].find((r) => r.category === catRow[cat]);
          if (row && now - e.timestamp <= (per === '30d' ? 30 : 90) * 86_400_000) row[mode] += 1;
        });
        if (e.tipo === 'seguridad.error_critico') {
          critical++;
          alert(e, 'critica', `Error crítico de seguridad: ${p.etiqueta ?? p.tag}${p.componente ? ` en ${p.componente}` : ''} (${p.actividad ?? e.modo}).`);
        }
        if (n === 2) alert(e, 'alta', `Error repetido en el mismo componente: ${p.etiqueta ?? p.tag}${p.componente ? ` · ${p.componente}` : ''}.`);
        continue;
      }

      switch (e.tipo) {
        case 'diagnostico.completado': {
          if (p.score != null) theory.push(p.score);
          entry(e, {
            mode: 'Taller',
            module: `Diagnóstico inicial · ASE ${e.tecnico.especialidadASE}`,
            failure: `Nivel detectado: ${p.nivelDetectado ?? '—'} · ${p.score ?? '—'}/100.`,
            recommendation: 'Ruta adaptativa generada en la app del técnico.',
            score: p.score ?? 0,
            passed: (p.score ?? 0) >= PASS_THRESHOLD,
            retentionAtExam: 100,
          });
          break;
        }
        case 'examen.post':
        case 'examen.diferido': {
          const day = dayOf(e);
          const score = p.score ?? 0;
          theory.push(score);
          const prev = lastReview(reviews, day);
          const R = retention(day - prev.day, prev.stability);
          const S = e.tipo === 'examen.post' ? Math.min(160, prev.stability * 1.2) : adjustStability(prev.stability, day - prev.day, score);
          // un único punto de repaso por día (la curva diente de sierra usa el día como clave)
          const same = reviews.findIndex((r) => r.day === day && r.score !== null);
          if (same >= 0) reviews[same] = { day, stability: S, score };
          else reviews.push({ day, stability: S, score });
          const passed = score >= PASS_THRESHOLD;
          entry(e, {
            mode: 'Taller',
            module: `${e.tipo === 'examen.post' ? 'Post-test' : 'Examen diferido'} · app del técnico${e.moduloId ? ` · ${e.moduloId}` : ''}`,
            failure: passed ? `Aprobó con ${score}/100.` : `Reprobó con ${score}/100${p.retencion != null ? ` (retención ${p.retencion} %)` : ''}.`,
            recommendation: passed ? `S → ${S.toFixed(0)} d. Próximo repaso en ${Math.round(S * 0.5)} días.` : `S → ${S.toFixed(0)} d. Activar examen de refuerzo.`,
            score,
            passed,
            retentionAtExam: Math.round(R * 100),
          });
          if (!passed && e.tipo === 'examen.diferido') alert(e, 'alta', `Reprobó el examen diferido (${score}/100). Retención estimada ${Math.round(R * 100)} %.`);
          if (passed) sections = advanceSections({ ...t, sections }, 10);
          break;
        }
        case 'leccion.completada':
          if (p.passed !== false) sections = advanceSections({ ...t, sections }, 4);
          break;
        case 'practica.completada': {
          if (p.score != null) practical.push(p.score);
          if (p.passed) sections = advanceSections({ ...t, sections }, 8);
          const mode = e.modo === 'Rescate en Ruta' ? 'Rescate en Ruta' : 'Taller';
          entry(e, {
            mode,
            module: `${p.titulo ?? p.actividad ?? 'Práctica'}${e.moduloId ? ` · ${e.moduloId}` : ''}`,
            failure: p.passed ? `Aprobó con ${p.score}/100.` : `No aprobó (${p.score}/100)${p.etiqueta ? ` · ${p.etiqueta}` : ''}.`,
            recommendation: p.passed ? 'Práctica consolidada.' : 'Repetir en modo guiado antes de evaluar.',
            score: p.score ?? 0,
            passed: !!p.passed,
            retentionAtExam: Math.round(retention(dayOf(e) - lastReview(reviews, dayOf(e)).day, lastReview(reviews, dayOf(e)).stability) * 100),
          });
          break;
        }
        case 'delegacion.solicitada':
          delegation = Math.min(100, delegation + 2);
          alert(e, 'media', `Solicita delegación a especialidad ${p.especialidadDestino ?? '—'}: ${p.motivo ?? ''}`);
          break;
        default:
          break;
      }
    }

    reviews.sort((a, b) => a.day - b.day);
    const pr = mean(practical);
    const th = mean(theory);
    const itt = pr != null && th ? Math.round((pr / th) * 100) / 100 : null;
    t = { ...t, ire, reviews, log, sections, delegationScore: delegation, currentDay };
    const R15 = projectedRetention(t);
    if (R15 < 0.5) alerts.push({ id: `${id}-R15`, tecnicoId: id, tecnico: t.name, nivel: 'alta', mensaje: `Retención proyectada a 15 d de ${Math.round(R15 * 100)} %: programar repaso.`, timestamp: evs[evs.length - 1].timestamp });
    if (itt != null && itt < 0.7) alerts.push({ id: `${id}-ITT`, tecnicoId: id, tecnico: t.name, nivel: 'media', mensaje: `ITT ${itt.toFixed(2)}: buen desempeño teórico, baja transferencia al taller.`, timestamp: evs[evs.length - 1].timestamp });
    stats[id] = { eventos: evs.length, practico: pr, teorico: th, itt, erroresCriticos: critical, ultimoEvento: evs[evs.length - 1]?.timestamp ?? null };
    out.set(id, t);
  }

  const technicians = [...out.values()];
  const allPr = Object.values(stats).map((s) => s.practico).filter((x): x is number => x != null);
  const allTh = Object.values(stats).map((s) => s.teorico).filter((x): x is number => x != null);
  const prM = mean(allPr);
  const thM = mean(allTh);
  return {
    technicians,
    alerts: alerts.sort((a, b) => b.timestamp - a.timestamp),
    stats,
    errorRecurrence: recurrence,
    fleet: {
      eventos: events.length,
      tecnicosActivos: byTech.size,
      itt: prM != null && thM ? Math.round((prM / thM) * 100) / 100 : null,
      retencionPromedio: technicians.length
        ? technicians.reduce((a, t) => {
            const r = lastReview(t.reviews, t.currentDay);
            return a + retention(t.currentDay - r.day, r.stability);
          }, 0) / technicians.length
        : 0,
    },
  };
}

export const categoryLabel = (c: ErrorCategory) => CATEGORY_LABEL[c];
