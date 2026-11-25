import type {
  ErrorCategory,
  FeedbackEntry,
  IreBreakdown,
  ReviewPoint,
  RiskLevel,
  Technician,
  WorkMode,
} from '../types';

/** Curva de olvido de Ebbinghaus simplificada: R(t) = e^(-t/S). */
export const retention = (t: number, S: number) => Math.exp(-t / S);

export const PASS_THRESHOLD = 70;
export const SIM_STEP_DAYS = 15;

export const lastReview = (reviews: ReviewPoint[], day: number): ReviewPoint => {
  let r = reviews[0];
  for (const rv of reviews) if (rv.day <= day) r = rv;
  return r;
};

/** Retención actual del técnico en su día actual (0-1). */
export const currentRetention = (tech: Technician) => {
  const r = lastReview(tech.reviews, tech.currentDay);
  return retention(tech.currentDay - r.day, r.stability);
};

/**
 * Peso por criticidad eléctrica / de seguridad de cada categoría de error.
 * Un error repetido de LOTO o aislamiento AV pesa más que uno de SBOM.
 */
export const IRE_WEIGHTS: Record<ErrorCategory, number> = {
  loto: 3,
  aislamiento: 2.5,
  torque: 1.5,
  sbom: 1,
  diagnostico: 1,
};

/**
 * IRE ponderado (0-1):  IRE = Σ w_c · repetidos_c  /  Σ w_c · totales_c
 * con w_c = IRE_WEIGHTS (criticidad eléctrica/seguridad).
 */
export const ireValue = (ire: IreBreakdown) => {
  let total = 0;
  let rep = 0;
  for (const k of Object.keys(ire) as ErrorCategory[]) {
    total += IRE_WEIGHTS[k] * ire[k].total;
    rep += IRE_WEIGHTS[k] * ire[k].repeated;
  }
  return total === 0 ? 0 : rep / total;
};

/** IRE ponderado de toda la flota (agrega numeradores y denominadores). */
export const fleetIre = (techs: { ire: IreBreakdown }[]) => {
  let total = 0;
  let rep = 0;
  techs.forEach((t) =>
    (Object.keys(t.ire) as ErrorCategory[]).forEach((k) => {
      total += IRE_WEIGHTS[k] * t.ire[k].total;
      rep += IRE_WEIGHTS[k] * t.ire[k].repeated;
    }),
  );
  return total === 0 ? 0 : rep / total;
};

export const ireCategoryValue = (ire: IreBreakdown, k: ErrorCategory) =>
  ire[k].total === 0 ? 0 : ire[k].repeated / ire[k].total;

/** Retención proyectada a la próxima ventana de examen diferido (hoy + 15 d). */
export const projectedRetention = (tech: Technician, ahead = 15) => {
  const r = lastReview(tech.reviews, tech.currentDay);
  return retention(tech.currentDay + ahead - r.day, r.stability);
};

export const riskOf = (tech: Technician): RiskLevel => {
  const R = projectedRetention(tech);
  const ire = ireValue(tech.ire);
  const score = (1 - R) * 0.45 + ire * 0.4 + (1 - tech.delegationScore / 100) * 0.15;
  if (score >= 0.52) return 'Alto';
  if (score >= 0.34) return 'Medio';
  return 'Bajo';
};

/** Serie diente-de-sierra: historial real hasta el día actual + proyección punteada. */
export const buildSawtooth = (tech: Technician, horizon = 45) => {
  const end = tech.currentDay + horizon;
  const pts: { t: number; real: number | null; proyeccion: number | null }[] = [];
  for (let t = 0; t <= end; t++) {
    const r = lastReview(tech.reviews, t);
    const R = Math.round(retention(t - r.day, r.stability) * 1000) / 10;
    pts.push({
      t,
      real: t <= tech.currentDay ? R : null,
      proyeccion: t >= tech.currentDay ? R : null,
    });
  }
  return pts;
};

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  loto: 'Protocolo LOTO',
  torque: 'Pares de apriete',
  sbom: 'Selección SBOM',
  aislamiento: 'Aislamiento AV',
  diagnostico: 'Diagnóstico CAN/OBD',
};

const FAILURES: Record<ErrorCategory, string[]> = {
  loto: [
    'Omitió verificación de ausencia de tensión (< 60 V CC) tras el bloqueo del MSD.',
    'Colocó candado LOTO sin tarjeta de identificación personal en el seccionador.',
    'No esperó el tiempo de descarga de condensadores del inversor (5 min).',
  ],
  torque: [
    'Aplicó 180 N·m en tuercas de rueda (especificación 650 N·m ± 30 en estrella).',
    'Secuencia de apriete incorrecta en barra colectora de batería (no siguió patrón cruzado).',
    'Torque sin llave calibrada en terminales HV (especificación 9 N·m ± 1).',
  ],
  sbom: [
    'Seleccionó filtro de combustible primario en lugar del separador de agua (código cruzado).',
    'Pidió conector HV de 2 pines cuando el kit de rescate requiere el de 3 pines con interlock.',
    'No validó la revisión de pieza (Rev. B obsoleta) contra el SBOM del módulo.',
  ],
  aislamiento: [
    'Midió resistencia de aislamiento con multímetro común en vez de megóhmetro a 1000 V.',
    'Aceptó lectura de 180 kΩ (mínimo requerido 500 Ω/V · 650 V = 325 kΩ).',
  ],
  diagnostico: [
    'Interpretó DTC P0A0F como falla de motor en lugar de interlock HVIL abierto.',
    'No consultó el bus CAN J1939 antes de sustituir el módulo ECU.',
  ],
};

