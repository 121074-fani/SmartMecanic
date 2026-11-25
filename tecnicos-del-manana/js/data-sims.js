/* =========================================================
   Simulaciones de proceso (Saber → Hacer → Demostrar)
   Escenas 3D de acercamiento + pasos con acciones evaluadas.
   Valores técnicos de EJEMPLO para el prototipo.
   ========================================================= */

/* Herramientas extra para las simulaciones */
Object.assign(TOOLS, {
  mano: { short: 'Mano', icon: '✋', name: 'Mano (con EPP puesto)', cat: 'Manipulación',
    desc: 'Retirar, colocar y sostener piezas a mano, siempre con el EPP que exige el trabajo.',
    specs: ['Con guantes dieléctricos en trabajos AV', 'Con guantes mecánicos en trabajos de motor'], inspect: 'EPP correcto puesto antes de tocar.',
    uso: ['Retirar tapas, MSD, mangueras y baterías ya liberadas'], errores: ['Tocar piezas AV sin EPP', 'Forzar piezas que aún están sujetas'],
    seguridad: 'Las manos no son herramienta de prueba: nunca "toques para ver si hay corriente".' },
  cinta: { short: 'Cinta', icon: '🩹', name: 'Cinta aislante / de reparación', cat: 'Consumible (trampa)',
    desc: 'Cinta de uso general. Sirve para identificar o agrupar cables, pero NO es una reparación válida de conexiones de potencia, arneses AV ni mangueras a presión.',
    specs: ['Aislamiento limitado', 'Pierde adherencia con calor y aceite'], inspect: '—',
    uso: ['Identificación y agrupación temporal de cables de baja tensión'], errores: ['"Reparar" arneses AV o mangueras con cinta', 'Cubrir una conexión floja en lugar de corregirla'],
    seguridad: 'Una reparación con cinta oculta la falla y la convierte en un riesgo.' },
});
Object.assign(ERROR_LABELS, {
  'secuencia-bornes': 'Secuencia insegura de bornes de batería',
  'sim-pieza-fuera-de-orden': 'Pieza fuera de orden en simulación',
  'kit-incorrecto': 'Kit de herramientas incorrecto',
});

