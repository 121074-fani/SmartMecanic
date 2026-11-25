/* =========================================================
   Equipo simulado: 40 técnicos en 4 talleres
   Datos SIMULADOS (semilla fija → siempre los mismos resultados)
   para analizar en qué se equivoca más la gente.
   ========================================================= */
const COMP_IDS_TEAM = COMPETENCIAS.map(c => c.id);
const TALLERES = ['Taller Norte · Monterrey', 'Taller Centro · CDMX', 'Taller Bajío · León', 'Taller Occidente · Guadalajara'];

/* Catálogo de errores observables en las prácticas.
   tags: etiquetas que la app registra para el técnico real (para sumarlo al análisis)
   steps: en qué paso de qué proceso ocurre (para «paso más difícil») */
const ERROR_CATALOG = [
  // Seguridad
  { id: '0v', cat: 'Seguridad', safety: true, comp: 'hv', base: 0.17, label: 'Intervenir alto voltaje sin verificar 0 V',
    where: 'Aprende haciendo · Inversor (paso 2) y Simulador eléctrico', tags: ['no-verificar-ausencia-tension', 'intervenir-av-sin-verificar'],
    steps: [['inversor', 1]], action: { text: 'Asignar la micro-lección «Verificación de ausencia de tensión» y repetir el inversor en modo guiado', route: 'leccion/hv2' } },
  { id: 'epp', cat: 'Seguridad', safety: true, comp: 'hv', base: 0.13, label: 'Tocar un componente de alto voltaje sin guantes dieléctricos',
    where: 'Aprende haciendo · Inversor (paso 1) y Taller virtual', tags: ['av-sin-epp', 'epp-inadecuado'],
    steps: [['inversor', 0]], action: { text: 'Reforzar la secuencia de EPP con la lección «Desenergización segura»', route: 'leccion/hv1' } },
  { id: 'noaisl', cat: 'Seguridad', safety: true, comp: 'hv', base: 0.1, label: 'Usar herramienta no aislada en alto voltaje',
    where: 'Aprende haciendo · Inversor (paso 3) y Taller virtual', tags: ['herramienta-no-aislada-av'],
    steps: [['inversor', 2]], action: { text: 'Revisar la ficha de la herramienta aislada en el Taller virtual', route: 'taller' } },
  { id: 'bornes', cat: 'Seguridad', safety: true, comp: 'elec', base: 0.2, label: 'Secuencia insegura de bornes (positivo antes que negativo)',
    where: 'Aprende haciendo · Batería 24 V (pasos 2 y 5)', tags: ['secuencia-bornes'],
    steps: [['baterias', 1], ['baterias', 4], ['bujias', 0]], action: { text: 'Practicar «Reemplazo de batería de 24 V» en modo guiado', route: 'aprende/baterias' } },
  // Procedimiento
  { id: 'cruz', cat: 'Procedimiento', comp: 'ev', base: 0.42, label: 'Aflojar o apretar tornillos fuera del orden en cruz',
    where: 'Aprende haciendo · Inversor (pasos 3 y 5)', tags: ['proc-orden-incorrecto'],
    steps: [['inversor', 2], ['inversor', 4]], action: { text: 'Agregar una tarjeta sobre el orden en cruz a la micro-cápsula del inversor', route: 'aprende/inversor' } },
  { id: 'torque', cat: 'Procedimiento', comp: 'diag', base: 0.34, label: 'Torque fuera de especificación',
    where: 'Barra colectora, abrazaderas, bornes y bujía', tags: ['proc-torque-incorrecto'],
    steps: [['inversor', 3], ['inversor', 4], ['intercooler', 3], ['bujias', 7]], action: { text: 'Practicar los apriete en el Taller virtual consultando la ficha de la pieza', route: 'taller' } },
  { id: 'herr', cat: 'Procedimiento', comp: 'diag', base: 0.3, label: 'Usar una herramienta incorrecta para el paso',
    where: 'Taller virtual y Aprende haciendo', tags: ['proc-herramienta-incorrecta', 'herramienta-incorrecta'],
    steps: [['intercooler', 1], ['baterias', 2]], action: { text: 'Repasar el catálogo de herramientas del Taller virtual', route: 'taller' } },
  { id: 'kit', cat: 'Procedimiento', comp: 'hv', base: 0.37, label: 'Elegir herramientas trampa al armar el kit (p. ej. guantes de nitrilo)',
    where: 'Aprende haciendo · mini-juego «Arma tu kit»', tags: ['kit-incorrecto'],
    steps: [], action: { text: 'Explicar en la micro-cápsula por qué cada trampa no sirve', route: 'aprende' } },
  { id: 'verif', cat: 'Procedimiento', comp: 'diag', base: 0.22, label: 'No verificar la reparación al final',
    where: 'Simulador de fallas y Taller virtual', tags: ['no-verificar-reparacion'],
    steps: [['intercooler', 4]], action: { text: 'Reforzar el paso 6 del método de diagnóstico', route: 'leccion/diag1' } },
  // Diagnóstico
  { id: 'cambiar', cat: 'Diagnóstico', comp: 'diag', base: 0.47, label: 'Cambiar piezas sin diagnosticar',
    where: 'Simulador de fallas (eléctrico, diésel y CAN)', tags: ['cambiar-piezas-sin-diagnostico'],
    steps: [], action: { text: 'Asignar «Método de diagnóstico en 6 pasos» y el escenario diésel', route: 'leccion/diag1' } },
  { id: 'can', cat: 'Diagnóstico', comp: 'con', base: 0.36, label: 'Interpretar mal la medición de la red CAN (120 Ω como normal)',
    where: 'Simulador de fallas · CAN y Taller · red CAN', tags: ['interpretacion-can'],
    steps: [], action: { text: 'Asignar la micro-lección «Red CAN y J1939»', route: 'leccion/con1' } },
  { id: 'megohm', cat: 'Diagnóstico', comp: 'ev', base: 0.29, label: 'Medir aislamiento con continuidad en vez de megóhmetro',
    where: 'Simulador eléctrico (paso 4)', tags: [],
    steps: [], action: { text: 'Asignar «Monitoreo de aislamiento y fallas típicas»', route: 'leccion/ev2' } },
  { id: 'provisional', cat: 'Diagnóstico', comp: 'diesel', base: 0.24, label: 'Reparación provisional (cinta, sellador)',
    where: 'Aprende haciendo · Intercooler y Simulador diésel', tags: ['reparacion-provisional'],
    steps: [['intercooler', 2]], action: { text: 'Mostrar en la micro-cápsula por qué la cinta no es reparación', route: 'aprende/intercooler' } },
  // Identificación de piezas (Señala la pieza)
  { id: 'id-conn', cat: 'Identificación', comp: 'diesel', base: 0.44, label: 'Confundir la bobina de encendido con su conector',
    pair: ['Bobina de encendido', 'Conector de la bobina'], where: 'Señala la pieza · Cambio de bujía (pasos 2–3)', tags: [],
    steps: [['bujias', 1], ['bujias', 2]], action: { text: 'Agregar una tarjeta con foto de la bobina y su conector', route: 'senala/bujias' } },
  { id: 'id-dado', cat: 'Identificación', comp: 'diesel', base: 0.38, label: 'Elegir el dado común en lugar del dado de bujías',
    pair: ['Dado para bujías', 'Dado común 13 mm'], where: 'Señala la pieza · Cambio de bujía (paso 4)', tags: [],
    steps: [['bujias', 3]], action: { text: 'Explicar el inserto de hule del dado de bujías', route: 'senala/bujias' } },
  { id: 'id-cil', cat: 'Identificación', comp: 'diesel', base: 0.31, label: 'Contar los cilindros desde el lado equivocado',
    pair: ['Bobina del cilindro 1', 'Bobina del cilindro 6'], where: 'Señala la pieza · Cambio de bujía (paso 3)', tags: [],
    steps: [['bujias', 2]], action: { text: 'Recordar que el cilindro 1 está del lado de la polea', route: 'senala/bujias' } },
  { id: 'id-galgas', cat: 'Identificación', comp: 'diesel', base: 0.27, label: 'No reconocer el calibrador de galgas',
    pair: ['Calibrador de galgas', 'Llave de torque'], where: 'Señala la pieza · Cambio de bujía (paso 6)', tags: [],
    steps: [['bujias', 5]], action: { text: 'Agregar la ficha del calibrador de galgas al Taller', route: 'senala/bujias' } },
  { id: 'id-puente', cat: 'Identificación', comp: 'elec', base: 0.23, label: 'Confundir el puente entre baterías con el cable positivo',
    pair: ['Puente A– / B+', 'Cable positivo principal'], where: 'Señala la pieza · Reemplazo de batería (paso 3)', tags: [],
    steps: [['baterias', 1]], action: { text: 'Repetir «Reemplazo de batería» en Señala la pieza', route: 'senala/bateria24' } },
  { id: 'id-borne', cat: 'Identificación', comp: 'elec', base: 0.21, label: 'Señalar el borne positivo en vez del negativo',
    pair: ['Borne negativo (–)', 'Borne positivo (+)'], where: 'Señala la pieza · Cambio de bujía (pasos 1 y 12)', tags: [],
    steps: [['bujias', 0], ['bujias', 11]], action: { text: 'Reforzar colores y símbolos de los bornes', route: 'senala/bujias' } },
  { id: 'id-grasa', cat: 'Identificación', comp: 'diesel', base: 0.18, label: 'No reconocer la grasa dieléctrica',
    pair: ['Grasa dieléctrica', 'Calibrador de galgas'], where: 'Señala la pieza · Cambio de bujía (paso 9)', tags: [],
    steps: [['bujias', 8]], action: { text: 'Explicar para qué sirve la grasa dieléctrica', route: 'senala/bujias' } },
];
const ERROR_CATS = ['Seguridad', 'Procedimiento', 'Diagnóstico', 'Identificación'];

