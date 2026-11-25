/* =========================================================
   «Señala la pieza» — aprender un proceso identificando cada
   pieza y herramienta en el modelo 3D (3 intentos por paso).
   Valores técnicos de EJEMPLO para el prototipo.
   ========================================================= */
Object.assign(ERROR_LABELS, { 'identificacion-incorrecta': 'Pieza o herramienta mal identificada' });

const SENALA_SCENES = (() => {
  const B = E3D.box, Cy = E3D.cylinder;
  const legs = (cx, cz, w, d, h, c = '#94a3b8') => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) =>
    B({ id: 'leg', pos: [cx + sx * (w / 2 - 0.12), h / 2, cz + sz * (d / 2 - 0.12)], size: [0.1, h, 0.1], color: c, kind: 'floor' }));
  const X = i => -1.25 + i * 0.5; // posición de cada cilindro (1..6 → índice 0..5)

  /* Motor de 6 cilindros en línea a gas natural, sobre un soporte, con mesa de herramientas al frente */
  /* Bujía de encendido: terminal, cerámica con aletas, tuerca hexagonal, rosca y electrodo (eje vertical) */
  const sparkPlug = (id, x, y, z) => [
    Cy({ id, pos: [x, y + 0.02, z], radius: 0.034, length: 0.13, axis: 'y', segs: 14, color: '#f8fafc', gloss: 0.9 }),
    ...[0.05, 0.075, 0.1].map(dy => Cy({ id, pos: [x, y + dy, z], radius: 0.039, length: 0.012, axis: 'y', segs: 14, color: '#e5e7eb' })),
    Cy({ id, pos: [x, y + 0.115, z], radius: 0.014, length: 0.035, axis: 'y', segs: 8, color: '#9ca3af', gloss: 0.8 }),
    Cy({ id, pos: [x, y - 0.065, z], radius: 0.05, length: 0.045, axis: 'y', segs: 6, color: '#cbd5e1', gloss: 0.9 }),
    Cy({ id, pos: [x, y - 0.115, z], radius: 0.026, length: 0.06, axis: 'y', segs: 10, color: '#a8a29e', gloss: 0.5 }),
    ...[-0.1, -0.12, -0.14].map(dy => Cy({ id, pos: [x, y + dy, z], radius: 0.029, length: 0.006, axis: 'y', segs: 10, color: '#78716c' })),
    B({ id, pos: [x, y - 0.15, z + 0.012], size: [0.012, 0.014, 0.03], color: '#57534e' }),
  ];
  const motorGas = () => {
    const S = { kind: 'static' };
    const M = [
      B({ id: 'stand', pos: [0, 0.32, 0], size: [3.8, 0.1, 1.5], color: '#cbd5e1', kind: 'floor' }), ...legs(0, 0, 3.8, 1.5, 0.28),
      // bloque con nervaduras, cárter y culata con tornillos
      B({ id: 'block', pos: [0, 0.92, 0], size: [3.2, 0.95, 1.1], color: '#8796ab', gloss: 0.3 }),
      ...[-1.2, -0.7, -0.2, 0.3, 0.8, 1.3].map(x => B({ id: 'block', pos: [x, 0.95, 0.56], size: [0.06, 0.8, 0.03], color: '#7a899e' })),
      B({ id: 'oilpan', pos: [0, 0.4, 0], size: [3.0, 0.08, 0.95], color: '#475569', ...S }),
      B({ id: 'head', pos: [0, 1.55, 0], size: [3.2, 0.3, 1.0], color: '#a3b1c2', gloss: 0.4 }),
      ...[-1.45, -0.95, -0.45, 0.05, 0.55, 1.05, 1.45].flatMap(x => [0.44, -0.44].map(z => Cy({ id: 'head', pos: [x, 1.71, z], radius: 0.03, length: 0.03, axis: 'y', segs: 6, color: '#64748b' }))),
      // tapa de punterías con nervaduras
      B({ id: 'cover', pos: [0, 1.82, 0], size: [3.0, 0.24, 0.85], color: '#0b2d52', gloss: 0.6 }),
      ...[-0.36, 0.36].map(z => B({ id: 'cover', pos: [0, 1.95, z], size: [2.9, 0.03, 0.05], color: '#123e6e' })),
      // arnés de las bobinas con su canaleta
      Cy({ id: 'harness', pos: [0, 2.17, 0.27], radius: 0.03, length: 3.0, axis: 'x', segs: 8, color: '#1f2937', ...S }),
      // múltiple de admisión con 6 ramales
      Cy({ id: 'manifold', pos: [0, 1.38, -0.75], radius: 0.13, length: 3.0, axis: 'x', segs: 16, color: '#94a3b8', gloss: 0.6 }),
      ...[0, 1, 2, 3, 4, 5].map(i => Cy({ id: 'manifold', pos: [X(i), 1.5, -0.6], radius: 0.06, length: 0.22, axis: 'z', segs: 10, color: '#a1aab8' })),
      // polea del cigüeñal, alternador y banda
      Cy({ id: 'pulley', pos: [-1.72, 0.95, 0], radius: 0.36, length: 0.09, axis: 'x', segs: 24, color: '#111827', gloss: 0.4 }),
      Cy({ id: 'pulley', pos: [-1.77, 0.95, 0], radius: 0.12, length: 0.05, axis: 'x', segs: 14, color: '#9ca3af', gloss: 0.8 }),
      Cy({ id: 'alt', pos: [-1.7, 1.55, -0.32], radius: 0.19, length: 0.26, axis: 'x', segs: 18, color: '#cbd5e1', gloss: 0.7, ...S }),
      B({ id: 'belt', pos: [-1.78, 1.25, -0.16], size: [0.04, 0.62, 0.05], color: '#0b0f17', ...S }),
      B({ id: 'belt', pos: [-1.78, 1.25, 0.2], size: [0.04, 0.6, 0.05], color: '#0b0f17', ...S }),
      Cy({ id: 'oilcap', pos: [1.25, 1.99, -0.25], radius: 0.09, length: 0.08, axis: 'y', segs: 16, color: '#f5821f', gloss: 0.5 }),
      Cy({ id: 'oilcap', pos: [1.25, 2.04, -0.25], radius: 0.05, length: 0.03, axis: 'y', segs: 12, color: '#ea580c' }),
      Cy({ id: 'dipstick', pos: [-1.45, 1.35, 0.6], radius: 0.035, length: 0.6, axis: 'y', segs: 10, color: '#facc15' }),
      Cy({ id: 'dipstick', pos: [-1.45, 1.68, 0.6], radius: 0.06, length: 0.04, axis: 'y', segs: 12, color: '#eab308' }),
      B({ id: 'sensor', pos: [1.45, 1.6, 0.52], size: [0.12, 0.12, 0.1], color: '#a855f7' }),
      Cy({ id: 'sensor', pos: [1.45, 1.6, 0.6], radius: 0.03, length: 0.08, axis: 'z', segs: 8, color: '#7e22ce' }),
      // batería de 12 V del banco de pruebas: caja, tapa, asa y bornes
      B({ id: 'battery', pos: [2.45, 0.6, 0.35], size: [0.65, 0.44, 0.5], color: '#0b2d52', gloss: 0.4 }),
      B({ id: 'battery', pos: [2.45, 0.845, 0.35], size: [0.67, 0.05, 0.52], color: '#111827' }),
      B({ id: 'battery', pos: [2.45, 0.62, 0.605], size: [0.44, 0.12, 0.01], color: '#f5821f' }),
      B({ id: 'battery', pos: [2.45, 0.88, 0.22], size: [0.3, 0.025, 0.03], color: '#334155' }),
      Cy({ id: 'bat_pos', pos: [2.25, 0.9, 0.45], radius: 0.05, length: 0.06, axis: 'y', segs: 14, color: '#dc2626', gloss: 0.6 }),
      Cy({ id: 'bat_pos', pos: [2.25, 0.94, 0.45], radius: 0.035, length: 0.04, axis: 'y', segs: 12, color: '#b91c1c' }),
      Cy({ id: 'bat_neg', pos: [2.65, 0.9, 0.45], radius: 0.05, length: 0.06, axis: 'y', segs: 14, color: '#111827', gloss: 0.6 }),
      Cy({ id: 'bat_neg', pos: [2.65, 0.94, 0.45], radius: 0.035, length: 0.04, axis: 'y', segs: 12, color: '#374151' }),
      // mesa de herramientas al frente
      B({ id: 'tooltable', pos: [0.2, 0.55, 1.45], size: [3.4, 0.06, 0.62], color: '#e2e8f0', kind: 'floor' }), ...legs(0.2, 1.45, 3.4, 0.62, 0.52),
      // dado de bujías: dado largo con inserto de hule, extensión y matraca
      Cy({ id: 'llave_bujia', pos: [-1.2, 0.655, 1.4], radius: 0.065, length: 0.26, axis: 'x', segs: 6, color: '#d1d5db', gloss: 0.9 }),
      Cy({ id: 'llave_bujia', pos: [-1.335, 0.655, 1.4], radius: 0.05, length: 0.012, axis: 'x', segs: 12, color: '#7f1d1d' }),
      Cy({ id: 'llave_bujia', pos: [-0.98, 0.655, 1.4], radius: 0.02, length: 0.2, axis: 'x', segs: 8, color: '#9ca3af', gloss: 0.8 }),
      Cy({ id: 'llave_bujia', pos: [-0.86, 0.655, 1.4], radius: 0.06, length: 0.05, axis: 'y', segs: 16, color: '#9ca3af', gloss: 0.8 }),
      Cy({ id: 'llave_bujia', pos: [-0.86, 0.655, 1.56], radius: 0.026, length: 0.26, axis: 'z', segs: 10, color: '#9ca3af', gloss: 0.8 }),
      Cy({ id: 'llave_bujia', pos: [-0.86, 0.655, 1.66], radius: 0.034, length: 0.12, axis: 'z', segs: 10, color: '#1f2937' }),
      // dado común (corto, sin inserto)
      Cy({ id: 'dado_comun', pos: [-0.52, 0.64, 1.38], radius: 0.055, length: 0.13, axis: 'x', segs: 6, color: '#9ca3af', gloss: 0.8 }),
      Cy({ id: 'dado_comun', pos: [-0.445, 0.64, 1.38], radius: 0.04, length: 0.02, axis: 'x', segs: 12, color: '#4b5563' }),
      // calibrador de galgas: mango naranja y hojas de acero en abanico
      B({ id: 'galgas', pos: [-0.18, 0.6, 1.45], size: [0.14, 0.035, 0.08], color: '#ea580c', gloss: 0.4 }),
      ...[0, 1, 2, 3, 4].map(k => B({ id: 'galgas', pos: [0.03 + k * 0.012, 0.592 + k * 0.007, 1.34 + k * 0.055], size: [0.36 - k * 0.03, 0.006, 0.045], color: k % 2 ? '#cbd5e1' : '#e2e8f0', gloss: 0.8 })),
      Cy({ id: 'galgas', pos: [-0.2, 0.625, 1.45], radius: 0.02, length: 0.02, axis: 'y', segs: 10, color: '#334155' }),
      // llave de torque: cabeza con matraca, cuerpo, escala y empuñadura
      B({ id: 'torque', pos: [0.62, 0.625, 1.6], size: [0.6, 0.05, 0.06], color: '#334155', gloss: 0.6 }),
      Cy({ id: 'torque', pos: [0.27, 0.625, 1.6], radius: 0.055, length: 0.05, axis: 'y', segs: 16, color: '#cbd5e1', gloss: 0.8 }),
      Cy({ id: 'torque', pos: [0.27, 0.6, 1.6], radius: 0.018, length: 0.04, axis: 'y', segs: 4, color: '#9ca3af' }),
      B({ id: 'torque', pos: [0.66, 0.652, 1.6], size: [0.12, 0.006, 0.04], color: '#facc15' }),
      Cy({ id: 'torque', pos: [1.02, 0.625, 1.6], radius: 0.04, length: 0.22, axis: 'x', segs: 12, color: '#111827' }),
      // grasa dieléctrica: tubo con pliegue, etiqueta y tapa
      Cy({ id: 'grasa', pos: [1.32, 0.615, 1.3], radius: 0.045, length: 0.22, axis: 'x', segs: 14, color: '#16a34a', gloss: 0.6 }),
      Cy({ id: 'grasa', pos: [1.32, 0.615, 1.3], radius: 0.047, length: 0.08, axis: 'x', segs: 14, color: '#f8fafc' }),
      B({ id: 'grasa', pos: [1.2, 0.615, 1.3], size: [0.02, 0.02, 0.1], color: '#15803d' }),
      Cy({ id: 'grasa', pos: [1.455, 0.615, 1.3], radius: 0.025, length: 0.05, axis: 'x', segs: 10, color: '#f8fafc' }),
      // caja de la bujía nueva
      B({ id: 'caja', pos: [1.8, 0.62, 1.45], size: [0.22, 0.08, 0.22], color: '#f5821f', kind: 'static' }),
      ...sparkPlug('bujia_nueva', 1.8, 0.82, 1.45),
    ];
    for (let i = 0; i < 6; i++) {
      // bobina tipo lápiz: cabeza con conector, bota de hule y oreja de montaje
      M.push(B({ id: 'coil' + (i + 1), pos: [X(i), 2.1, 0], size: [0.22, 0.13, 0.3], color: '#1f2937', gloss: 0.5 }));
      M.push(Cy({ id: 'coil' + (i + 1), pos: [X(i), 1.99, 0], radius: 0.065, length: 0.12, axis: 'y', segs: 14, color: '#111827' }));
      M.push(B({ id: 'coil' + (i + 1), pos: [X(i) + 0.1, 2.07, -0.13], size: [0.1, 0.025, 0.07], color: '#374151' }));
      M.push(B({ id: 'conn' + (i + 1), pos: [X(i), 2.12, 0.19], size: [0.12, 0.08, 0.1], color: '#94a3b8', gloss: 0.4 }));
      M.push(B({ id: 'conn' + (i + 1), pos: [X(i), 2.17, 0.21], size: [0.06, 0.02, 0.05], color: '#f5821f' }));
      M.push(B({ id: 'num' + (i + 1), pos: [X(i), 1.72, 0.43], size: [0.08, 0.08, 0.01], color: '#0b2d52', kind: 'static' }));
    }
    M.push(...sparkPlug('plug1', X(0), 1.86, 0));
    return M;
  };

  return {
    motorGas: { build: motorGas, cam: { target: [0.3, 1.3, 0.4], dist: 6.3, yaw: 0.42, pitch: 0.58 }, shadow: [-1.9, 1.9, -0.75, 0.75], grid: 0.5,
      tags: { num1: '1', num2: '2', num3: '3', num4: '4', num5: '5', num6: '6' }, initial: [{ id: 'plug1', a: 0 }] },
  };
})();