/* ---------- Escenas 3D de acercamiento ---------- */
const SIM_SCENES = (() => {
  const B = E3D.box, Cy = E3D.cylinder;
  const legs = (w, d, h = 0.4, c = '#94a3b8') => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) =>
    B({ id: 'leg', pos: [sx * (w / 2 - 0.15), h / 2, sz * (d / 2 - 0.15)], size: [0.1, h, 0.1], color: c, kind: 'floor' }));

  const inversor = () => [
    B({ id: 'bench', pos: [0, 0.45, 0], size: [5.6, 0.1, 2.6], color: '#cbd5e1', kind: 'floor' }), ...legs(5.6, 2.6),
    B({ id: 'bateria', pos: [-2.05, 0.95, 0], size: [1.0, 0.8, 1.3], color: '#0b2d52' }),
    B({ id: 'batdecal', pos: [-2.05, 1.15, 0.655], size: [0.86, 0.1, 0.01], color: '#f5821f', kind: 'static' }),
    B({ id: 'cable1', pos: [-1.33, 1.0, -0.25], size: [0.46, 0.07, 0.07], color: '#f97316', kind: 'static' }),
    B({ id: 'msd_base', pos: [-0.9, 0.72, -0.25], size: [0.44, 0.34, 0.52], color: '#334155' }),
    B({ id: 'msd', pos: [-0.9, 0.99, -0.25], size: [0.32, 0.2, 0.38], color: '#f5821f' }),
    B({ id: 'lock', pos: [-0.9, 0.72, 0.04], size: [0.15, 0.18, 0.06], color: '#facc15' }),
    B({ id: 'cable2', pos: [-0.46, 0.86, -0.25], size: [0.44, 0.07, 0.07], color: '#f97316', kind: 'static' }),
    B({ id: 'housing', pos: [0.55, 0.86, 0], size: [1.7, 0.62, 1.4], color: '#475569' }),
    B({ id: 'lid', pos: [0.55, 1.2, 0], size: [1.7, 0.06, 1.4], color: '#94a3b8' }),
    Cy({ id: 'bolt1', pos: [-0.2, 1.27, -0.6], radius: 0.075, length: 0.08, axis: 'y', segs: 10, color: '#e2e8f0' }),
    Cy({ id: 'bolt2', pos: [1.3, 1.27, -0.6], radius: 0.075, length: 0.08, axis: 'y', segs: 10, color: '#e2e8f0' }),
    Cy({ id: 'bolt3', pos: [1.3, 1.27, 0.6], radius: 0.075, length: 0.08, axis: 'y', segs: 10, color: '#e2e8f0' }),
    Cy({ id: 'bolt4', pos: [-0.2, 1.27, 0.6], radius: 0.075, length: 0.08, axis: 'y', segs: 10, color: '#e2e8f0' }),
    B({ id: 'busbar', pos: [0.25, 1.19, 0.15], size: [0.62, 0.05, 0.15], color: '#d97706' }),
    Cy({ id: 'caps', pos: [0.95, 1.18, -0.3], radius: 0.17, length: 0.1, axis: 'y', color: '#1e3a8a', kind: 'static' }),
    Cy({ id: 'caps', pos: [0.95, 1.18, 0.25], radius: 0.17, length: 0.1, axis: 'y', color: '#1e3a8a', kind: 'static' }),
    Cy({ id: 'tp', pos: [0.2, 0.86, 0.72], radius: 0.055, length: 0.07, axis: 'z', segs: 10, color: '#dc2626' }),
    Cy({ id: 'tp', pos: [0.45, 0.86, 0.72], radius: 0.055, length: 0.07, axis: 'z', segs: 10, color: '#111827' }),
    ...[-0.35, 0, 0.35].map(z => B({ id: 'fase', pos: [1.65, 0.95, z], size: [0.5, 0.06, 0.06], color: '#f97316', kind: 'static' })),
    Cy({ id: 'motor', pos: [2.25, 0.95, 0], radius: 0.42, length: 0.7, axis: 'x', color: '#0b2d52' }),
    Cy({ id: 'hose', pos: [0.95, 0.72, -0.8], radius: 0.06, length: 0.3, axis: 'z', segs: 8, color: '#111827', kind: 'static' }),
    Cy({ id: 'hose', pos: [0.2, 0.72, -0.8], radius: 0.06, length: 0.3, axis: 'z', segs: 8, color: '#111827', kind: 'static' }),
  ];

  const intercooler = () => [
    B({ id: 'base', pos: [0, 0.35, 0], size: [4.6, 0.1, 2.0], color: '#cbd5e1', kind: 'floor' }), ...legs(4.6, 2.0, 0.3),
    B({ id: 'block', pos: [-1.2, 1.0, 0], size: [1.6, 1.1, 1.2], color: '#475569' }),
    B({ id: 'cover', pos: [-1.2, 1.65, 0], size: [1.4, 0.2, 0.9], color: '#0b2d52', kind: 'static' }),
    ...[-1.7, -1.4, -1.1, -0.8].map(x => B({ id: 'rib', pos: [x, 1.0, 0.61], size: [0.08, 0.9, 0.02], color: '#334155', kind: 'static' })),
    Cy({ id: 'turbo', pos: [-0.1, 1.3, 0.25], radius: 0.32, length: 0.36, axis: 'z', color: '#f5821f' }),
    Cy({ id: 'pipe', pos: [0.37, 1.3, 0.25], radius: 0.1, length: 0.55, axis: 'x', color: '#94a3b8', kind: 'static' }),
    Cy({ id: 'hose', pos: [0.97, 1.3, 0.25], radius: 0.14, length: 0.62, axis: 'x', color: '#1f2937' }),
    B({ id: 'crack', pos: [1.0, 1.445, 0.25], size: [0.18, 0.03, 0.08], color: '#dc2626' }),
    Cy({ id: 'clamp1', pos: [0.73, 1.3, 0.25], radius: 0.165, length: 0.05, axis: 'x', color: '#cbd5e1' }),
    Cy({ id: 'clamp2', pos: [1.22, 1.3, 0.25], radius: 0.165, length: 0.05, axis: 'x', color: '#cbd5e1' }),
    B({ id: 'intercooler', pos: [1.72, 1.15, 0.25], size: [0.3, 1.1, 1.5], color: '#2563eb' }),
    ...[-0.5, -0.25, 0, 0.25, 0.5].map(z => B({ id: 'fin', pos: [1.56, 1.15, 0.25 + z], size: [0.02, 1.0, 0.04], color: '#1d4ed8', kind: 'static' })),
  ];

  const baterias = () => [
    B({ id: 'tray', pos: [0, 0.5, 0], size: [3.3, 0.1, 1.7], color: '#cbd5e1', kind: 'floor' }), ...legs(3.3, 1.7, 0.45),
    B({ id: 'batA', pos: [-0.75, 0.93, 0], size: [1.2, 0.76, 0.95], color: '#0b2d52' }),
    B({ id: 'batB', pos: [0.75, 0.93, 0], size: [1.2, 0.76, 0.95], color: '#0b2d52' }),
    Cy({ id: 'a_pos', pos: [-1.15, 1.37, 0.22], radius: 0.075, length: 0.12, axis: 'y', segs: 10, color: '#dc2626' }),
    Cy({ id: 'a_neg', pos: [-0.35, 1.37, 0.22], radius: 0.075, length: 0.12, axis: 'y', segs: 10, color: '#111827' }),
    Cy({ id: 'b_pos', pos: [0.35, 1.37, 0.22], radius: 0.075, length: 0.12, axis: 'y', segs: 10, color: '#dc2626' }),
    Cy({ id: 'b_neg', pos: [1.15, 1.37, 0.22], radius: 0.075, length: 0.12, axis: 'y', segs: 10, color: '#111827' }),
    B({ id: 'cable_pos', pos: [-1.6, 1.44, 0.22], size: [0.9, 0.07, 0.09], color: '#dc2626' }),
    B({ id: 'jumper', pos: [0, 1.44, 0.22], size: [0.78, 0.06, 0.09], color: '#94a3b8' }),
    B({ id: 'cable_neg', pos: [1.6, 1.44, 0.22], size: [0.9, 0.07, 0.09], color: '#111827' }),
    B({ id: 'bracket', pos: [0, 1.34, -0.25], size: [2.7, 0.05, 0.1], color: '#64748b' }),
  ];

  return {
    inversor: { build: inversor, cam: { target: [0.15, 0.95, 0], dist: 8.6, yaw: 0.5, pitch: 0.6 }, shadow: [-2.8, 2.8, -1.3, 1.3], grid: 0.5 },
    intercooler: { build: intercooler, cam: { target: [0.25, 1.1, 0.15], dist: 7.2, yaw: 0.45, pitch: 0.48 }, shadow: [-2.3, 2.3, -1.0, 1.0], grid: 0.5 },
    baterias: { build: baterias, cam: { target: [0, 1.0, 0.05], dist: 6.4, yaw: 0.3, pitch: 0.68 }, shadow: [-1.65, 1.65, -0.85, 0.85], grid: 0.4 },
  };
})();