/* Procesos para el análisis «paso más difícil» */
const TEAM_PROCESSES = [
  { id: 'bujias', name: 'Cambio de bujía', steps: () => SENALA[0].steps.map(s => s.short) },
  { id: 'inversor', name: 'Inversor de tracción', steps: () => SIMS.find(s => s.id === 'inversor').steps.map(s => s.title) },
  { id: 'intercooler', name: 'Manguera del intercooler', steps: () => SIMS.find(s => s.id === 'intercooler').steps.map(s => s.title) },
  { id: 'baterias', name: 'Batería de 24 V', steps: () => SIMS.find(s => s.id === 'baterias').steps.map(s => s.title) },
];

/* ---------- Generador determinista ---------- */
(() => {
  let seed = 20261124;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2;            // ≈ normal(0, 0.58)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pickW = w => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1; };
  const NAMES = ['A. Ramírez', 'M. Torres', 'L. Hernández', 'J. Castillo', 'R. Gómez', 'P. Vargas', 'S. Méndez', 'D. Ortega', 'C. Flores', 'E. Morales',
    'F. Jiménez', 'G. Ruiz', 'H. Aguilar', 'I. Cruz', 'K. Reyes', 'N. Medina', 'O. Castro', 'Q. Romero', 'T. Herrera', 'U. Navarro',
    'V. Domínguez', 'Y. Salazar', 'Z. Guerrero', 'A. Mendoza', 'B. Rojas', 'C. Delgado', 'D. Ibarra', 'E. Cortés', 'F. Soto', 'G. Luna',
    'H. Ríos', 'I. Peña', 'J. Valdez', 'K. Campos', 'L. Fuentes', 'M. Cabrera', 'N. Ponce', 'O. Sandoval', 'P. Acosta', 'R. Espinoza'];
  const ROLE_W = { ev: 0.3, diesel: 0.3, elec: 0.2, nuevo: 0.2 };
  const ROLE_BONUS = {
    ev: { hv: 12, ev: 12, diesel: -14, elec: 4, sw: 2, con: 0, diag: 2 },
    diesel: { hv: -10, ev: -12, diesel: 14, elec: 0, sw: -4, con: -4, diag: 4 },
    elec: { hv: 0, ev: 0, diesel: -8, elec: 12, sw: 10, con: 12, diag: 6 },
    nuevo: { hv: -8, ev: -8, diesel: -6, elec: -6, sw: -6, con: -8, diag: -10 },
  };
  // cada taller tiene un patrón distinto, para que el análisis por taller sea interesante
  const TALLER_MOD = [
    { Seguridad: 1.6, Procedimiento: 1.0, Diagnóstico: 0.95, Identificación: 1.0 },   // Norte: más violaciones de seguridad
    { Seguridad: 0.8, Procedimiento: 0.85, Diagnóstico: 0.9, Identificación: 0.85 },  // Centro: el mejor
    { Seguridad: 1.0, Procedimiento: 1.1, Diagnóstico: 1.0, Identificación: 1.45 },   // Bajío: confunde piezas
    { Seguridad: 1.0, Procedimiento: 1.0, Diagnóstico: 1.4, Identificación: 1.0 },    // Occidente: cambia piezas sin diagnosticar
  ];
  // preguntas "trampa": se fallan más de lo esperado
  const Q_TRAP = { 'con-3': 0.22, 'hv-5': 0.15, 'sw-3': 0.14, 'diesel-4': 0.12, 'elec-5': 0.16, 'ev-5': 0.1, 'diag-5': 0.12, 'con-5': 0.14 };
  const procSteps = Object.fromEntries(TEAM_PROCESSES.map(p => [p.id, p.steps().length]));

  const team = NAMES.map((name, i) => {
    const role = Object.keys(ROLE_W)[pickW(Object.values(ROLE_W))];
    const ti = i % 4;
    const skill = clamp(64 + gauss() * 24 + (role === 'nuevo' ? -8 : 0) + (ti === 1 ? 5 : 0), 25, 92);
    const m = Object.fromEntries(COMP_IDS_TEAM.map(c => [c, Math.round(clamp(skill + ROLE_BONUS[role][c] + gauss() * 18, 12, 98))]));
    const pre = Math.round(clamp(skill - 18 + gauss() * 10, 10, 85));
    const post = Math.round(clamp(pre + 16 + rnd() * 22, pre, 98));
    const delayed = Math.round(clamp(post - (3 + rnd() * 14) - (role === 'nuevo' ? 3 : 0), 10, post));
    // errores del catálogo
    const errCounts = {};
    ERROR_CATALOG.forEach(e => {
      let p = 0.8 * e.base * TALLER_MOD[ti][e.cat] * (1.5 - m[e.comp] / 100);
      if (role === 'nuevo') p *= 1.3;
      if (role === 'diesel' && e.comp === 'hv') p *= 1.35;
      if (role === 'ev' && e.comp === 'diesel') p *= 1.3;
      if (role === 'elec' && (e.id === 'can' || e.comp === 'elec')) p *= 0.6;
      p = clamp(p, 0.01, 0.92);
      if (rnd() < p) errCounts[e.id] = 1 + (rnd() < p * 0.7 ? 1 : 0) + (rnd() < p * 0.35 ? 1 : 0);
    });
    // respuestas a preguntas: 0 = correcta; 1..3 = opción equivocada elegida
    const answers = {};
    QUESTIONS.forEach(q => {
      const diff = q.lvl === 1 ? 1.12 : q.lvl === 2 ? 0.95 : 0.78;
      const pOk = clamp(m[q.c] / 100 * diff - (Q_TRAP[q.id] || 0) + 0.08, 0.08, 0.97);
      answers[q.id] = rnd() < pOk ? 0 : 1 + pickW([3.2, 1.3, 0.8]);
    });
    // errores por paso de cada proceso (los del catálogo + una base pequeña)
    const stepErr = {};
    Object.entries(procSteps).forEach(([pid, n]) => {
      stepErr[pid] = Array.from({ length: n }, (_, k) => {
        const hit = ERROR_CATALOG.some(e => errCounts[e.id] && e.steps.some(([sp, sk]) => sp === pid && sk === k));
        return hit || rnd() < 0.05 + (1 - skill / 100) * 0.08;
      });
    });
    const viol = ERROR_CATALOG.filter(e => e.safety).reduce((s, e) => s + (errCounts[e.id] || 0), 0);
    const errs = ERROR_CATALOG.filter(e => errCounts[e.id] && e.tags.length).map(e => e.tags[0]);
    const xp = Math.round(clamp(300 + skill * 14 + rnd() * 500, 200, 2200));
    return { name, role, taller: TALLERES[ti], xp, pre, post, delayed, viol, m, errs, errCounts, answers, stepErr, sim: true };
  });
  TEAM_SEED.splice(0, TEAM_SEED.length, ...team);
})();