const RECOMMENDATIONS: Record<ErrorCategory, string[]> = {
  loto: [
    'Reforzar Sección 1 · Micro-cápsula "Verificación de 3 puntos" en Visor AR antes de cualquier intervención HV.',
    'Asignar simulación guiada LOTO con checklist bloqueante en la app móvil (5 min diarios × 3 días).',
  ],
  torque: [
    'Activar overlay AR de secuencia de apriete con valores N·m sobre cada tornillo detectado.',
    'Repetir práctica de Sección 2 con llave dinamométrica Bluetooth y validación automática.',
  ],
  sbom: [
    'Habilitar escaneo obligatorio de código de pieza contra SBOM antes de cerrar la orden.',
    'Módulo corto "Lectura de revisiones de pieza" + quiz de 6 reactivos con piezas similares.',
  ],
  aislamiento: [
    'Reasignar práctica con megóhmetro: cálculo Ω/V con 3 casos reales del depósito.',
  ],
  diagnostico: [
    'Delegar casos HVIL a Nivel Ingeniero y asignar árbol de decisión DTC → componente en Nivel Técnico.',
  ],
};

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(Math.floor(seed)) % arr.length];

/** Pseudoaleatorio determinista para que la demo sea reproducible. */
export const seeded = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const fmtDate = (day: number) => {
  const base = new Date(2026, 7, 1); // 1-ago-2026 = día 0 del programa
  base.setDate(base.getDate() + day);
  return base.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const dayToDate = fmtDate;

/* ───────────── Examen de refuerzo ───────────── */

/** Puntaje mínimo aceptable en evaluaciones; debajo de esto se sugiere refuerzo. */
export const REINFORCEMENT_THRESHOLD = 75;

const weakestCategory = (ire: IreBreakdown): ErrorCategory => {
  const cats = Object.keys(ire) as ErrorCategory[];
  return cats.reduce((a, b) =>
    ire[b].repeated / Math.max(1, ire[b].total) > ire[a].repeated / Math.max(1, ire[a].total) ? b : a,
  );
};

/** Última evaluación con puntaje (examen diferido o de refuerzo). */
export const lastScore = (tech: Technician) => tech.log[0]?.score ?? null;

/** Ponderación baja: la última evaluación o el promedio de las 3 últimas queda bajo el umbral. */
export const needsReinforcement = (tech: Technician) => {
  const scores = tech.log.slice(0, 3).map((e) => e.score);
  if (!scores.length) return false;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return scores[0] < REINFORCEMENT_THRESHOLD || avg < REINFORCEMENT_THRESHOLD;
};

export const activateReinforcement = (tech: Technician): Technician => {
  const category = weakestCategory(tech.ire);
  const last = lastScore(tech);
  return {
    ...tech,
    reinforcement: {
      category,
      activatedDay: tech.currentDay,
      activatedAt: new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      questions: tech.lexicalLevel === 'Operativo' ? 8 : tech.lexicalLevel === 'Técnico' ? 10 : 12,
      reason: `Última evaluación ${last ?? '—'}/100 (umbral ${REINFORCEMENT_THRESHOLD}). Categoría con mayor redundancia: ${CATEGORY_LABEL[category]}.`,
    },
  };
};

export const cancelReinforcement = (tech: Technician): Technician => ({ ...tech, reinforcement: null });

/**
 * Aplica el examen de refuerzo (3 días después de activarlo): enfocado en la categoría
 * más débil, con bonificación por práctica dirigida. Aprobar consolida S y baja la redundancia.
 */
export const applyReinforcementExam = (tech: Technician): Technician => {
  const rf = tech.reinforcement;
  if (!rf) return tech;
  const day = tech.currentDay + 3;
  const prev = lastReview(tech.reviews, tech.currentDay);
  const R = retention(day - prev.day, prev.stability);
  const noise = (seeded(day * 5 + tech.id.charCodeAt(2)) - 0.5) * 12;
  const score = Math.max(30, Math.min(100, Math.round(58 + R * 35 + noise)));
  const passed = score >= PASS_THRESHOLD;
  const newS = Math.min(160, prev.stability * (passed ? 1.7 : 1.4));
  const k = rf.category;
  const ire: IreBreakdown = {
    ...tech.ire,
    [k]: passed
      ? { total: tech.ire[k].total + 1, repeated: Math.max(0, tech.ire[k].repeated - 2) }
      : { total: tech.ire[k].total + 1, repeated: tech.ire[k].repeated + 1 },
  };
  const entry: FeedbackEntry = {
    id: `${tech.id}-rf-${day}`,
    day,
    date: fmtDate(day),
    mode: 'Taller',
    module: `Examen de refuerzo · ${CATEGORY_LABEL[k]} (${rf.questions} reactivos)`,
    failure: passed
      ? `Aprobó el refuerzo con ${score}/100. Se corrigió el patrón de error recurrente.`
      : pick(FAILURES[k], day + 2),
    recommendation: passed
      ? `Refuerzo cerrado. S → ${newS.toFixed(0)} d. Reincorporar al ciclo normal de exámenes diferidos.`
      : `${pick(RECOMMENDATIONS[k], day + 1)} Se sugiere repetir el refuerzo en 7 días.`,
    score,
    passed,
    retentionAtExam: Math.round(R * 100),
  };
  return {
    ...tech,
    currentDay: day,
    reviews: [...tech.reviews, { day, stability: newS, score }],
    ire,
    delegationScore: Math.max(0, Math.min(100, tech.delegationScore + (passed ? 4 : -2))),
    log: [entry, ...tech.log],
    reinforcement: null,
  };
};

/**
 * Simula el paso de 15 días y un examen diferido:
 *  - la puntuación depende de la retención al momento del examen
 *  - aprobar amplía S (efecto de repaso espaciado); reprobar la reduce y suma error redundante
 */
export const simulateDeferredExam = (tech: Technician): Technician => {
  const day = tech.currentDay + SIM_STEP_DAYS;
  const prev = lastReview(tech.reviews, tech.currentDay);
  const R = retention(day - prev.day, prev.stability);
  const noise = (seeded(day + tech.id.charCodeAt(1) * 7) - 0.5) * 18;
  const levelBonus = tech.lexicalLevel === 'Ingeniero' ? 6 : tech.lexicalLevel === 'Técnico' ? 3 : 0;
  const score = Math.max(20, Math.min(100, Math.round(45 + R * 55 + noise + levelBonus)));
  const passed = score >= PASS_THRESHOLD;
  // aprobar consolida (repaso espaciado ×1.6); reprobar dispara refuerzo modular (×1.35)
  const newS = Math.min(160, prev.stability * (passed ? 1.6 : 1.35));

  // categoría más débil = mayor proporción repetida
  const cats = Object.keys(tech.ire) as ErrorCategory[];
  const weakest = cats.reduce((a, b) =>
    tech.ire[b].repeated / Math.max(1, tech.ire[b].total) > tech.ire[a].repeated / Math.max(1, tech.ire[a].total) ? b : a,
  );
  const mode: WorkMode = seeded(day * 3 + 1) > 0.5 ? 'Rescate en Ruta' : 'Taller';

  const ire: IreBreakdown = { ...tech.ire };
  if (passed) {
    // un repaso exitoso consolida: baja la redundancia de la categoría débil
    ire[weakest] = { ...ire[weakest], total: ire[weakest].total + 1, repeated: Math.max(0, ire[weakest].repeated - 1) };
  } else {
    ire[weakest] = { total: ire[weakest].total + 1, repeated: ire[weakest].repeated + 1 };
  }

  const entry: FeedbackEntry = {
    id: `${tech.id}-${day}`,
    day,
    date: fmtDate(day),
    mode,
    module: `${CATEGORY_LABEL[weakest]} · Examen diferido D+${day - prev.day}`,
    failure: passed
      ? `Aprobó con ${score}/100. Error residual: ${pick(FAILURES[weakest], day).toLowerCase()}`
      : pick(FAILURES[weakest], day + 1),
    recommendation: passed
      ? `Consolidado. Próximo repaso espaciado en ${Math.round(newS * 0.5)} días (S → ${newS.toFixed(0)} d).`
      : pick(RECOMMENDATIONS[weakest], day),
    score,
    passed,
    retentionAtExam: Math.round(R * 100),
  };

  const sections = tech.sections.map((s) => ({ ...s }));
  if (passed) {
    const active = sections.find((s) => s.status === 'en curso');
    if (active) {
      active.progress = Math.min(100, active.progress + 25);
      if (active.progress >= 100) {
        active.status = 'aprobada';
        const next = sections.find((s) => s.status === 'bloqueada');
        if (next) {
          next.status = 'en curso';
          next.progress = 5;
        }
      }
    }
  }

  return {
    ...tech,
    currentDay: day,
    reviews: [...tech.reviews, { day, stability: newS, score }],
    ire,
    sections,
    delegationScore: Math.max(0, Math.min(100, tech.delegationScore + (passed ? 3 : -4))),
    hvCertified:
      tech.hvCertified || (tech.specialty === 'Alto Voltaje' && sections.every((s) => s.status === 'aprobada')),
    log: [entry, ...tech.log],
  };
};