/* ---------- Módulos de simulación ---------- */
// acción: tool, part ('self' | id), text, hint, anim:[{id, off, a, tint}], reading, input, choice, wait, setsSafe, ppe,
//         traps:{ partId: {msg, safety} }, toolTraps:{ toolId: msg }, orderMsg
const SIMS = [
  {
    id: 'inversor', code: 'MOD-AV-215', section: 'Sección 1', title: 'Mantenimiento al inversor de tracción', level: 'Nivel 3',
    vehicle: 'Autobús eléctrico', mode: 'ev', comps: ['hv', 'ev'], min: 8, scene: 'inversor',
    brief: 'El inversor marca sobretemperatura intermitente. Hay que abrirlo de forma segura, encontrar la conexión floja, repararla y cerrarlo correctamente.',
    saber: {
      flow: [{ t: 'Batería', s: '650 V CC' }, { t: 'MSD', s: 'LOTO', hl: true }, { t: 'Inversor', s: 'IGBT 3φ' }, { t: 'Motor', s: 'U-V-W' }],
      banner: 'Alto voltaje: Guantes → LOTO/MSD → 0 V', foot: 'Tapa: 4 × M8 · 45 N·m en cruz · Barra colectora: 12 N·m',
      bullets: [
        'La batería manda energía al inversor y el inversor mueve el motor eléctrico. Hay hasta 650 V: tocarlo energizado puede matar.',
        'El MSD (interruptor naranja) es el "corte de corriente". Se retira, se bloquea con candado (LOTO) y te quedas con la llave.',
        'Antes de tocar: guantes dieléctricos puestos → MSD bloqueado → esperar la descarga → medir 0 V con multímetro.',
        'Los 4 tornillos de la tapa se aflojan y se aprietan en cruz (1 → 3 → 2 → 4) para no deformar la tapa ni el empaque.',
      ],
      check: { q: '¿Cuál es el orden correcto antes de abrir el inversor?', o: ['Guantes → retirar MSD + LOTO → esperar descarga → medir 0 V', 'Medir 0 V → guantes → abrir', 'Retirar MSD → abrir la tapa → medir', 'Apagar el autobús y abrir'], a: 0, fb: 'Aislar, bloquear, esperar y verificar: siempre en ese orden.' },
    },
    kit: [
      { name: 'Guantes dieléctricos clase 0', code: '#EPP-0100', ok: true, why: 'Protección obligatoria para trabajar en alto voltaje.' },
      { name: 'Candado y etiqueta LOTO', code: '#LOTO-001', ok: true, why: 'Bloquea el MSD para que nadie reenergice.' },
      { name: 'Multímetro CAT III 1000 V', code: '#MED-310', ok: true, why: 'Verifica la ausencia de tensión.' },
      { name: 'Llaves aisladas 1000 V', code: '#HER-1000', ok: true, why: 'Herramienta certificada para componentes AV.' },
      { name: 'Llave de torque 5–60 N·m', code: '#TQ-0560', ok: true, why: 'Apriete de barra (12 N·m) y tapa (45 N·m).' },
      { name: 'Empaque de tapa nuevo', code: '#REF-88412', ok: true, why: 'El empaque de la tapa no se reutiliza.' },
      { name: 'Guantes de nitrilo', code: '#EPP-0020', ok: false, why: 'No aíslan alta tensión.' },
      { name: 'Desarmador común', code: '#HER-0101', ok: false, why: 'No está aislado: prohibido en componentes AV.' },
      { name: 'Cinta aislante', code: '#CON-0007', ok: false, why: 'No es una reparación válida para una conexión de potencia.' },
    ],
    tray: ['mano', 'guantes', 'candado', 'multimetro', 'aislada', 'manual', 'torque', 'linterna', 'cinta'],
    parts: { bateria: 'Batería de tracción 650 V', msd_base: 'Base del MSD', msd: 'MSD (desconexión de servicio)', lock: 'Candado LOTO', housing: 'Carcasa del inversor', lid: 'Tapa del inversor', bolt1: 'Tornillo 1 (M8)', bolt2: 'Tornillo 2 (M8)', bolt3: 'Tornillo 3 (M8)', bolt4: 'Tornillo 4 (M8)', busbar: 'Barra colectora DC+', tp: 'Puntos de prueba +/–', motor: 'Motor de tracción' },
    tags: { bolt1: '1', bolt2: '2', bolt3: '3', bolt4: '4' },
    initial: [{ id: 'lock', a: 0 }, { id: 'busbar', a: 0 }, { id: 'caps', a: 0 }],
    hvParts: ['msd', 'msd_base', 'tp', 'housing', 'lid', 'bolt1', 'bolt2', 'bolt3', 'bolt4', 'busbar', 'bateria', 'motor'],
    unsafeUntilVerified: ['lid', 'bolt1', 'bolt2', 'bolt3', 'bolt4', 'busbar', 'housing'],
    steps: [
      { title: 'Aislar', actions: [
        { tool: 'guantes', part: 'self', ppe: true, text: 'Ponte los guantes dieléctricos (ya inspeccionados).', hint: 'Toma 🧤 y pulsa "Usar en mí".' },
        { tool: 'mano', part: 'msd', text: 'Retira el MSD (desconexión de servicio).', hint: 'Toma ✋ y toca el MSD naranja.', anim: [{ id: 'msd', off: [0, 0.55, 0.95], a: 0.35 }] },
        { tool: 'candado', part: 'msd_base', text: 'Coloca tu candado LOTO en la base del MSD.', hint: 'Toma 🔒 y toca la base gris del MSD.', anim: [{ id: 'lock', a: 1 }] },
      ] },
      { title: 'Verificar 0 V', actions: [
        { wait: 5, text: 'Espera la descarga de los capacitores del inversor (5 min reales → 5 s).' },
        { tool: 'multimetro', part: 'tp', setsSafe: true, text: 'Mide en los puntos de prueba del inversor (+/– y contra chasis).', hint: 'Toma 🔌 y toca los bornes rojo/negro del frente.',
          reading: { text: '0.0 V CC (+/–) · 0.0 V (+/chasis) · 0.0 V (–/chasis)', status: 'ok' } },
      ] },
      { title: 'Abrir la tapa', actions: [
        { tool: 'aislada', part: 'bolt1', text: 'Afloja el tornillo 1.', hint: 'Orden en cruz: 1 → 3 → 2 → 4. Toma 🪛.', orderMsg: 'El orden es en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt1', off: [0, 0.45, 0], a: 0 }] },
        { tool: 'aislada', part: 'bolt3', text: 'Afloja el tornillo 3 (diagonal opuesta).', hint: 'Sigue la diagonal: tornillo 3.', orderMsg: 'El orden es en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt3', off: [0, 0.45, 0], a: 0 }] },
        { tool: 'aislada', part: 'bolt2', text: 'Afloja el tornillo 2.', hint: 'Ahora la otra diagonal: tornillo 2.', orderMsg: 'El orden es en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt2', off: [0, 0.45, 0], a: 0 }] },
        { tool: 'aislada', part: 'bolt4', text: 'Afloja el tornillo 4.', hint: 'Último: tornillo 4.', orderMsg: 'El orden es en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt4', off: [0, 0.45, 0], a: 0 }] },
        { tool: 'mano', part: 'lid', text: 'Retira la tapa del inversor.', hint: 'Toma ✋ y toca la tapa.', anim: [{ id: 'lid', off: [0, 0.95, -1.75], a: 0.3 }, { id: 'busbar', a: 1 }, { id: 'caps', a: 1 }] },
      ] },
      { title: 'Reparar', actions: [
        { tool: 'linterna', part: 'busbar', text: 'Inspecciona las conexiones internas.', hint: 'Toma 🔦 y toca la barra colectora (naranja).',
          reading: { text: 'Barra DC+ con decoloración por calor: apriete flojo', status: 'bad' }, anim: [{ id: 'busbar', tint: '#ef4444' }] },
        { tool: 'torque', part: 'busbar', text: 'Reaprieta la barra colectora al torque especificado.', hint: 'Toma 🔩, toca la barra y escribe el torque (12 N·m).',
          input: { label: 'Torque de la barra colectora', value: 12, tol: 0.5, unit: 'N·m' }, anim: [{ id: 'busbar', tint: '#22c55e' }],
          toolTraps: { cinta: 'La cinta no corrige una conexión floja: el calor viene del mal apriete. Hay que reapretar al torque.' } },
      ] },
      { title: 'Cerrar y reenergizar', actions: [
        { tool: 'mano', part: 'lid', text: 'Coloca la tapa con su empaque nuevo.', hint: 'Toma ✋ y toca la tapa (fantasma).',
          anim: [{ id: 'lid', off: [0, 0, 0], a: 1 }, { id: 'busbar', a: 0 }, { id: 'caps', a: 0 }, ...['bolt1', 'bolt2', 'bolt3', 'bolt4'].map(id => ({ id, off: [0, 0.3, 0], a: 0.35 }))] },
        { tool: 'torque', part: 'bolt1', text: 'Aprieta el tornillo 1 al torque de la tapa.', hint: 'Toma 🔩, toca el tornillo 1 y escribe 45 N·m.', input: { label: 'Torque de tornillos de tapa', value: 45, tol: 1, unit: 'N·m' }, orderMsg: 'Aprieta en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt1', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
        { tool: 'torque', part: 'bolt3', text: 'Aprieta el tornillo 3.', hint: 'En cruz: tornillo 3.', orderMsg: 'Aprieta en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt3', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
        { tool: 'torque', part: 'bolt2', text: 'Aprieta el tornillo 2.', hint: 'En cruz: tornillo 2.', orderMsg: 'Aprieta en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt2', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
        { tool: 'torque', part: 'bolt4', text: 'Aprieta el tornillo 4.', hint: 'En cruz: tornillo 4.', orderMsg: 'Aprieta en cruz: 1 → 3 → 2 → 4.', anim: [{ id: 'bolt4', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
        { tool: 'candado', part: 'msd_base', text: 'Retira tu candado LOTO (solo quien lo colocó).', hint: 'Toma 🔒 y toca la base del MSD.', anim: [{ id: 'lock', a: 0 }] },
        { tool: 'mano', part: 'msd', text: 'Reinstala el MSD.', hint: 'Toma ✋ y toca el MSD.', anim: [{ id: 'msd', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
      ] },
    ],
  },
  {
    id: 'intercooler', code: 'MOD-DI-108', section: 'Sección 2', title: 'Reemplazo de manguera del intercooler', level: 'Nivel 2',
    vehicle: 'Autobús diésel', mode: 'diesel', comps: ['diesel', 'diag'], min: 6, scene: 'intercooler',
    brief: 'El autobús pierde potencia y saca humo negro. Confirma la fuga en la admisión, reemplaza la manguera y verifica.',
    saber: {
      flow: [{ t: 'Turbo', s: 'comprime' }, { t: 'Manguera', s: '1.5 bar', hl: true }, { t: 'Intercooler', s: 'enfría' }, { t: 'Motor', s: 'admisión' }],
      banner: 'Fuga de aire = menos presión = humo negro', foot: 'Prueba: 1.5 bar · Abrazaderas: 6 N·m',
      bullets: [
        'El turbo comprime aire; el intercooler lo enfría y lo manda al motor por mangueras a presión.',
        'Si una manguera se fisura, el aire se escapa: la presión baja, el motor recibe poco aire y saca humo negro.',
        'Primero se confirma la fuga con el probador de presión (a la presión del manual, nunca más).',
        'Una manguera fisurada se reemplaza: cinta o sellador son reparaciones provisionales que vuelven a fallar.',
      ],
      check: { q: 'Humo negro + baja presión de turbo. ¿Qué revisas primero?', o: ['Fugas en mangueras y abrazaderas con prueba de presión', 'Cambiar el turbo', 'Cambiar inyectores', 'Regenerar el DPF'], a: 0, fb: 'Lo más probable y barato primero, con evidencia.' },
    },
    kit: [
      { name: 'Probador de presión con regulador', code: '#PRS-150', ok: true, why: 'Confirma la fuga sin exceder la presión.' },
      { name: 'Lámpara de inspección', code: '#INS-020', ok: true, why: 'Inspección visual previa.' },
      { name: 'Juego de llaves y desarmadores', code: '#HER-0200', ok: true, why: 'Aflojar y apretar abrazaderas.' },
      { name: 'Llave de torque 2–25 N·m', code: '#TQ-0225', ok: true, why: 'Abrazaderas a 6 N·m.' },
      { name: 'Manguera de intercooler nueva', code: '#REF-21345', ok: true, why: 'La refacción a instalar.' },
      { name: 'Abrazaderas nuevas (×2)', code: '#REF-21346', ok: true, why: 'No se reutilizan abrazaderas deformadas.' },
      { name: 'Sellador de silicón', code: '#CON-0310', ok: false, why: 'Una manguera fisurada se reemplaza, no se sella.' },
      { name: 'Cinta de alta temperatura', code: '#CON-0312', ok: false, why: 'Reparación provisional: la fuga regresa bajo presión.' },
      { name: 'Guantes dieléctricos', code: '#EPP-0100', ok: false, why: 'No se necesitan: es un componente mecánico sin alta tensión (usa guantes mecánicos).' },
    ],
    tray: ['mano', 'linterna', 'presion', 'manual', 'torque', 'cinta', 'aislada'],
    parts: { block: 'Bloque del motor', turbo: 'Turbocompresor', hose: 'Manguera del intercooler', crack: 'Fisura', clamp1: 'Abrazadera 1', clamp2: 'Abrazadera 2', intercooler: 'Intercooler' },
    tags: { clamp1: '1', clamp2: '2' },
    initial: [{ id: 'crack', a: 0 }],
    steps: [
      { title: 'Confirmar la fuga', actions: [
        { tool: 'linterna', part: 'hose', text: 'Inspecciona la manguera de salida del turbo.', hint: 'Toma 🔦 y toca la manguera negra.', reading: { text: 'Rastro de aceite y hollín cerca de la abrazadera', status: 'info' } },
        { tool: 'presion', part: 'hose', text: 'Presuriza el sistema de admisión con el probador.', hint: 'Toma 💨 y toca la manguera.',
          choice: { q: '¿A qué presión pruebas?', o: ['1.5 bar (la del manual), nunca más', 'Al máximo del compresor del taller', 'Sin presión, solo visual'], a: 0, fb: 'El exceso de presión revienta mangueras o daña el intercooler.' },
          reading: { text: 'Fuga audible · cae de 1.5 a 0.6 bar en 30 s ✗', status: 'bad' }, anim: [{ id: 'crack', a: 1 }],
          toolTraps: { cinta: 'Primero se confirma la fuga; y aun así, la cinta no es reparación.' } },
      ] },
      { title: 'Aflojar abrazaderas', actions: [
        { tool: 'manual', part: 'clamp1', text: 'Afloja la abrazadera 1 (lado turbo).', hint: 'Toma 🔧 y toca la abrazadera 1.', anim: [{ id: 'clamp1', off: [-0.12, 0, 0] }] },
        { tool: 'manual', part: 'clamp2', text: 'Afloja la abrazadera 2 (lado intercooler).', hint: 'Toca la abrazadera 2.', anim: [{ id: 'clamp2', off: [0.12, 0, 0] }] },
      ] },
      { title: 'Retirar manguera', actions: [
        { tool: 'mano', part: 'hose', text: 'Retira la manguera fisurada.', hint: 'Toma ✋ y toca la manguera.',
          anim: [{ id: 'hose', off: [0, 0.75, 1.3], a: 0.3 }, { id: 'crack', off: [0, 0.75, 1.3], a: 0.3 }, { id: 'clamp1', a: 0.35 }, { id: 'clamp2', a: 0.35 }],
          toolTraps: { cinta: 'La cinta es provisional: la manguera fisurada se reemplaza.' } },
      ] },
      { title: 'Instalar nueva', actions: [
        { tool: 'mano', part: 'hose', text: 'Instala la manguera nueva, asentada a tope.', hint: 'Toca la manguera (fantasma).', anim: [{ id: 'hose', off: [0, 0, 0], a: 1, tint: '#22c55e' }, { id: 'crack', a: 0 }, { id: 'clamp1', a: 1 }, { id: 'clamp2', a: 1 }] },
        { tool: 'torque', part: 'clamp1', text: 'Aprieta la abrazadera 1 al torque.', hint: 'Toma 🔩, toca la abrazadera 1 y escribe 6 N·m.', input: { label: 'Torque de abrazaderas', value: 6, tol: 0.5, unit: 'N·m' }, anim: [{ id: 'clamp1', off: [0, 0, 0], tint: '#22c55e' }] },
        { tool: 'torque', part: 'clamp2', text: 'Aprieta la abrazadera 2.', hint: 'Toca la abrazadera 2.', anim: [{ id: 'clamp2', off: [0, 0, 0], tint: '#22c55e' }] },
      ] },
      { title: 'Verificar', actions: [
        { tool: 'presion', part: 'hose', text: 'Repite la prueba de presión.', hint: 'Toma 💨 y toca la manguera.', reading: { text: '1.5 bar estables durante 60 s — sin fugas ✓', status: 'ok' } },
      ] },
    ],
  },
  {
    id: 'baterias', code: 'MOD-EL-031', section: 'Sección 3', title: 'Reemplazo de batería de 24 V', level: 'Nivel 1',
    vehicle: 'Autobús diésel o eléctrico', mode: 'diesel', comps: ['elec'], min: 5, scene: 'baterias',
    brief: 'El autobús no despierta por la mañana. Encuentra la batería dañada del banco de 24 V y reemplázala con la secuencia segura de bornes.',
    saber: {
      flow: [{ t: 'Batería A', s: '12 V' }, { t: 'Puente', s: 'A– → B+', hl: true }, { t: 'Batería B', s: '12 V' }, { t: 'Sistema', s: '24 V' }],
      banner: 'Desconectar: NEGATIVO primero · Conectar: NEGATIVO al final', foot: 'Bornes: 8 N·m · Reposo sano: 12.6–12.8 V por batería',
      bullets: [
        'Dos baterías de 12 V en serie forman 24 V: el negativo de A se une al positivo de B con un puente.',
        'Una batería sana en reposo mide ≈ 12.6–12.8 V. Menos de 12 V en reposo indica una batería descargada o dañada.',
        'El negativo va a chasis: se desconecta primero para que, si la llave toca el chasis, no haya cortocircuito.',
        'Al conectar es al revés: primero el puente y el positivo, y el negativo a chasis al final.',
      ],
      check: { q: '¿Qué cable desconectas primero?', o: ['El negativo a chasis', 'El positivo principal', 'El puente entre baterías', 'Da igual'], a: 0, fb: 'Así una llave que toque el chasis no provoca un corto.' },
    },
    kit: [
      { name: 'Multímetro digital', code: '#MED-100', ok: true, why: 'Identifica la batería dañada.' },
      { name: 'Llave para bornes 10/13 mm', code: '#HER-0013', ok: true, why: 'Desconectar y conectar bornes.' },
      { name: 'Llave de torque 2–25 N·m', code: '#TQ-0225', ok: true, why: 'Bornes a 8 N·m.' },
      { name: 'Batería 12 V nueva (misma especificación)', code: '#REF-12100', ok: true, why: 'Debe coincidir en capacidad y tipo.' },
      { name: 'Lentes de seguridad', code: '#EPP-0300', ok: true, why: 'Protección contra ácido y chispas.' },
      { name: 'Cables pasacorriente', code: '#ACC-0050', ok: false, why: 'No se necesitan para reemplazar una batería.' },
      { name: 'Martillo', code: '#HER-0500', ok: false, why: 'Nunca golpees bornes ni baterías.' },
      { name: 'Batería de otra capacidad', code: '#REF-12080', ok: false, why: 'Mezclar capacidades desbalancea el banco y acorta su vida.' },
    ],
    tray: ['mano', 'multimetro', 'manual', 'torque', 'linterna'],
    parts: { batA: 'Batería A (12 V)', batB: 'Batería B (12 V)', a_pos: 'Borne + A', a_neg: 'Borne – A', b_pos: 'Borne + B', b_neg: 'Borne – B', cable_pos: 'Cable positivo principal', jumper: 'Puente A– / B+', cable_neg: 'Cable negativo a chasis', bracket: 'Sujetador de baterías' },
    steps: [
      { title: 'Diagnosticar', actions: [
        { tool: 'multimetro', part: 'batA', text: 'Mide la tensión en reposo de la batería A.', hint: 'Toma 🔌 y toca la batería A (izquierda).', reading: { text: 'Batería A: 12.7 V ✓', status: 'ok' } },
        { tool: 'multimetro', part: 'batB', text: 'Mide la batería B.', hint: 'Toca la batería B (derecha).', reading: { text: 'Batería B: 10.9 V ✗ — celda dañada', status: 'bad' }, anim: [{ id: 'batB', tint: '#ef4444' }] },
      ] },
      { title: 'Desconectar', actions: [
        { tool: 'manual', part: 'cable_neg', text: 'Desconecta primero el cable NEGATIVO a chasis.', hint: 'Toma 🔧 y toca el cable negro de la derecha.', anim: [{ id: 'cable_neg', off: [0.3, 0.35, 0], a: 0.4 }],
          traps: { cable_pos: { msg: '¡Peligro! Si aflojas el positivo con el negativo conectado y la llave toca el chasis, provocas un cortocircuito. Primero el negativo.', safety: true, tag: 'secuencia-bornes' } } },
        { tool: 'manual', part: 'jumper', text: 'Retira el puente entre A– y B+.', hint: 'Toca el puente gris entre las baterías.', anim: [{ id: 'jumper', off: [0, 0.35, 0], a: 0.4 }] },
      ] },
      { title: 'Retirar', actions: [
        { tool: 'manual', part: 'bracket', text: 'Retira el sujetador de las baterías.', hint: 'Toca la barra gris de atrás.', anim: [{ id: 'bracket', off: [0, 0.5, -0.7], a: 0.3 }] },
        { tool: 'mano', part: 'batB', text: 'Retira la batería B dañada.', hint: 'Toma ✋ y toca la batería B.', orderMsg: 'Primero libera la batería: cables y sujetador.',
          anim: ['batB', 'b_pos', 'b_neg'].map(id => ({ id, off: [0, 1.1, 1.3], a: 0.25 })) },
      ] },
      { title: 'Instalar', actions: [
        { tool: 'mano', part: 'batB', text: 'Coloca la batería nueva en su lugar.', hint: 'Toca la batería B (fantasma).', anim: [{ id: 'batB', off: [0, 0, 0], a: 1, tint: '#22c55e' }, { id: 'b_pos', off: [0, 0, 0], a: 1 }, { id: 'b_neg', off: [0, 0, 0], a: 1 }] },
        { tool: 'manual', part: 'bracket', text: 'Instala el sujetador.', hint: 'Toca el sujetador.', anim: [{ id: 'bracket', off: [0, 0, 0], a: 1 }] },
      ] },
      { title: 'Conectar y verificar', actions: [
        { tool: 'torque', part: 'jumper', text: 'Instala el puente A–/B+ y apriétalo al torque.', hint: 'Toma 🔩, toca el puente y escribe 8 N·m.', input: { label: 'Torque de bornes', value: 8, tol: 0.5, unit: 'N·m' }, anim: [{ id: 'jumper', off: [0, 0, 0], a: 1, tint: '#22c55e' }],
          traps: { cable_neg: { msg: '¡Peligro! El negativo a chasis se conecta AL FINAL; conectarlo antes deja el circuito vivo mientras trabajas en los demás bornes.', safety: true, tag: 'secuencia-bornes' } } },
        { tool: 'manual', part: 'cable_neg', text: 'Conecta el cable negativo a chasis (último).', hint: 'Toma 🔧 y toca el cable negativo.', anim: [{ id: 'cable_neg', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
        { tool: 'multimetro', part: 'batB', text: 'Verifica la tensión del sistema.', hint: 'Toma 🔌 y toca la batería B.', reading: { text: 'Sistema: 25.4 V ✓ · Batería B: 12.7 V', status: 'ok' } },
      ] },
    ],
  },
];