const PART_NAMES_MOTOR = {
  block: 'Bloque del motor', head: 'Culata', cover: 'Tapa de punterías', manifold: 'Múltiple de admisión', pulley: 'Polea del cigüeñal',
  oilcap: 'Tapón de llenado de aceite', dipstick: 'Varilla de nivel de aceite', sensor: 'Sensor de temperatura',
  battery: 'Batería de 12 V', bat_pos: 'Borne positivo (+)', bat_neg: 'Borne negativo (–)',
  llave_bujia: 'Dado para bujías (con inserto de hule)', dado_comun: 'Dado común 13 mm', galgas: 'Calibrador de galgas', torque: 'Llave de torque',
  grasa: 'Grasa dieléctrica', bujia_nueva: 'Bujía nueva', plug1: 'Bujía del cilindro 1',
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].flatMap(n => [['coil' + n, `Bobina de encendido · cilindro ${n}`], ['conn' + n, `Conector de la bobina · cilindro ${n}`]])),
};

/* Paso: target (id), say (instrucción), hint (pista tras 2 fallos), learn (qué es / por qué),
         anim [{id, off, a, tint}], reading {text, status}, question {q, o, a, fb} */
const SENALA = [
  {
    id: 'bujias', title: 'Cambio de bujía', subtitle: 'Motor a gas natural de 6 cilindros', icon: '{{i:flame}}', min: 6, comps: ['diesel', 'elec'], scene: 'motorGas',
    names: PART_NAMES_MOTOR,
    intro: 'El autobús (motor a gas natural) tiene una falla de encendido en el cilindro 1. Vas a cambiar su bujía siguiendo el proceso completo. En cada paso, señala en el modelo la pieza o la herramienta correcta. Tienes 3 intentos por paso; si no la encuentras, el modelo te la muestra.',
    steps: [
      { short: 'Desconectar la batería', target: 'bat_neg', say: 'Señala el borne NEGATIVO de la batería para desconectarla.', hint: 'Está en la batería azul de la derecha; es el borne negro.',
        learn: 'Siempre se desconecta primero el negativo: así no hay chispa ni riesgo de activar la bobina mientras trabajas.', anim: [{ id: 'bat_neg', off: [0, 0.25, 0.1], a: 0.4 }] },
      { short: 'Soltar el conector de la bobina', target: 'conn1', say: 'Señala el conector eléctrico de la bobina del cilindro 1.', hint: 'Busca el cilindro 1 (número en la tapa) y el conector gris pegado a la bobina.',
        learn: 'Primero se libera el conector presionando su seguro; si jalas la bobina con el conector puesto, rompes el arnés.', anim: [{ id: 'conn1', off: [0, 0.12, 0.3] }] },
      { short: 'Retirar la bobina', target: 'coil1', say: 'Señala la bobina de encendido del cilindro 1.', hint: 'Es la pieza negra rectangular encima de la tapa, sobre el cilindro 1.',
        learn: 'La bobina transforma 12–24 V en miles de volts para producir la chispa. Está montada directamente encima de la bujía.', anim: [{ id: 'coil1', off: [0, 0.95, 0.45], a: 0.35 }, { id: 'plug1', a: 1 }] },
      { short: 'Elegir el dado de bujías', target: 'llave_bujia', say: 'Señala la herramienta correcta para aflojar la bujía.', hint: 'Está en la mesa: el dado largo con inserto de hule (no el dado común).',
        learn: 'El dado de bujías es largo para alcanzar el pozo y tiene un hule que sujeta la cerámica sin romperla.', anim: [{ id: 'llave_bujia', off: [-0.05, 1.5, -1.4] }] },
      { short: 'Retirar la bujía usada', target: 'plug1', say: 'Ahora señala la bujía para retirarla.', hint: 'Quedó visible al retirar la bobina: es la pieza blanca en el pozo del cilindro 1.',
        learn: 'La bujía produce la chispa que enciende la mezcla. Una bujía gastada causa falla de encendido, más consumo y vibración.',
        anim: [{ id: 'plug1', off: [0, 0.9, 0.55], tint: '#a16207' }, { id: 'llave_bujia', off: [0, 0, 0] }],
        reading: { text: 'Bujía usada: electrodo desgastado y con carbón · holgura 1.2 mm (máx. 0.9)', status: 'bad' } },
      { short: 'Revisar la holgura', target: 'galgas', say: 'Señala la herramienta para revisar la holgura de la bujía nueva.', hint: 'Es la herramienta plana naranja de la mesa.',
        learn: 'El calibrador de galgas mide la separación entre electrodos. Si no coincide con la especificación, la chispa es débil o falla.',
        reading: { text: 'Holgura de la bujía nueva: 0.8 mm ✓ (especificación de ejemplo 0.7–0.9 mm)', status: 'ok' } },
      { short: 'Instalar la bujía nueva', target: 'bujia_nueva', say: 'Señala la bujía nueva para instalarla.', hint: 'Está sobre su caja naranja, en la mesa.',
        learn: 'La bujía nueva debe ser del mismo tipo y grado térmico que indica el fabricante.',
        question: { q: '¿Cómo inicias la rosca de la bujía nueva?', o: ['A mano, para no barrer la rosca de la culata', 'Con la matraca, con fuerza', 'Con pistola de impacto'], a: 0, fb: 'Iniciar a mano evita cruzar la rosca: reparar una culata cuesta mucho más que una bujía.' },
        anim: [{ id: 'bujia_nueva', off: [-3.05, 1.07, -1.45] }, { id: 'plug1', a: 0 }] },
      { short: 'Apretar con torque', target: 'torque', say: 'Señala la herramienta para el apriete final de la bujía.', hint: 'Es la llave larga y oscura de la mesa.',
        learn: 'La llave de torque aplica el apriete exacto: poco apriete provoca fugas y sobrecalentamiento; demasiado daña la rosca.',
        reading: { text: 'Bujía apretada a 25 N·m ✓ (valor de ejemplo)', status: 'ok' }, anim: [{ id: 'bujia_nueva', tint: '#22c55e' }] },
      { short: 'Aplicar grasa dieléctrica', target: 'grasa', say: 'Señala lo que aplicas en la bota de la bobina antes de instalarla.', hint: 'Es el tubo verde de la mesa.',
        learn: 'La grasa dieléctrica sella contra humedad y evita fugas de alto voltaje entre la bobina y la bujía.' },
      { short: 'Reinstalar la bobina', target: 'coil1', say: 'Señala la bobina para reinstalarla.', hint: 'Es la bobina que retiraste (flota sobre el cilindro 1).',
        learn: 'La bobina debe asentar a fondo sobre la bujía para que la chispa llegue completa.', anim: [{ id: 'coil1', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
      { short: 'Reconectar el conector', target: 'conn1', say: 'Señala el conector para reconectarlo.', hint: 'El conector gris que retiraste.',
        learn: 'Escucha el "clic" del seguro: un conector flojo produce fallas intermitentes.', anim: [{ id: 'conn1', off: [0, 0, 0], tint: '#22c55e' }] },
      { short: 'Reconectar la batería', target: 'bat_neg', say: 'Señala el borne negativo para reconectar la batería.', hint: 'El borne negro de la batería.',
        learn: 'El negativo se conecta al final. Después: arranque y verificación sin fallas de encendido.',
        anim: [{ id: 'bat_neg', off: [0, 0, 0], a: 1, tint: '#22c55e' }], reading: { text: 'Motor encendido: sin fallas de encendido en el cilindro 1 ✓', status: 'ok' } },
    ],
  },
  {
    id: 'bateria24', title: 'Reemplazo de batería', subtitle: 'Banco de baterías de 24 V', icon: '{{i:battery}}', min: 4, comps: ['elec'], scene: 'baterias',
    names: { batA: 'Batería A (12 V)', batB: 'Batería B (12 V)', a_pos: 'Borne + de A', a_neg: 'Borne – de A', b_pos: 'Borne + de B', b_neg: 'Borne – de B', cable_pos: 'Cable positivo principal', jumper: 'Puente A– / B+', cable_neg: 'Cable negativo a chasis', bracket: 'Sujetador de baterías' },
    intro: 'Un multímetro ya indicó que la batería B está dañada (10.9 V). Señala cada pieza en el orden correcto para reemplazarla de forma segura.',
    steps: [
      { short: 'Identificar la batería dañada', target: 'batB', say: 'Señala la batería dañada (la que midió 10.9 V).', hint: 'Es la batería de la derecha.', learn: 'Se reemplaza solo la batería dañada, con otra de la misma especificación.', anim: [{ id: 'batB', tint: '#ef4444' }] },
      { short: 'Desconectar el negativo', target: 'cable_neg', say: 'Señala el primer cable que debes desconectar.', hint: 'Siempre el negativo a chasis primero: el cable negro de la derecha.', learn: 'Si quitas primero el positivo y la llave toca el chasis, provocas un cortocircuito.', anim: [{ id: 'cable_neg', off: [0.3, 0.35, 0], a: 0.4 }] },
      { short: 'Retirar el puente', target: 'jumper', say: 'Señala el puente que une las dos baterías.', hint: 'La barra gris entre ambas baterías.', learn: 'El puente une el negativo de A con el positivo de B: así se forman los 24 V.', anim: [{ id: 'jumper', off: [0, 0.35, 0], a: 0.4 }] },
      { short: 'Quitar el sujetador', target: 'bracket', say: 'Señala la pieza que sujeta las baterías a la charola.', hint: 'La barra larga de atrás.', learn: 'Una batería sin sujetar se mueve, se daña y puede provocar cortos.', anim: [{ id: 'bracket', off: [0, 0.5, -0.7], a: 0.3 }] },
      { short: 'Cambiar la batería', target: 'batB', say: 'Ya está libre: señala la batería para retirarla e instalar la nueva.', hint: 'La batería de la derecha.', learn: 'Al instalar la nueva: sujetador, puente y al final el negativo.',
        anim: [{ id: 'batB', tint: '#22c55e' }, { id: 'bracket', off: [0, 0, 0], a: 1 }, { id: 'jumper', off: [0, 0, 0], a: 1, tint: '#22c55e' }] },
      { short: 'Conectar el negativo', target: 'cable_neg', say: 'Señala el último cable que se conecta.', hint: 'El negativo a chasis: el cable negro.', learn: 'El negativo va al final. Luego verificas: 25.4 V en el sistema.',
        anim: [{ id: 'cable_neg', off: [0, 0, 0], a: 1, tint: '#22c55e' }], reading: { text: 'Sistema: 25.4 V ✓', status: 'ok' } },
    ],
  },
];
