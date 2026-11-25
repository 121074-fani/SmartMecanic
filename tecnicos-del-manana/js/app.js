/* =========================================================
   Técnicos del Mañana — Lógica de la aplicación (SPA)
   ========================================================= */
'use strict';

/* ---------------- Utilidades ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const round = Math.round;
const COMP_IDS = COMPETENCIAS.map(c => c.id);
const comp = id => COMPETENCIAS.find(c => c.id === id);
const compName = id => comp(id)?.name ?? id;
const uid = () => Math.random().toString(36).slice(2, 9);
const C = { pre: '#94a3b8', now: '#ff8a1f', post: '#ff8a1f', delayed: '#14b8a6', self: '#a78bfa', team: '#60a5fa' };

function levelLabel(m) {
  if (m >= 85) return { t: 'Dominio', cls: 'lv4' };
  if (m >= 70) return { t: 'Competente', cls: 'lv3' };
  if (m >= 40) return { t: 'En desarrollo', cls: 'lv2' };
  return { t: 'Brecha crítica', cls: 'lv1' };
}

/* ---------------- Estado (persistente, offline) ---------------- */
const STORE_KEY = 'tdm_state_v1';
function defaultState() {
  const z = v => Object.fromEntries(COMP_IDS.map(c => [c, v]));
  return {
    user: null, day: 0, xp: 0, badges: [],
    selfAssess: z(3), mastery: z(0), stability: z(4), lastPractice: z(null),
    tests: { pre: null, post: null, delayed: null },
    lessonsDone: {}, practice: [], procs: [], sims: {}, reviews: [],
    errors: {}, qErrors: {}, docLookups: 0, unanswered: [], log: [],
  };
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return Object.assign(defaultState(), JSON.parse(raw)); } catch (e) { /* almacenamiento no disponible */ }
  return defaultState();
}
let S = load();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* sin persistencia */ } renderChrome(); }
function log(type, text) { S.log.push({ day: S.day, ts: Date.now(), type, text }); }

/* ---------------- Gamificación ---------------- */
const XP_PER_LEVEL = 300;
const level = () => 1 + Math.floor(S.xp / XP_PER_LEVEL);
function addXP(n, why) {
  const before = level();
  S.xp += Math.max(0, round(n));
  toast(`+${round(n)} XP · ${why}`);
  if (level() > before) { toast(`⭐ ¡Subiste a nivel ${level()}!`); log('nivel', `Alcanzó el nivel ${level()}`); }
}
function badge(id) {
  if (S.badges.includes(id)) return;
  S.badges.push(id);
  const b = BADGES[id];
  toast(`${b.icon} Insignia desbloqueada: ${b.name}`);
  log('insignia', `Insignia "${b.name}"`);
}

/* ---------------- Modelo de dominio y olvido ---------------- */
// Dominio efectivo = dominio medido × curva de olvido (Ebbinghaus simplificada con piso de 40%)
function effMastery(c, day = S.day) {
  const m = S.mastery[c] ?? 0, last = S.lastPractice[c];
  if (last == null) return round(m);
  const t = Math.max(0, day - last);
  return round(m * (0.4 + 0.6 * Math.exp(-t / (S.stability[c] || 4))));
}
const effAll = () => COMP_IDS.map(c => effMastery(c));
function touch(c, newMastery, stabilityMin = 3) {
  S.mastery[c] = Math.max(0, Math.min(100, round(newMastery)));
  S.lastPractice[c] = S.day;
  S.stability[c] = Math.max(S.stability[c] || 4, stabilityMin);
}

/* ---------------- Repetición espaciada (1, 3, 7, 21 días) ---------------- */
const SR_INTERVALS = [1, 3, 7, 21];
function scheduleReviews(c, from) {
  S.reviews = S.reviews.filter(r => r.done || r.c !== c);
  SR_INTERVALS.forEach(off => S.reviews.push({ id: uid(), c, due: S.day + off, done: false, from, interval: off }));
}
const dueReviews = () => S.reviews.filter(r => !r.done && r.due <= S.day);
const upcomingReviews = () => S.reviews.filter(r => !r.done && r.due > S.day).sort((a, b) => a.due - b.due);

/* ---------------- Ruta adaptativa ---------------- */
function computeRoute() {
  const role = ROLES[S.user?.role || 'nuevo'];
  return LESSONS.map(l => {
    const m = effMastery(l.comp);
    const gap = 100 - m;
    let prio = gap * role.weights[l.comp];
    const reasons = [];
    if (gap > 30) reasons.push(`Brecha de ${gap} pts`);
    if (role.weights[l.comp] >= 1.3) reasons.push('Clave para tu rol');
    if (l.level === 2 && m < 40) { prio *= 0.55; reasons.push('Primero el nivel básico'); }
    if (l.level === 1 && m >= 70) { prio *= 0.3; }
    if (l.comp === 'hv' && m < 70) { prio += 1000; reasons.unshift('Obligatorio: seguridad'); }
    if (m >= 85) { prio *= 0.2; reasons.push('Ya dominas este tema (opcional)'); }
    const done = S.lessonsDone[l.id] != null;
    return { ...l, m, prio, reasons, done };
  }).sort((a, b) => (a.done - b.done) || (b.prio - a.prio));
}
function scenarioLocked(sc) {
  if (!sc.requires) return false;
  return !(S.lessonsDone[sc.requires.lesson] != null || effMastery('hv') >= sc.requires.mastery);
}

/* ---------------- Siguiente acción sugerida ---------------- */
function nextAction() {
  if (!S.tests.pre) return { route: 'diagnostico', title: 'Haz tu diagnóstico inicial', text: '14 preguntas adaptativas (≈8 min) para construir tu mapa de competencias.', cta: 'Empezar diagnóstico' };
  if (dueReviews().length) return { route: 'repasos', title: `Tienes ${dueReviews().length} repaso(s) pendiente(s)`, text: 'La repetición espaciada es la forma más eficiente de no olvidar.', cta: 'Hacer repaso' };
  const done = Object.keys(S.lessonsDone).length;
  const r = computeRoute().find(l => !l.done);
  if (done < 3 && r) return { route: 'leccion/' + r.id, title: r.title, text: `Micro-lección de ${r.min} min · ${r.reasons[0] || compName(r.comp)}`, cta: 'Empezar lección' };
  if (!(S.procs || []).some(p => String(p.id).startsWith('senala-'))) return { route: 'senala/bujias', title: 'Práctica: cambio de bujía', text: 'Señala cada pieza y herramienta en el motor 3D. Tienes 3 intentos por paso.', cta: 'Empezar práctica' };
  if (!Object.values(S.sims || {}).some(p => p.hacer != null)) return { route: 'aprende', title: 'Aprende haciendo: tu primera simulación', text: 'Repara un inversor, una manguera o una batería paso a paso sobre las piezas en 3D.', cta: 'Empezar' };
  if (!(S.procs || []).length) return { route: 'taller', title: 'Practica un procedimiento en el taller virtual', text: 'Elige herramientas y repara piezas paso a paso sobre el modelo 3D.', cta: 'Ir al taller' };
  if (!S.practice.length) return { route: 'practica', title: 'Practica en el simulador de fallas', text: 'Diagnostica una falla real paso a paso sobre el modelo 3D.', cta: 'Ir al simulador' };
  if (!S.tests.post) return { route: 'evaluaciones', title: 'Haz tu post-test', text: 'Mide cuánto aprendiste comparado con tu diagnóstico.', cta: 'Ir a evaluaciones' };
  if (!S.tests.delayed) return { route: 'evaluaciones', title: 'Revisión diferida', text: 'Simula el paso del tiempo y mide tu retención.', cta: 'Ir a evaluaciones' };
  if (r) return { route: 'leccion/' + r.id, title: r.title, text: `Sigue tu ruta: ${r.reasons[0] || compName(r.comp)}`, cta: 'Continuar' };
  return { route: 'tablero', title: '¡Ruta completada!', text: 'Revisa tus indicadores y mantén tus repasos.', cta: 'Ver tablero' };
}

/* ---------------- UI global ---------------- */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}
function renderChrome() {
  const u = $('#userCard');
  if (S.user) {
    const lv = level(), into = S.xp % XP_PER_LEVEL;
    u.innerHTML = `
      <div class="uc-name">${esc(S.user.name)}</div>
      <div class="uc-role">${esc(ROLES[S.user.role].name)}</div>
      <div class="uc-lv"><span>Nivel ${lv}</span><span>${S.xp} XP</span></div>
      <div class="bar"><i style="width:${into / XP_PER_LEVEL * 100}%"></i></div>
      <div class="uc-badges">${S.badges.map(b => `<span title="${esc(BADGES[b].name)}">${BADGES[b].icon}</span>`).join('') || '<span class="muted small">Sin insignias aún</span>'}</div>`;
  } else u.innerHTML = '<div class="muted small">Sin sesión</div>';
  $('#dayNum').textContent = S.day;
  const due = dueReviews().length;
  const badgeEl = $('#navReviews');
  if (badgeEl) { badgeEl.textContent = due; badgeEl.hidden = !due; }
}
function setOnline() {
  const on = navigator.onLine;
  const p = $('#netPill');
  p.className = 'pill net ' + (on ? 'on' : 'off');
  p.innerHTML = on ? '● En línea' : '● Sin conexión · datos locales';
}
function advanceDays(n) {
  S.day += n;
  log('tiempo', `Avanzó ${n} día(s) simulados → día ${S.day}`);
  save();
  const d = dueReviews().length;
  toast(`📅 Día ${S.day}${d ? ` · ${d} repaso(s) pendiente(s)` : ''}`);
  render();
}

/* ---------------- Router ---------------- */
let cleanup = [];
const NAV_GROUP = { leccion: 'ruta', senala: 'practicar', aprende: 'practicar', taller: 'practicar', practica: 'practicar', inspeccion: 'practicar', diagnostico: 'evaluar', evaluaciones: 'evaluar', repasos: 'evaluar' };
const SUBNAV = {
  practicar: [['practicar', '🚌 Autobús y módulos'], ['senala', '👆 Señala la pieza'], ['aprende', '⭐ Aprende haciendo'], ['taller', '🔧 Taller'], ['practica', '🛠️ Fallas'], ['inspeccion', '🚌 Modelo 3D']],
  evaluar: [['diagnostico', '🎯 Diagnóstico'], ['evaluaciones', '📝 Antes · después · diferida'], ['repasos', '🔁 Repasos']],
};
const ROUTES = {
  inicio: viewHome, diagnostico: viewDiag, ruta: viewRoute, leccion: viewLesson,
  practica: viewPractice, practicar: viewPracticar, senala: viewSenala, aprende: viewAprende, taller: viewTaller, inspeccion: viewInspect, evaluaciones: viewEvals, repasos: viewReviews,
  asistente: viewAssistant, tablero: viewDashboard, escalabilidad: viewScale,
};
function go(r) { const h = '#/' + r; if (location.hash === h) render(); else location.hash = h; }
function render() {
  cleanup.forEach(f => f()); cleanup = [];
  let [, r, param] = (location.hash || '#/inicio').split('/');
  if (!ROUTES[r]) r = 'inicio';
  if (!S.user && !['inicio', 'escalabilidad', 'inspeccion'].includes(r)) r = 'inicio';
  const view = $('#view');
  view.innerHTML = '';
  view.className = 'view v-' + r;
  ROUTES[r](view, param);
  const grp = NAV_GROUP[r] || r;
  $$('#nav a, #tabbar a').forEach(a => a.classList.toggle('active', a.dataset.r === grp));
  const sub = SUBNAV[grp];
  if (sub && !param) {
    const bar = document.createElement('div');
    bar.className = 'subnav';
    bar.innerHTML = sub.map(([k, t]) => `<a href="#/${k}" class="${k === r ? 'on' : ''}">${t}</a>`).join('');
    view.prepend(bar);
  }
  document.body.classList.remove('nav-open');
  renderChrome();
  window.scrollTo(0, 0);
}

/* ---------------- Componente: quiz ---------------- */
function runQuiz(container, { total, next, onDone, label = '' }) {
  const results = [];
  const step = () => {
    const q = next(results);
    if (!q) return onDone(results);
    const order = shuffle(q.o.map((_, i) => i));
    container.innerHTML = `
      <div class="card quiz">
        <div class="quiz-head"><span class="pill">${comp(q.c).icon} ${esc(compName(q.c))}</span><span class="muted">${esc(label)} · ${results.length + 1} / ${total}</span></div>
        <div class="progress"><i style="width:${results.length / total * 100}%"></i></div>
        <h3 class="quiz-q">${esc(q.q)}</h3>
        <div class="opts">${order.map((i, k) => `<button class="opt" data-i="${i}"><span class="key">${'ABCD'[k]}</span>${esc(q.o[i])}</button>`).join('')}</div>
        <div class="quiz-fb"></div>
      </div>`;
    $$('.opt', container).forEach(b => b.onclick = () => {
      const i = +b.dataset.i, correct = i === q.a;
      results.push({ q, correct });
      if (!correct) S.qErrors[q.id] = (S.qErrors[q.id] || 0) + 1;
      $$('.opt', container).forEach(x => { x.disabled = true; if (+x.dataset.i === q.a) x.classList.add('right'); });
      if (!correct) b.classList.add('wrong');
      const fb = $('.quiz-fb', container);
      fb.innerHTML = `<div class="fb ${correct ? 'ok' : 'bad'}"><b>${correct ? '✔ Correcto.' : '✘ Incorrecto.'}</b> ${esc(q.exp || '')}</div>
        <button class="btn primary">${results.length >= total ? 'Ver resultados' : 'Siguiente →'}</button>`;
      $('button', fb).onclick = step;
      $('button', fb).focus();
    });
  };
  step();
}
/* ---------- Modo demo: contesta el quiz solo, con respuestas aleatorias visibles ---------- */
const demoAuto = { on: false, timer: null };
function stopDemoAuto() { demoAuto.on = false; clearTimeout(demoAuto.timer); $$('.opt.demo-hover').forEach(o => o.classList.remove('demo-hover')); }
function startDemoAuto(container) {
  demoAuto.on = true;
  const wait = (ms, f) => { clearTimeout(demoAuto.timer); demoAuto.timer = setTimeout(() => { if (demoAuto.on && document.body.contains(container)) f(); else stopDemoAuto(); }, ms); };
  const step = () => {
    const next = $('.quiz-fb button', container);
    if (next) return wait(1100, () => { next.click(); wait(600, step); });
    const opts = $$('.opt:not([disabled])', container);
    if (!opts.length) return stopDemoAuto();               // terminó el quiz
    const pick = opts[Math.floor(Math.random() * opts.length)];
    let k = 0;                                              // recorre las opciones como si las leyera
    const hover = () => {
      opts.forEach(o => o.classList.remove('demo-hover'));
      if (k < opts.length) { opts[k].classList.add('demo-hover'); k++; return wait(230, hover); }
      pick.classList.add('demo-hover');
      wait(450, () => { pick.classList.remove('demo-hover'); pick.click(); wait(300, step); });
    };
    hover();
  };
  cleanup.push(stopDemoAuto);
  wait(500, step);
}
function pickQ(c, lvl, exclude) {
  let pool = QUESTIONS.filter(q => q.c === c && q.lvl === lvl && !exclude.has(q.id));
  if (!pool.length) pool = QUESTIONS.filter(q => q.c === c && !exclude.has(q.id));
  if (!pool.length) pool = QUESTIONS.filter(q => q.c === c);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* =========================================================
   VISTA: Inicio
   ========================================================= */
function viewHome(el) {
  if (!S.user) {
    el.innerHTML = `
      <section class="hero">
        <div class="hero-txt">
          <span class="eyebrow">HackaTec 2026 · Reto Volvo</span>
          <h1>Técnicos del Mañana</h1>
          <p class="lead">Sistema inteligente de entrenamiento adaptativo para técnicos de autobuses diésel y eléctricos: diagnostica lo que sabes, arma tu ruta, te entrena con simulación de fallas en 3D y verifica con evidencia que lo aprendiste y lo retienes.</p>
          <form id="startForm" class="card start">
            <label>Nombre del técnico<input name="name" required maxlength="40" placeholder="Ej. Ana López"></label>
            <label>Rol<select name="role">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}">${esc(r.name)}</option>`).join('')}</select></label>
            <div class="row">
              <button class="btn primary" type="submit">Comenzar →</button>
              <button class="btn ghost" type="button" id="demoBtn" title="Carga un historial completo para presentar el prototipo">Cargar datos demo</button>
            </div>
          </form>
        </div>
        <div class="hero-3d card"><canvas id="heroCanvas"></canvas><div class="hero-cap">Modelo 3D interactivo · arrastra para girar</div></div>
      </section>
      ${flowHTML()}`;
    const sc = new E3D.Scene($('#heroCanvas'), { autoRotate: true, xray: true, dist: 16.5 });
    sc.setMeshes(E3D.buildBus('ev'));
    sc.labels = Object.fromEntries(Object.entries(COMPONENTS).map(([k, v]) => [k, v.name]));
    cleanup.push(() => sc.destroy());
    $('#startForm').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      S.user = { name: String(f.get('name')).trim() || 'Técnico', role: f.get('role'), since: Date.now() };
      log('inicio', `Registro como ${ROLES[S.user.role].name}`);
      save(); go('diagnostico');
    };
    $('#demoBtn').onclick = () => { loadDemo(); go('tablero'); };
    return;
  }
  const na = nextAction();
  const done = Object.keys(S.lessonsDone).length;
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Día simulado ${S.day}</span><h1>Hola, ${esc(S.user.name.split(' ')[0])}</h1></div></div>
    <div class="grid g-2-1">
      <div class="card next">
        <span class="eyebrow">Tu siguiente paso</span>
        <h2>${esc(na.title)}</h2><p>${esc(na.text)}</p>
        <button class="btn primary" onclick="go('${na.route}')">${esc(na.cta)} →</button>
      </div>
      <div class="card kpis-mini">
        <div><b>${S.tests.pre ? round(avg(effAll())) : '—'}</b><span>Dominio actual</span></div>
        <div><b>${done}/${LESSONS.length}</b><span>Micro-lecciones</span></div>
        <div><b>${S.practice.length}</b><span>Prácticas</span></div>
        <div><b>${dueReviews().length}</b><span>Repasos hoy</span></div>
      </div>
    </div>
    ${flowHTML()}`;
}
function flowHTML() {
  const st = [
    ['diagnostico', '1', 'Diagnóstico inicial', 'Quiz adaptativo + autoevaluación → mapa de competencias', !!S.tests.pre],
    ['ruta', '2', 'Ruta adaptativa', 'Micro-lecciones priorizadas por brecha y rol', Object.keys(S.lessonsDone).length > 0],
    ['practicar', '3', 'Módulo práctico 3D', 'Señala la pieza, Aprende haciendo, Taller y Fallas', S.practice.length > 0 || (S.procs || []).length > 0],
    ['evaluaciones', '4', 'Pre / post / diferida', 'Ganancia de aprendizaje y retención', !!S.tests.delayed],
    ['tablero', '5', 'Tablero de indicadores', 'Avance, dominio, errores, retención', !!S.tests.pre],
    ['escalabilidad', '6', 'Escalabilidad e integración', 'Documentación, cientos de técnicos, offline', true],
  ];
  return `<section class="flow">${st.map(([r, n, t, d, ok]) => `
    <a class="card step ${ok && S.user ? 'ok' : ''}" href="#/${r}"><span class="num">${ok && S.user ? '✓' : n}</span><div><b>${t}</b><small>${d}</small></div></a>`).join('')}</section>`;
}

/* =========================================================
   VISTA: Diagnóstico inicial
   ========================================================= */
function viewDiag(el, param) {
  if (S.tests.pre && param !== 'repetir') return diagResults(el);
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Entregable 1</span><h1>Diagnóstico inicial de competencias</h1>
    <p class="muted">Paso 1 de 2 · Autoevaluación. ¿Qué tan seguro te sientes en cada tema? (1 = nada, 5 = experto)</p></div></div>
    <form class="card selfform" id="selfForm">
      ${COMPETENCIAS.map(c => `
        <div class="sa-row"><span>${c.icon} ${esc(c.name)}</span>
          <div class="scale">${[1, 2, 3, 4, 5].map(v => `<label><input type="radio" name="${c.id}" value="${v}" ${v === 3 ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>`).join('')}
      <div class="row"><button class="btn primary" type="submit">Continuar al quiz adaptativo →</button>
        <button class="btn demo-btn" type="button" id="simDiag">🎲 Simular respuestas (demo)</button></div>
    </form>`;
  $('#simDiag').onclick = async () => {
    const b = $('#simDiag'); b.disabled = true; b.textContent = '🎲 Simulando…';
    for (const c of COMP_IDS) {
      const v = 1 + Math.floor(Math.random() * 5);
      const inp = document.querySelector(`#selfForm input[name="${c}"][value="${v}"]`);
      if (!inp) return;
      inp.checked = true; inp.closest('.sa-row').classList.add('demo-pick');
      await new Promise(r => setTimeout(r, 320));
    }
    await new Promise(r => setTimeout(r, 450));
    demoAuto.on = true;
    if ($('#selfForm')) $('#selfForm').requestSubmit();
  };
  $('#selfForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    COMP_IDS.forEach(c => S.selfAssess[c] = +f.get(c));
    el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Paso 2 de 2</span><h1>Quiz adaptativo</h1><p class="muted">La dificultad se ajusta a tus respuestas: si aciertas sube, si fallas baja.</p></div>
      <button class="btn demo-btn" type="button" id="simQuiz">${demoAuto.on ? '⏹ Detener simulación' : '🎲 Simular respuestas (demo)'}</button></div><div id="qz"></div>`;
    $('#simQuiz').onclick = () => { if (demoAuto.on) stopDemoAuto(); else startDemoAuto($('#qz')); $('#simQuiz').textContent = demoAuto.on ? '⏹ Detener simulación' : '🎲 Simular respuestas (demo)'; };
    const used = new Set();
    runQuiz($('#qz'), {
      total: COMP_IDS.length * 2, label: 'Diagnóstico',
      next: res => {
        const ci = Math.floor(res.length / 2);
        if (ci >= COMP_IDS.length) return null;
        const c = COMP_IDS[ci];
        const lvl = res.length % 2 === 0 ? 2 : (res[res.length - 1].correct ? 3 : 1);
        const q = pickQ(c, lvl, used); used.add(q.id); return q;
      },
      onDone: res => {
        const scores = {};
        COMP_IDS.forEach((c, i) => {
          const [a, b] = [res[i * 2], res[i * 2 + 1]];
          scores[c] = a.correct ? (b.correct ? 100 : 70) : (b.correct ? 40 : 10);
          touch(c, scores[c], 4);
        });
        S.tests.pre = { day: S.day, scores, avg: round(avg(Object.values(scores))), answers: res.map(r => ({ id: r.q.id, ok: r.correct })) };
        log('evaluación', `Diagnóstico inicial: ${S.tests.pre.avg}/100`);
        badge('primer_paso'); addXP(100, 'Diagnóstico inicial');
        save(); go('diagnostico');
      },
    });
    if (demoAuto.on) startDemoAuto($('#qz'));
  };
}
function diagResults(el) {
  const pre = S.tests.pre.scores;
  const rows = COMPETENCIAS.map(c => {
    const m = pre[c.id], self = S.selfAssess[c.id] * 20, lv = levelLabel(m);
    const diff = self - m;
    const cal = diff > 30 ? '<span class="tag warn">Sobreconfianza</span>' : diff < -30 ? '<span class="tag info">Se subestima</span>' : '<span class="tag">Calibrado</span>';
    return `<tr><td>${c.icon} ${esc(c.name)}</td><td><div class="meter"><i class="${lv.cls}" style="width:${m}%"></i></div></td><td><b>${m}</b></td><td><span class="lvl ${lv.cls}">${lv.t}</span></td><td>${cal}</td></tr>`;
  }).join('');
  const gaps = COMPETENCIAS.filter(c => pre[c.id] < 40).map(c => c.short);
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Entregable 1 · Día ${S.tests.pre.day}</span><h1>Tu mapa de competencias</h1>
      <p class="muted">Resultado del diagnóstico: <b>${S.tests.pre.avg}/100</b>. ${gaps.length ? `Brechas críticas en: <b>${gaps.join(', ')}</b>.` : 'Sin brechas críticas.'}</p></div>
      <div class="row"><button class="btn ghost" onclick="go('diagnostico/repetir')">Repetir</button><button class="btn primary" onclick="go('ruta')">Ver mi ruta personalizada →</button></div></div>
    <div class="grid g-1-1">
      <div class="card">${Charts.radar({ labels: COMPETENCIAS.map(c => c.short), series: [
        { name: 'Autoevaluación', values: COMP_IDS.map(c => S.selfAssess[c] * 20), color: C.self, dash: true },
        { name: 'Diagnóstico medido', values: COMP_IDS.map(c => pre[c]), color: C.now }] })}</div>
      <div class="card"><table class="tbl"><thead><tr><th>Competencia</th><th style="width:30%">Dominio</th><th></th><th>Nivel</th><th>Calibración</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted small">La calibración compara lo que crees saber con lo que demostraste. La sobreconfianza en seguridad AV es un riesgo que el sistema prioriza.</p></div>
    </div>`;
}

/* =========================================================
   VISTA: Ruta adaptativa
   ========================================================= */
function viewRoute(el) {
  if (!S.tests.pre) { el.innerHTML = needPre(); return; }
  const route = computeRoute();
  const next = route.find(l => !l.done);
  const done = route.filter(l => l.done).length;
  const scen = SCENARIOS.map(s => ({ ...s, gap: avg(s.comps.map(c => 100 - effMastery(c))) })).sort((a, b) => b.gap - a.gap);
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Entregable 2 · ${esc(ROLES[S.user.role].name)}</span><h1>Tu ruta de aprendizaje adaptativa</h1>
      <p class="muted">Se recalcula con cada lección, práctica, repaso y evaluación. Prioridad = brecha × peso del rol, con seguridad AV como requisito.</p></div></div>
    ${dueReviews().length ? `<div class="banner" onclick="go('repasos')">🔁 Tienes <b>${dueReviews().length}</b> repaso(s) espaciado(s) para hoy → <u>hacerlos ahora</u></div>` : ''}
    <div class="grid g-1-2">
      <div class="card">
        <h3>Dominio: diagnóstico vs. actual</h3>
        ${Charts.radar({ size: 260, labels: COMPETENCIAS.map(c => c.short), series: [
          { name: 'Diagnóstico', values: COMP_IDS.map(c => S.tests.pre.scores[c]), color: C.pre, dash: true },
          { name: 'Actual (con olvido)', values: effAll(), color: C.now }] })}
        <div class="progress big"><i style="width:${done / route.length * 100}%"></i></div>
        <p class="muted small">${done} de ${route.length} micro-lecciones completadas</p>
      </div>
      <div>
        ${next ? `<div class="card next small-next"><span class="eyebrow">Recomendado ahora</span><h2>${comp(next.comp).icon} ${esc(next.title)}</h2>
          <p>${next.reasons.map(r => `<span class="tag">${esc(r)}</span>`).join(' ')} <span class="muted">· ${next.min} min</span></p>
          <button class="btn primary" onclick="go('leccion/${next.id}')">Empezar →</button></div>` : ''}
        <div class="card"><h3>Micro-lecciones (orden recomendado)</h3>
          <ol class="route">${route.map((l, i) => `
            <li class="${l.done ? 'done' : ''}" onclick="go('leccion/${l.id}')">
              <span class="rn">${l.done ? '✓' : i + 1}</span>
              <div class="rt"><b>${esc(l.title)}</b><small>${comp(l.comp).icon} ${esc(compName(l.comp))} · Nivel ${l.level} · ${l.min} min</small>
                <div>${l.done ? `<span class="tag ok">Completada día ${S.lessonsDone[l.id]}</span>` : l.reasons.slice(0, 2).map(r => `<span class="tag ${r.startsWith('Obligatorio') ? 'warn' : ''}">${esc(r)}</span>`).join(' ')}</div></div>
              <div class="rm"><div class="meter sm"><i class="${levelLabel(l.m).cls}" style="width:${l.m}%"></i></div><small>${l.m}</small></div>
            </li>`).join('')}</ol></div>
        <div class="card"><h3>Prácticas recomendadas</h3>
          <div class="scen-mini">${SENALA.map(sp => `<a href="#/senala/${sp.id}"><b>👆 ${esc(sp.title)}</b><small>Señala la pieza · ${sp.steps.length} pasos</small></a>`).join('')}${SIMS.map(sm => `<a href="#/aprende/${sm.id}"><b>⭐ ${esc(sm.title)}</b><small>Aprende haciendo · ${esc(sm.code)} · ${simPct(simProg(sm.id))}% completado</small></a>`).join('')}${PROCEDURES.map(p => ({ ...p, gap: avg(p.comps.map(c => 100 - effMastery(c))) })).sort((a, b) => b.gap - a.gap).map(p => `<a href="#/taller/${p.id}" class="${procLocked(p) ? 'locked' : ''}"><b>${procLocked(p) ? '🔒 ' : '🔧 '}${esc(p.title)}</b><small>Taller virtual · ${p.steps.length} tareas · brecha ${round(p.gap)}</small></a>`).join('')}${scen.map(s => `<a href="#/practica/${s.id}" class="${scenarioLocked(s) ? 'locked' : ''}"><b>${scenarioLocked(s) ? '🔒 ' : ''}${esc(s.title)}</b><small>Brecha promedio ${round(s.gap)} · ${s.comps.map(c => comp(c).short).join(', ')}</small></a>`).join('')}</div></div>
      </div>
    </div>`;
}
function needPre() {
  return `<div class="card empty"><h2>Primero, tu diagnóstico</h2><p>El sistema necesita conocer tus competencias para personalizar todo lo demás.</p><button class="btn primary" onclick="go('diagnostico')">Hacer diagnóstico →</button></div>`;
}

/* =========================================================
   VISTA: Micro-lección
   ========================================================= */
function viewLesson(el, id) {
  const l = LESSONS.find(x => x.id === id);
  if (!l) return go('ruta');
  let i = 0;
  const doc = DOCS.find(d => d.id === l.ref);
  const draw = () => {
    const isCheck = i >= l.cards.length;
    el.innerHTML = `
      <div class="page-head"><div><a href="#/ruta" class="back">← Mi ruta</a><span class="eyebrow">${comp(l.comp).icon} ${esc(compName(l.comp))} · Micro-lección · ${l.min} min</span><h1>${esc(l.title)}</h1></div></div>
      <div class="lesson">
        <div class="dots">${[...l.cards, 0].map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'c' : ''}"></i>`).join('')}</div>
        <div class="card lcard" id="lc"></div>
        <div class="card src"><b>📄 Fuente autorizada:</b> ${esc(doc?.title || l.ref)} <span class="muted">(${esc(l.ref)})</span>
          <button class="btn link" onclick="go('asistente')">Preguntar al asistente</button></div>
      </div>`;
    const lc = $('#lc');
    if (!isCheck) {
      const c = l.cards[i];
      lc.innerHTML = `<span class="eyebrow">${i + 1} / ${l.cards.length}</span><h2>${esc(c.t)}</h2><p class="big">${esc(c.b)}</p>
        <div class="row"><button class="btn ghost" ${i === 0 ? 'disabled' : ''} id="prev">← Anterior</button><button class="btn primary" id="nxt">${i === l.cards.length - 1 ? 'Comprobar lo aprendido →' : 'Siguiente →'}</button></div>`;
      $('#prev').onclick = () => { i--; draw(); };
      $('#nxt').onclick = () => { i++; draw(); };
    } else {
      const order = shuffle(l.check.o.map((_, k) => k));
      lc.innerHTML = `<div class="keypoint">💡 ${esc(l.key)}</div><h3>${esc(l.check.q)}</h3>
        <div class="opts">${order.map(k => `<button class="opt" data-k="${k}">${esc(l.check.o[k])}</button>`).join('')}</div><div class="quiz-fb"></div>`;
      $$('.opt', lc).forEach(b => b.onclick = () => {
        const ok = +b.dataset.k === l.check.a;
        $$('.opt', lc).forEach(x => { x.disabled = true; if (+x.dataset.k === l.check.a) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        completeLesson(l, ok);
        $('.quiz-fb', lc).innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><b>${ok ? '✔ ¡Bien!' : '✘ Repasa este punto.'}</b> Se programaron repasos espaciados a 1, 3, 7 y 21 días.</div>
          <div class="row"><button class="btn ghost" onclick="go('ruta')">Volver a la ruta</button><button class="btn primary" id="goNext">Siguiente recomendada →</button></div>`;
        $('#goNext').onclick = () => { const n = computeRoute().find(x => !x.done); go(n ? 'leccion/' + n.id : 'practica'); };
      });
    }
  };
  draw();
}
function completeLesson(l, ok) {
  const first = S.lessonsDone[l.id] == null;
  S.lessonsDone[l.id] = S.day;
  const m = S.mastery[l.comp];
  const target = l.level === 1 ? 75 : 95;
  touch(l.comp, ok ? m + Math.max(0, target - m) * 0.35 : m + 4, 4);
  if (!ok) S.qErrors['lesson:' + l.id] = (S.qErrors['lesson:' + l.id] || 0) + 1;
  scheduleReviews(l.comp, l.id);
  log('lección', `Completó "${l.title}" ${ok ? '(verificación correcta)' : '(verificación fallida)'}`);
  if (first) addXP(ok ? 60 : 30, 'Micro-lección');
  if (Object.keys(S.lessonsDone).length >= 5) badge('micro_5');
  save();
}

/* =========================================================
   VISTA: Módulo práctico (simulación de fallas en 3D)
   ========================================================= */
function viewPractice(el, id) {
  if (!S.tests.pre) { el.innerHTML = needPre(); return; }
  const sc = SCENARIOS.find(s => s.id === id);
  if (!sc) {
    el.innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Entregable 3</span><h1>Módulo práctico: simulación de fallas</h1>
      <p class="muted">Diagnóstico guiado paso a paso sobre un modelo 3D del autobús. Las decisiones inseguras se registran como violaciones críticas.</p></div>
      <div class="row"><button class="btn ghost" onclick="go('inspeccion')">Explorar modelo 3D</button><button class="btn primary" onclick="go('taller')">🔧 Taller virtual de reparación →</button></div></div>
      <div class="grid g-3">${SCENARIOS.map(s => {
        const lock = scenarioLocked(s), last = S.practice.filter(p => p.id === s.id).slice(-1)[0];
        return `<div class="card scen ${lock ? 'locked' : ''}">
          <span class="tag ${s.mode === 'ev' ? 'ev' : 'di'}">${s.mode === 'ev' ? '🔋 Eléctrico' : '⛽ Diésel'}</span> <span class="tag">${s.level}</span> <span class="tag">${s.min} min</span>
          <h3>${esc(s.title)}</h3><p class="muted">${esc(s.intro)}</p>
          <p class="small">Competencias: ${s.comps.map(c => comp(c).short).join(', ')}</p>
          ${last ? `<p class="small">Último intento: <b>${last.score}</b> ${last.violations.length ? '<span class="tag bad">violación</span>' : ''}</p>` : ''}
          ${lock ? `<div class="lockmsg">🔒 Requiere la micro-lección <b>${esc(LESSONS.find(l => l.id === s.requires.lesson).title)}</b> o dominio ≥ ${s.requires.mastery} en Seguridad AV.</div>
            <button class="btn" onclick="go('leccion/${s.requires.lesson}')">Ir a la lección</button>`
          : `<button class="btn primary" onclick="go('practica/${s.id}')">${last ? 'Reintentar' : 'Iniciar'} →</button>`}
        </div>`; }).join('')}</div>`;
    return;
  }
  if (scenarioLocked(sc)) return go('practica');

  el.innerHTML = `
    <div class="page-head"><div><a href="#/practica" class="back">← Escenarios</a><span class="eyebrow">${sc.mode === 'ev' ? '🔋 Autobús eléctrico' : '⛽ Autobús diésel'} · Simulación</span><h1>${esc(sc.title)}</h1></div></div>
    <div class="sim">
      <div class="card viewer">
        <canvas id="cv"></canvas>
        ${viewerTools()}
        <div class="pickinfo" id="pickinfo">Haz clic en un componente para ver su información</div>
      </div>
      <div class="card panel" id="panel"></div>
    </div>`;
  const scene = mountScene($('#cv'), sc.mode, k => { $('#pickinfo').innerHTML = `<b>${esc(COMPONENTS[k].name)}</b> — ${esc(COMPONENTS[k].desc)}`; });
  const st = { node: sc.start, attempts: 0, earned: 0, max: 0, errors: [], violations: [], steps: [], start: Date.now(), lookups: 0 };
  Object.values(sc.nodes).forEach(n => st.max += n.opts.find(o => o.ok).pts);
  const panel = $('#panel');

  const drawNode = () => {
    if (st.node === 'end') return finish();
    const n = sc.nodes[st.node];
    const keys = Object.keys(sc.nodes), idx = keys.indexOf(st.node);
    scene.highlight = n.focus; scene.selected = null; scene.focusOn(n.focus);
    const order = shuffle(n.opts.map((_, i) => i));
    panel.innerHTML = `
      ${idx === 0 ? `<div class="intro">📋 ${esc(sc.intro)}</div>` : ''}
      <div class="steps">${keys.map((k, i) => `<i class="${i < idx ? 'd' : i === idx ? 'c' : ''}"></i>`).join('')}</div>
      <span class="eyebrow">Paso ${idx + 1} de ${keys.length} · ${esc(n.title)}</span>
      <h3>${esc(n.text)}</h3>
      <div class="opts">${order.map(i => `<button class="opt" data-i="${i}">${esc(n.opts[i].t)}</button>`).join('')}</div>
      <div class="quiz-fb" id="fb"></div>
      <div class="jobaid"><button class="btn link" id="aid">📄 Consultar documentación (ayuda en el trabajo)</button><div id="aidtxt"></div></div>`;
    $('#aid').onclick = () => {
      const d = DOCS.find(x => x.id === COMPONENTS[n.focus]?.doc);
      st.lookups++; S.docLookups++;
      $('#aidtxt').innerHTML = d ? `<div class="docfrag"><b>${esc(d.title)}</b> <span class="muted">(${esc(d.id)})</span><p>${esc(d.text)}</p></div>` : '';
    };
    $$('.opt', panel).forEach(b => b.onclick = () => {
      const o = n.opts[+b.dataset.i];
      const fb = $('#fb');
      if (o.ok) {
        const got = st.attempts === 0 ? o.pts : st.attempts === 1 ? o.pts * 0.5 : 0;
        st.earned += got;
        st.steps.push({ title: n.title, attempts: st.attempts + 1, got, pts: o.pts });
        $$('.opt', panel).forEach(x => x.disabled = true);
        b.classList.add('right');
        fb.innerHTML = `<div class="fb ok"><b>✔</b> ${esc(o.fb)}</div><button class="btn primary" id="cont">Continuar →</button>`;
        $('#cont').onclick = () => { st.node = o.next; st.attempts = 0; drawNode(); };
      } else {
        st.attempts++;
        st.errors.push(o.tag);
        if (o.safety) st.violations.push(o.tag);
        b.disabled = true; b.classList.add('wrong');
        fb.innerHTML = `<div class="fb ${o.safety ? 'critical' : 'bad'}"><b>${o.safety ? '⚠ ' : '✘ '}</b>${esc(o.fb)}<br><small>Elige otra opción.</small></div>`;
        if (o.safety) { const v = $('.viewer'); v.classList.add('shake'); setTimeout(() => v.classList.remove('shake'), 600); }
      }
    });
  };

  const finish = () => {
    scene.highlight = null;
    let score = round(st.earned / st.max * 100);
    const crit = st.violations.length > 0;
    if (crit) score = Math.min(score, 59);
    const passed = score >= 70 && !crit;
    const secs = round((Date.now() - st.start) / 1000);
    S.practice.push({ id: sc.id, day: S.day, score, passed, violations: st.violations, errors: st.errors, secs, lookups: st.lookups });
    st.errors.forEach(t => S.errors[t] = (S.errors[t] || 0) + 1);
    sc.comps.forEach(c => { const m = S.mastery[c]; touch(c, m + (score - m) * 0.4 + (passed ? 5 : 0), passed ? 6 : 4); });
    if (sc.comps.includes('hv') || sc.mode === 'ev') sc.comps.forEach(c => scheduleReviews(c, sc.id));
    log('práctica', `${sc.title}: ${score}/100${crit ? ' · VIOLACIÓN DE SEGURIDAD' : ''}`);
    addXP(score * 1.2, 'Práctica');
    if (sc.id === 'ev_aislamiento' && !crit) badge('guardian_av');
    if (st.steps.every(s => s.attempts === 1)) badge('detective');
    save();
    panel.innerHTML = `
      <span class="eyebrow">Resultado · evaluación práctica por rúbrica</span>
      <div class="score ${passed ? 'pass' : 'fail'}"><b>${score}</b><span>${passed ? 'Aprobado' : crit ? 'No aprobado · violación crítica de seguridad' : 'No aprobado'}</span></div>
      <table class="tbl"><thead><tr><th>Paso</th><th>Intentos</th><th>Puntos</th></tr></thead><tbody>
        ${st.steps.map(s => `<tr><td>${s.attempts === 1 ? '✅' : '⚠️'} ${esc(s.title)}</td><td>${s.attempts}</td><td>${round(s.got)}/${s.pts}</td></tr>`).join('')}
      </tbody></table>
      <div class="rub">
        <div><span>Tiempo</span><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></div>
        <div><span>Errores</span><b>${st.errors.length}</b></div>
        <div><span>Violaciones</span><b class="${crit ? 'bad' : ''}">${st.violations.length}</b></div>
        <div><span>Consultas doc.</span><b>${st.lookups}</b></div>
      </div>
      ${st.errors.length ? `<p class="small"><b>Errores registrados:</b> ${[...new Set(st.errors)].map(t => `<span class="tag ${st.violations.includes(t) ? 'bad' : ''}">${esc(ERROR_LABELS[t] || t)}</span>`).join(' ')}</p>` : ''}
      <div class="row"><button class="btn ghost" onclick="go('practica')">Otros escenarios</button><button class="btn primary" onclick="go('practica/${sc.id}')">Reintentar</button></div>`;
  };
  drawNode();
}
function viewerTools() {
  return `<div class="vtools">
    <button class="vt on" data-a="xray" title="Rayos X">Rayos X</button>
    <button class="vt" data-a="vr" title="Vista estéreo para visor VR tipo cardboard">VR</button>
    <button class="vt" data-a="full" title="Pantalla completa">⛶</button>
    <button class="vt" data-a="in">＋</button><button class="vt" data-a="out">－</button>
  </div>`;
}
function mountScene(canvas, mode, onPick) {
  const scene = new E3D.Scene(canvas, { xray: true });
  const model = currentModel();
  if (model) applyModelToScene(scene, model, mode); else scene.setMeshes(E3D.buildBus(mode));
  scene.labels = Object.fromEntries(Object.entries(COMPONENTS).map(([k, v]) => [k, v.name]));
  scene.onPick = onPick;
  cleanup.push(() => scene.destroy());
  const wrap = canvas.parentElement;
  $$('.vt', wrap).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'xray') { scene.xray = !scene.xray; b.classList.toggle('on', scene.xray); }
    if (a === 'vr') { scene.stereo = !scene.stereo; b.classList.toggle('on', scene.stereo); if (scene.stereo) toast('Modo estéreo: coloca el teléfono en un visor tipo cardboard'); }
    if (a === 'full') { try { (document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen()); } catch (e) { toast('Pantalla completa no disponible aquí'); } }
    if (a === 'in') scene.zoom(0.85);
    if (a === 'out') scene.zoom(1.18);
  });
  return scene;
}

/* =========================================================
   VISTA: Inspección 3D libre
   ========================================================= */
function viewInspect(el) {
  const model = currentModel();
  let mode = model && model.power === 'diesel' ? 'diesel' : 'ev';
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Modelo 3D · realidad virtual ligera</span><h1>${model ? esc(model.name) : 'Inspección de componentes'}</h1>
      <p class="muted">Gira, acerca y toca cualquier componente. Activa VR para usarlo con un visor de teléfono.${model ? ` <a href="#/practicar/elegir">Cambiar autobús</a>` : ''}</p></div>
      <div class="seg" id="modeSeg"><button class="${mode === 'ev' ? 'on' : ''}" data-m="ev">🔋 ${model && model.power === 'hibrido' ? 'Tren eléctrico' : 'Eléctrico'}</button><button class="${mode === 'diesel' ? 'on' : ''}" data-m="diesel">⛽ ${model && model.power === 'hibrido' ? 'Motor diésel' : 'Diésel'}</button></div></div>
    <div class="sim">
      <div class="card viewer tall"><canvas id="cv"></canvas>${viewerTools()}</div>
      <div class="card panel"><div id="info"><h3>Selecciona un componente</h3><p class="muted">Toca una pieza en el modelo o en la lista: verás su función, especificaciones, fallas, seguridad, herramientas y las tareas de reparación que puedes practicar.</p></div>
        <h4>Componentes</h4><div class="chips" id="chips"></div></div>
    </div>`;
  let tab = 'info';
  const showInfo = (k, keepTab) => {
    const c = COMPONENTS[k]; if (!c) return;
    if (!keepTab) { scene.selected = k; scene.highlight = k; scene.focusOn(k); }
    current = k;
    const pi = PART_INFO[k] || {}, d = DOCS.find(x => x.id === c.doc), l = LESSONS.find(x => x.id === c.lesson);
    const tasks = partTasks(k);
    const tabs = [['info', 'Información'], ['fallas', 'Fallas'], ['seg', 'Seguridad'], ['tools', 'Herramientas'], ['tareas', `Tareas (${tasks.reduce((s, x) => s + x.steps.length, 0) + (PART_TASKS[k] || []).length})`]];
    let body = '';
    if (tab === 'info') body = `<p>${esc(pi.fn || c.desc)}</p>${pi.ubic ? `<p class="muted small">📍 ${esc(pi.ubic)}</p>` : ''}${pi.specs ? `<h4>Especificaciones</h4>${ul(pi.specs)}` : ''}
      ${d ? `<div class="docfrag"><b>📄 ${esc(d.title)}</b> <span class="muted">(${esc(d.id)})</span><p>${esc(d.text)}</p></div>` : ''}`;
    if (tab === 'fallas') body = `<h4>Fallas comunes</h4>${ul(pi.fallas || ['—'])}<h4>Síntomas</h4>${ul(pi.sintomas || ['—'])}`;
    if (tab === 'seg') body = `<div class="warnbox">⚠ ${esc(pi.seguridad || 'Sigue el procedimiento del manual de servicio.')}</div>${HV_PARTS.includes(k) ? '<p class="small">Componente de <b>alto voltaje</b>: requiere desenergización, LOTO y verificación de ausencia de tensión antes de intervenirlo.</p>' : ''}`;
    if (tab === 'tools') body = `<p class="muted small">Toca una herramienta para ver su ficha.</p><div class="toolgrid sm">${(pi.tools || []).map(t => `<button class="toolcard" data-tool="${t}"><span>${TOOLS[t].icon}</span><b>${esc(TOOLS[t].name)}</b><small>${esc(TOOLS[t].cat)}</small></button>`).join('')}</div>`;
    const quick = PART_TASKS[k] || [];
    if (tab === 'tareas') body = (quick.length ? `<h4>Inspección y mantenimiento</h4><ul class="qtasks">${quick.map(([t, x]) => `<li><button class="qt" data-tool="${t}" title="${esc(TOOLS[t].name)}">${TOOLS[t].icon}</button><span>${esc(x)}</span></li>`).join('')}</ul>` : '') + (tasks.length ? '<h4>Procedimientos de reparación</h4>' : '') + (tasks.length ? tasks.map(x => `<div class="taskgrp"><b>${esc(x.p.title)}</b><ol>${x.steps.map(s => `<li value="${s.n}">${s.tool ? TOOLS[s.tool].icon : '✋'} ${esc(s.title)} <span class="muted small">— ${esc(s.instr)}</span></li>`).join('')}</ol>${S.user ? `<button class="btn sm primary" onclick="go('taller/${x.p.id}')">Practicar en el taller →</button>` : ''}</div>`).join('') : '');
    $('#info').innerHTML = `<span class="eyebrow">${comp(c.comp).icon} ${esc(compName(c.comp))}${HV_PARTS.includes(k) ? ' · ⚡ AV' : ''}</span><h3>${esc(c.name)}</h3>
      <div class="tabs">${tabs.map(([t, n]) => `<button data-t="${t}" class="${t === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="tabbody">${body}</div>
      <div class="row">${S.user && l ? `<button class="btn sm" onclick="go('leccion/${l.id}')">📚 ${esc(l.title)}</button>` : ''}<button class="btn sm ghost" id="fullSheet">Ficha completa</button></div>`;
    $$('#info .tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; showInfo(k, true); });
    $$('#info .toolcard, #info .qt').forEach(b => b.onclick = () => openModal(toolSheet(b.dataset.tool)));
    $('#fullSheet').onclick = () => openModal(partSheet(k));
    $$('#chips button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  };
  let current = null;
  const scene = mountScene($('#cv'), mode, showInfo);
  const chips = () => {
    const ids = [...new Set(scene.meshes.filter(m => m.kind === 'part').map(m => m.id))];
    $('#chips').innerHTML = ids.map(k => `<button data-k="${k}">${esc(COMPONENTS[k].name)}</button>`).join('');
    $$('#chips button').forEach(b => b.onclick = () => showInfo(b.dataset.k));
  };
  chips();
  $$('#modeSeg button').forEach(b => b.onclick = () => {
    mode = b.dataset.m;
    $$('#modeSeg button').forEach(x => x.classList.toggle('on', x === b));
    if (model) applyModelToScene(scene, model, mode); else scene.setMeshes(E3D.buildBus(mode));
    scene.selected = scene.highlight = null; scene.target = [0, 1.5, 0];
    chips();
  });
}

/* =========================================================
   VISTA: Evaluaciones pre / post / diferida
   ========================================================= */
function buildTest() {
  const usage = {};
  ['pre', 'post', 'delayed'].forEach(k => (S.tests[k]?.answers || []).forEach(a => usage[a.id] = (usage[a.id] || 0) + 1));
  const qs = [];
  COMP_IDS.forEach(c => {
    const pool = shuffle(QUESTIONS.filter(q => q.c === c)).sort((a, b) => (usage[a.id] || 0) - (usage[b.id] || 0));
    qs.push(pool[0], pool[1]);
  });
  return qs;
}
function runTest(el, kind) {
  const qs = buildTest();
  const label = kind === 'post' ? 'Post-test inmediato' : 'Revisión diferida';
  el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Entregable 4</span><h1>${label}</h1><p class="muted">14 preguntas · formas paralelas (se priorizan preguntas que no has visto).</p></div></div><div id="qz"></div>`;
  runQuiz($('#qz'), {
    total: qs.length, label, next: res => qs[res.length] || null,
    onDone: res => {
      const scores = {};
      COMP_IDS.forEach(c => {
        const r = res.filter(x => x.q.c === c);
        scores[c] = round(r.filter(x => x.correct).length / r.length * 100);
        const m = S.mastery[c];
        touch(c, m * 0.4 + scores[c] * 0.6, S.stability[c]);
      });
      const a = round(avg(Object.values(scores)));
      S.tests[kind] = { day: S.day, scores, avg: a, answers: res.map(r => ({ id: r.q.id, ok: r.correct })) };
      log('evaluación', `${label}: ${a}/100`);
      addXP(80, label);
      if (kind === 'post') { const g = gain(); if (g != null && g >= 0.5) badge('mejora'); }
      if (kind === 'delayed' && retention() >= 80) badge('memoria');
      save(); go('evaluaciones');
    },
  });
}
function gain() {
  const { pre, post } = S.tests;
  if (!pre || !post) return null;
  if (pre.avg >= 100) return 0;
  return (post.avg - pre.avg) / (100 - pre.avg);
}
function retention() {
  const { post, delayed } = S.tests;
  if (!post || !delayed || !post.avg) return null;
  return round(delayed.avg / post.avg * 100);
}
function viewEvals(el, param) {
  if (!S.tests.pre) { el.innerHTML = needPre(); return; }
  if (param === 'post' || param === 'delayed') return runTest(el, param);
  const { pre, post, delayed } = S.tests;
  const trained = Object.keys(S.lessonsDone).length + S.practice.length;
  const daysLeft = post ? Math.max(0, post.day + 7 - S.day) : null;
  const g = gain(), ret = retention();
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Entregable 4</span><h1>Evaluación antes · después · diferida</h1>
      <p class="muted">La retención del 100% no es realista: medimos indicadores verificables de desempeño, recurrencia de errores y retención.</p></div></div>
    <div class="grid g-3">
      <div class="card ev-card done"><span class="eyebrow">1 · Pre-test</span><h2>${pre.avg}</h2><p class="muted">Diagnóstico inicial · día ${pre.day}</p><span class="tag ok">Completado</span></div>
      <div class="card ev-card ${post ? 'done' : ''}"><span class="eyebrow">2 · Post-test inmediato</span><h2>${post ? post.avg : '—'}</h2>
        <p class="muted">${post ? `Día ${post.day}` : trained ? '¿Aprendiste? Mídelo ahora.' : 'Completa al menos una lección o práctica.'}</p>
        ${post ? '<span class="tag ok">Completado</span>' : `<button class="btn primary" ${trained ? '' : 'disabled'} onclick="go('evaluaciones/post')">Iniciar post-test</button>`}</div>
      <div class="card ev-card ${delayed ? 'done' : ''}"><span class="eyebrow">3 · Revisión diferida</span><h2>${delayed ? delayed.avg : '—'}</h2>
        <p class="muted">${delayed ? `Día ${delayed.day} (${delayed.day - post.day} días después)` : !post ? 'Disponible tras el post-test.' : daysLeft > 0 ? `Disponible en ${daysLeft} día(s) simulados.` : '¿Lo retienes? Mídelo ahora.'}</p>
        ${delayed ? '<span class="tag ok">Completado</span>' : post ? (daysLeft > 0 ? `<button class="btn" onclick="advanceDays(${daysLeft})">⏩ Simular ${daysLeft} días</button>` : `<button class="btn primary" onclick="go('evaluaciones/delayed')">Iniciar revisión diferida</button>`) : ''}</div>
    </div>
    <div class="grid g-2-1">
      <div class="card"><h3>Resultados por competencia</h3>
        ${Charts.bars({ groups: COMPETENCIAS.map(c => c.short), series: [
          { name: 'Pre', values: COMP_IDS.map(c => pre.scores[c]), color: C.pre },
          ...(post ? [{ name: 'Post', values: COMP_IDS.map(c => post.scores[c]), color: C.post }] : []),
          ...(delayed ? [{ name: 'Diferida', values: COMP_IDS.map(c => delayed.scores[c]), color: C.delayed }] : [])] })}</div>
      <div class="card metrics">
        <h3>Indicadores verificables</h3>
        <div class="metric"><span>Ganancia normalizada (Hake)</span><b>${g == null ? '—' : g.toFixed(2)}</b><small>(post − pre) / (100 − pre). ≥ 0.3 media, ≥ 0.7 alta.</small></div>
        <div class="metric"><span>Retención</span><b>${ret == null ? '—' : ret + '%'}</b><small>diferida / post × 100</small></div>
        <div class="metric"><span>Errores recurrentes</span><b>${recurrentErrors().length}</b><small>Mismo error ≥ 2 veces</small></div>
        <div class="metric"><span>Prácticas aprobadas</span><b>${[...S.practice, ...(S.procs || [])].filter(p => p.passed).length}/${S.practice.length + (S.procs || []).length}</b><small>Simulaciones y procedimientos: rúbrica ≥ 70 y sin violaciones</small></div>
      </div>
    </div>`;
}
function recurrentErrors() {
  const out = [];
  Object.entries(S.errors).forEach(([t, n]) => { if (n >= 2) out.push({ label: ERROR_LABELS[t] || t, n, kind: 'práctica' }); });
  Object.entries(S.qErrors).forEach(([id, n]) => {
    if (n < 2) return;
    const q = QUESTIONS.find(x => x.id === id);
    out.push({ label: q ? `${comp(q.c).short}: ${q.q.slice(0, 60)}…` : id, n, kind: 'conocimiento' });
  });
  return out.sort((a, b) => b.n - a.n);
}

/* =========================================================
   VISTA: Repasos espaciados
   ========================================================= */
function viewReviews(el, param) {
  if (!S.tests.pre) { el.innerHTML = needPre(); return; }
  const due = dueReviews();
  if (param === 'go' && due.length) {
    const comps = [...new Set(due.map(r => r.c))];
    const qs = comps.flatMap(c => shuffle(QUESTIONS.filter(q => q.c === c)).slice(0, 2));
    el.innerHTML = `<div class="page-head"><div><span class="eyebrow">Repetición espaciada</span><h1>Repaso de hoy</h1><p class="muted">${qs.length} preguntas rápidas de ${comps.map(c => comp(c).short).join(', ')}</p></div></div><div id="qz"></div>`;
    runQuiz($('#qz'), {
      total: qs.length, label: 'Repaso', next: res => qs[res.length] || null,
      onDone: res => {
        comps.forEach(c => {
          const r = res.filter(x => x.q.c === c), ok = r.every(x => x.correct);
          due.filter(d => d.c === c).forEach(d => { d.done = true; d.ok = ok; d.doneDay = S.day; });
          if (ok) { S.stability[c] = Math.min(60, (S.stability[c] || 4) * 2.2); touch(c, S.mastery[c] + 3, S.stability[c]); }
          else { S.stability[c] = Math.max(2, (S.stability[c] || 4) * 0.8); touch(c, S.mastery[c] - 3, 2); S.reviews.push({ id: uid(), c, due: S.day + 1, done: false, from: 'reintento', interval: 1 }); }
        });
        log('repaso', `Repaso espaciado: ${res.filter(r => r.correct).length}/${res.length}`);
        addXP(res.filter(r => r.correct).length * 10, 'Repaso');
        if (S.reviews.filter(r => r.done).length >= 5) badge('constante');
        save(); go('repasos');
      },
    });
    return;
  }
  const up = upcomingReviews();
  const done = S.reviews.filter(r => r.done).sort((a, b) => b.doneDay - a.doneDay);
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Repetición espaciada · 1, 3, 7, 21 días</span><h1>Repasos</h1>
      <p class="muted">Cada lección y práctica programa repasos breves. Acertar duplica la estabilidad de la memoria; fallar reprograma para mañana.</p></div>
      <div class="row"><button class="btn ghost" onclick="advanceDays(1)">+1 día</button><button class="btn ghost" onclick="advanceDays(7)">+7 días</button></div></div>
    <div class="grid g-2-1">
      <div>
        <div class="card next">${due.length ? `<span class="eyebrow">Para hoy (día ${S.day})</span><h2>${due.length} repaso(s) pendiente(s)</h2><p>${[...new Set(due.map(r => compName(r.c)))].join(' · ')}</p><button class="btn primary" onclick="go('repasos/go')">Hacer repaso (≈2 min) →</button>`
          : `<h2>Nada pendiente hoy 🎉</h2><p class="muted">${up.length ? `Próximo repaso en el día ${up[0].due}.` : 'Completa lecciones para programar repasos.'}</p>`}</div>
        <div class="card"><h3>Curva de olvido proyectada (dominio promedio)</h3>${forgettingChart()}</div>
      </div>
      <div class="card"><h3>Calendario</h3>
        <ul class="cal">${up.slice(0, 12).map(r => `<li><span class="d">Día ${r.due}</span>${comp(r.c).icon} ${esc(compName(r.c))}<small>+${r.interval} d</small></li>`).join('') || '<li class="muted">Sin repasos programados</li>'}</ul>
        ${done.length ? `<h4>Completados</h4><ul class="cal">${done.slice(0, 8).map(r => `<li><span class="d">Día ${r.doneDay}</span>${r.ok ? '✅' : '🔁'} ${esc(compName(r.c))}</li>`).join('')}</ul>` : ''}</div>
    </div>`;
}
function forgettingChart() {
  const days = 30, xs = [...Array(days + 1)].map((_, i) => 'd' + (S.day + i));
  const noReview = xs.map((_, i) => round(avg(COMP_IDS.map(c => effMastery(c, S.day + i)))));
  // con repasos: asume que el técnico sigue el calendario 1-3-7-21 (cada repaso refuerza y duplica la estabilidad)
  const withRev = xs.map((_, i) => {
    const day = S.day + i;
    return round(avg(COMP_IDS.map(c => {
      if (S.lastPractice[c] == null) return effMastery(c, day);
      const pend = S.reviews.filter(r => !r.done && r.c === c).map(r => r.due);
      const sched = [...new Set([...pend, ...SR_INTERVALS.map(o => S.day + o)])].sort((a, b) => a - b);
      let last = S.lastPractice[c], stab = S.stability[c] || 4;
      sched.filter(d => d <= day).forEach(d => { last = d; stab = Math.min(90, stab * 2.2); });
      return round(S.mastery[c] * (0.4 + 0.6 * Math.exp(-(day - last) / stab)));
    })));
  });
  return Charts.line({ xs, xLabel: 'Días simulados', series: [
    { name: 'Con repasos espaciados', values: withRev, color: C.delayed },
    { name: 'Sin repasos', values: noReview, color: C.pre, dash: true }] });
}

/* =========================================================
   VISTA: Asistente con fuentes controladas (RAG local)
   ========================================================= */
const STOP = new Set('el la los las un una unos unas de del al a en y o u que por para con sin se su sus es son como cual cuales que qué cómo debo hacer hago puedo esta este esto estos estas lo le les mi me te tu yo hay ser si no mas muy cuando donde entre sobre tiene tienen autobus autobuses vehiculo sistema debe cual cuanto sirve funciona significa hace explica dime'.split(' '));
const SYN = { voltaje: ['av'], tension: ['tension'], alta: ['av'], electrocucion: ['av', 'riesgo'], multimetro: ['multimetro'], urea: ['adblue', 'def'], humo: ['humo'], ohms: ['ohm'], ohmios: ['ohm'], desenergizo: ['msd', 'loto'], desenergizar: ['msd', 'loto'], desconecto: ['msd'] };
const tok = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/)
  .filter(w => w && !STOP.has(w) && (w.length > 2 || /\d/.test(w) || ['av', 'dc'].includes(w)))
  .flatMap(w => [(w.length > 4 ? w.replace(/(es|s)$/, '') : w).slice(0, 8), ...(SYN[w] || [])]);
const INDEX = (() => {
  const docs = DOCS.map(d => ({ d, t: tok(d.title + ' ' + d.text) }));
  const df = {};
  docs.forEach(x => new Set(x.t).forEach(w => df[w] = (df[w] || 0) + 1));
  const N = docs.length, avgLen = avg(docs.map(x => x.t.length));
  return { docs, idf: w => Math.log(1 + (N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5)), avgLen };
})();
function retrieve(query) {
  const q = [...new Set(tok(query))];
  return INDEX.docs.map(x => {
    let s = 0, hit = 0;
    q.forEach(w => {
      const f = x.t.filter(t => t === w).length;
      if (f) { hit++; s += INDEX.idf(w) * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * x.t.length / INDEX.avgLen)); }
    });
    return { doc: x.d, score: s, cover: q.length ? hit / q.length : 0 };
  }).filter(r => r.score > 1.6 && r.cover > 0.5).sort((a, b) => b.score - a.score).slice(0, 2);
}
let chat = [];
function viewAssistant(el) {
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">IA generativa con fuentes controladas</span><h1>Asistente técnico</h1>
      <p class="muted">Responde <b>solo</b> con fragmentos de documentación autorizada y siempre cita la fuente. Si no hay fuente, no inventa: escala al especialista. Funciona sin conexión (índice local).</p></div></div>
    <div class="grid g-2-1">
      <div class="card chat">
        <div class="msgs" id="msgs"></div>
        <form id="ask" class="ask"><input id="q" placeholder="Ej. ¿Cómo verifico ausencia de tensión?" autocomplete="off"><button class="btn primary">Preguntar</button></form>
        <div class="chips sugg">${['¿Cómo desenergizo el sistema de alto voltaje?', '¿Qué resistencia debe tener la red CAN?', 'Baja presión del turbo, ¿qué reviso?', '¿Qué hago si se interrumpe la actualización de una ECU?', '¿Cuál es el torque de las ruedas?'].map(s => `<button type="button">${esc(s)}</button>`).join('')}</div>
      </div>
      <div class="card"><h3>Biblioteca autorizada</h3><p class="muted small">${DOCS.length} fragmentos indexados · versión 2026.11 · validados por especialista</p>
        <ul class="doclist">${DOCS.map(d => `<li><b>${esc(d.id)}</b> ${esc(d.title)}</li>`).join('')}</ul></div>
    </div>`;
  const msgs = $('#msgs');
  const drawChat = () => {
    msgs.innerHTML = chat.length ? chat.map(m => `<div class="msg ${m.who}">${m.html}</div>`).join('') : '<div class="muted center">Haz una pregunta técnica. Prueba también una que no esté en la documentación.</div>';
    msgs.scrollTop = msgs.scrollHeight;
  };
  const ask = q => {
    if (!q.trim()) return;
    chat.push({ who: 'me', html: esc(q) });
    const hits = retrieve(q);
    if (!hits.length) {
      chat.push({ who: 'bot', html: `<b>No encontré esta información en la documentación autorizada.</b><br>Para evitar una respuesta no confiable, no voy a suponerla. Consulta a tu supervisor o especialista. <span class="tag warn">Registrado como brecha de contenido</span>` });
      S.unanswered.push({ q, day: S.day }); log('asistente', `Pregunta sin fuente: "${q}"`);
    } else {
      const [a, b] = hits;
      chat.push({ who: 'bot', html: `<p>${esc(a.doc.text)}</p><div class="cite">📄 Fuente: <b>${esc(a.doc.title)}</b> · ${esc(a.doc.id)} · relevancia ${a.score.toFixed(1)}</div>${b ? `<div class="cite sec">También relevante: ${esc(b.doc.title)} (${esc(b.doc.id)})</div>` : ''}` });
      S.docLookups++;
    }
    save(); drawChat();
  };
  $('#ask').onsubmit = e => { e.preventDefault(); ask($('#q').value); $('#q').value = ''; };
  $$('.sugg button').forEach(b => b.onclick = () => ask(b.textContent));
  drawChat();
}

/* =========================================================
   VISTA: Tablero de indicadores
   ========================================================= */
function viewDashboard(el, tab = 'tecnico') {
  if (!S.tests.pre) { el.innerHTML = needPre(); return; }
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Entregable 5</span><h1>Tablero de indicadores</h1></div>
      <div class="seg"><button class="${tab === 'tecnico' ? 'on' : ''}" onclick="go('tablero/tecnico')">👷 Técnico</button><button class="${tab === 'supervisor' ? 'on' : ''}" onclick="go('tablero/supervisor')">📋 Equipo</button><button class="${tab === 'errores' ? 'on' : ''}" onclick="go('tablero/errores')">❌ Errores comunes</button></div></div>
    <div id="dash"></div>`;
  if (tab === 'supervisor') dashSupervisor($('#dash'));
  else if (tab === 'errores') dashErrors($('#dash'));
  else dashTech($('#dash'));
}
function dashTech(el) {
  const { pre, post, delayed } = S.tests;
  const eff = effAll(), g = gain(), ret = retention();
  const rec = recurrentErrors();
  const viol = [...S.practice, ...(S.procs || [])].reduce((s, p) => s + p.violations.length, 0);
  const prog = round(Object.keys(S.lessonsDone).length / LESSONS.length * 100);
  el.innerHTML = `
    <div class="kpis">
      ${kpi('Avance de ruta', prog + '%', `${Object.keys(S.lessonsDone).length}/${LESSONS.length} lecciones`)}
      ${kpi('Dominio actual', round(avg(eff)), `Pre: ${pre.avg}`)}
      ${kpi('Ganancia normalizada', g == null ? '—' : g.toFixed(2), post ? `Post: ${post.avg}` : 'Falta post-test')}
      ${kpi('Retención', ret == null ? '—' : ret + '%', delayed ? `Diferida: ${delayed.avg}` : 'Falta diferida')}
      ${kpi('Errores recurrentes', rec.length, `${Object.values(S.errors).reduce((a, b) => a + b, 0)} errores en práctica`, rec.length ? 'warn' : '')}
      ${kpi('Violaciones seguridad', viol, `${S.practice.length + (S.procs || []).length} prácticas`, viol ? 'bad' : 'ok')}
      ${kpi('Procedimientos', `${(S.procs || []).filter(p => p.passed).length}/${(S.procs || []).length}`, 'aprobados en taller')}
    </div>
    <div class="grid g-1-1">
      <div class="card"><h3>Mapa de competencias</h3>${Charts.radar({ size: 270, labels: COMPETENCIAS.map(c => c.short), series: [
        { name: 'Diagnóstico', values: COMP_IDS.map(c => pre.scores[c]), color: C.pre, dash: true },
        { name: 'Actual', values: eff, color: C.now }] })}</div>
      <div class="card"><h3>Dominio por competencia</h3>
        <table class="tbl"><tbody>${COMPETENCIAS.map((c, i) => { const lv = levelLabel(eff[i]); return `<tr><td>${c.icon} ${esc(c.short)}</td><td style="width:45%"><div class="meter"><i class="${lv.cls}" style="width:${eff[i]}%"></i></div></td><td><b>${eff[i]}</b></td><td><span class="lvl ${lv.cls}">${lv.t}</span></td></tr>`; }).join('')}</tbody></table></div>
    </div>
    <div class="grid g-2-1">
      <div class="card"><h3>Pre · post · diferida</h3>${Charts.bars({ groups: COMPETENCIAS.map(c => c.short), series: [
        { name: 'Pre', values: COMP_IDS.map(c => pre.scores[c]), color: C.pre },
        ...(post ? [{ name: 'Post', values: COMP_IDS.map(c => post.scores[c]), color: C.post }] : []),
        ...(delayed ? [{ name: 'Diferida', values: COMP_IDS.map(c => delayed.scores[c]), color: C.delayed }] : [])] })}</div>
      <div class="card"><h3>Errores recurrentes</h3>${rec.length ? `<ul class="errs">${rec.slice(0, 8).map(e => `<li><span class="n">${e.n}×</span>${esc(e.label)}<small>${e.kind}</small></li>`).join('')}</ul>` : '<p class="muted">Sin errores recurrentes. 👍</p>'}
        <h4>Insignias</h4><div class="badges">${Object.entries(BADGES).map(([k, b]) => `<div class="bdg ${S.badges.includes(k) ? 'got' : ''}" title="${esc(b.desc)}"><span>${b.icon}</span><small>${esc(b.name)}</small></div>`).join('')}</div></div>
    </div>
    <div class="grid g-2-1">
      <div class="card"><h3>Curva de olvido proyectada</h3>${forgettingChart()}</div>
      <div class="card"><h3>Historial (trazabilidad)</h3>
        <ul class="timeline">${S.log.slice().reverse().slice(0, 25).map(l => `<li><span class="d">Día ${l.day}</span><span class="tag">${esc(l.type)}</span> ${esc(l.text)}</li>`).join('')}</ul>
        <button class="btn ghost" id="exp">⬇ Exportar historial (xAPI JSON)</button></div>
    </div>`;
  $('#exp').onclick = () => {
    const actor = { name: S.user.name, role: ROLES[S.user.role].name };
    const statements = S.log.map(l => ({ actor, verb: l.type, object: l.text, context: { simulatedDay: l.day }, timestamp: new Date(l.ts).toISOString() }));
    download(`historial_${S.user.name.replace(/\s+/g, '_')}.json`, JSON.stringify({ actor, tests: S.tests, mastery: S.mastery, practice: S.practice, statements }, null, 2), 'application/json');
  };
}
function kpi(label, val, sub, cls = '') { return `<div class="card kpi ${cls}"><span>${esc(label)}</span><b>${val}</b><small>${esc(sub)}</small></div>`; }
function teamData() {
  const t = TEAM_SEED.map(x => ({ ...x, me: false }));
  if (S.user && S.tests.pre) {
    const errs = Object.keys(S.errors);
    // tus errores reales se suman al análisis del equipo
    const errCounts = {};
    ERROR_CATALOG.forEach(e => { const n = e.tags.reduce((s, tg) => s + (S.errors[tg] || 0), 0); if (n) errCounts[e.id] = n; });
    const answers = {};
    ['pre', 'post', 'delayed'].forEach(k => (S.tests[k]?.answers || []).forEach(a => { answers[a.id] = a.ok ? 0 : -1; }));
    t.unshift({ name: S.user.name + ' (tú)', role: S.user.role, taller: S.user.taller || TALLERES[1], xp: S.xp, pre: S.tests.pre.avg, post: S.tests.post?.avg ?? null, delayed: S.tests.delayed?.avg ?? null,
      viol: [...S.practice, ...(S.procs || [])].reduce((s, p) => s + p.violations.length, 0), m: Object.fromEntries(COMP_IDS.map(c => [c, effMastery(c)])), errs, errCounts, answers, stepErr: {}, me: true });
  }
  return t;
}
let teamFilter = { taller: '', role: '', cat: '', sel: null, proc: 'bujias', all: false };
const filterTeam = t => t.filter(x => (!teamFilter.taller || x.taller === teamFilter.taller) && (!teamFilter.role || x.role === teamFilter.role));
function teamFiltersHTML(withCat) {
  return `<div class="card filters">
    <label>Taller<select id="fTaller"><option value="">Todos los talleres</option>${TALLERES.map(t => `<option ${teamFilter.taller === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <label>Rol<select id="fRole"><option value="">Todos los roles</option>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${teamFilter.role === k ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
    ${withCat ? `<div class="catchips">${['', ...ERROR_CATS].map(c => `<button data-c="${c}" class="${teamFilter.cat === c ? 'on' : ''}">${c ? CAT_ICON[c] + ' ' + c : 'Todas'}</button>`).join('')}</div>` : ''}
    <span class="muted small fnote">Datos simulados de ${TEAM_SEED.length} técnicos + tus resultados</span>
  </div>`;
}
function bindTeamFilters(el, redraw) {
  $('#fTaller', el).onchange = e => { teamFilter.taller = e.target.value; teamFilter.sel = null; redraw(); };
  $('#fRole', el).onchange = e => { teamFilter.role = e.target.value; teamFilter.sel = null; redraw(); };
  $$('.catchips button', el).forEach(b => b.onclick = () => { teamFilter.cat = b.dataset.c; teamFilter.sel = null; redraw(); });
}
const CAT_ICON = { Seguridad: '⚠️', Procedimiento: '🔧', 'Diagnóstico': '🔍', 'Identificación': '👆', Conocimiento: '📝' };
const CAT_CLS = { Seguridad: 'bad', Procedimiento: 'warn', 'Diagnóstico': 'info', 'Identificación': 'ev', Conocimiento: '' };

/* ---------- Análisis: ¿en qué se equivoca más la gente? ---------- */
function teamErrorStats(team) {
  const n = team.length || 1;
  const rows = ERROR_CATALOG.map(e => {
    const who = team.filter(t => (t.errCounts || {})[e.id]);
    const times = who.reduce((s, t) => s + t.errCounts[e.id], 0);
    const rec = who.filter(t => t.errCounts[e.id] >= 2).length;
    const byTaller = TALLERES.map(tl => { const g = team.filter(t => t.taller === tl); return { tl, pct: g.length ? round(g.filter(t => (t.errCounts || {})[e.id]).length / g.length * 100) : null }; });
    const byRole = Object.keys(ROLES).map(r => { const g = team.filter(t => t.role === r); return { r, pct: g.length ? round(g.filter(t => (t.errCounts || {})[e.id]).length / g.length * 100) : null }; });
    return { ...e, who: who.length, pct: round(who.length / n * 100), times, avgTimes: who.length ? (times / who.length).toFixed(1) : '0', recPct: who.length ? round(rec / who.length * 100) : 0, byTaller, byRole, me: team.some(t => t.me && (t.errCounts || {})[e.id]) };
  }).sort((a, b) => b.pct - a.pct || b.times - a.times);
  const questions = QUESTIONS.map(q => {
    const ans = team.map(t => (t.answers || {})[q.id]).filter(v => v !== undefined);
    const wrong = ans.filter(v => v !== 0);
    const opts = [1, 2, 3].map(k => wrong.filter(v => v === k).length);
    const top = opts.indexOf(Math.max(...opts)) + 1;
    return { q, pct: ans.length ? round(wrong.length / ans.length * 100) : 0, n: ans.length, topWrong: q.o[top], topWrongPct: wrong.length ? round(Math.max(...opts) / wrong.length * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);
  const procs = TEAM_PROCESSES.map(p => {
    const names = p.steps();
    const g = team.filter(t => t.stepErr && t.stepErr[p.id]);
    const steps = names.map((nm, k) => ({ nm, pct: g.length ? round(g.filter(t => t.stepErr[p.id][k]).length / g.length * 100) : 0 }));
    return { ...p, steps };
  });
  return { rows, questions, procs };
}
function dashErrors(el) {
  const draw = () => {
    const team = filterTeam(teamData());
    const { rows, questions, procs } = teamErrorStats(team);
    const shown = rows.filter(r => !teamFilter.cat || r.cat === teamFilter.cat);
    const sel = rows.find(r => r.id === teamFilter.sel) || shown[0] || rows[0];
    const n = team.length;
    const withViol = team.filter(t => ERROR_CATALOG.some(e => e.safety && (t.errCounts || {})[e.id])).length;
    const topSafety = rows.find(r => r.safety);
    const topId = rows.find(r => r.cat === 'Identificación');
    const topQ = questions[0];
    const worstTaller = topSafety ? [...topSafety.byTaller].filter(x => x.pct != null).sort((a, b) => b.pct - a.pct)[0] : null;
    const totalErr = team.reduce((s, t) => s + Object.values(t.errCounts || {}).reduce((a, b) => a + b, 0), 0);
    const proc = procs.find(p => p.id === teamFilter.proc) || procs[0];
    const maxStep = Math.max(...proc.steps.map(s => s.pct));
    const bar = (pct, cls = '') => `<div class="ebar"><i class="${cls}" style="width:${Math.max(2, pct)}%"></i></div>`;
    el.innerHTML = `
      ${teamFiltersHTML(true)}
      <div class="kpis">
        ${kpi('Técnicos analizados', n, teamFilter.taller || 'todos los talleres')}
        ${kpi('Errores registrados', totalErr, `${(totalErr / (n || 1)).toFixed(1)} por técnico`)}
        ${kpi('Error más común', (rows[0]?.pct ?? 0) + '%', 'de los técnicos lo cometió', 'warn')}
        ${kpi('Con violación de seguridad', round(withViol / (n || 1) * 100) + '%', `${withViol} técnicos`, withViol ? 'bad' : 'ok')}
      </div>
      <div class="card insights"><h3>💡 Lo que dicen los datos</h3><ul>
        ${rows[0] ? `<li><b>El error más frecuente</b> es «${esc(rows[0].label)}»: lo cometió el <b>${rows[0].pct}%</b> de los técnicos, y el ${rows[0].recPct}% de ellos lo repitió.</li>` : ''}
        ${topSafety && topSafety.pct ? `<li class="bad"><b>La falla de seguridad más común</b> es «${esc(topSafety.label)}» (<b>${topSafety.pct}%</b>)${worstTaller && !teamFilter.taller ? `, sobre todo en <b>${esc(worstTaller.tl)}</b> (${worstTaller.pct}%)` : ''}.</li>` : ''}
        ${topId && topId.pct ? `<li><b>La pieza que más se confunde:</b> buscaban «${esc(topId.pair[0])}» y tocaron «${esc(topId.pair[1])}» (<b>${topId.pct}%</b>).</li>` : ''}
        ${topQ ? `<li><b>La pregunta más fallada</b> (${topQ.pct}%): «${esc(topQ.q.q)}». La respuesta equivocada más elegida fue «${esc(topQ.topWrong)}».</li>` : ''}
        ${rows[0] ? `<li class="act">🎯 <b>Acción sugerida:</b> ${esc(rows[0].action.text)}.</li>` : ''}
      </ul></div>
      <div class="grid g-2-1">
        <div class="card"><h3>¿En qué se equivoca más la gente?</h3><p class="muted small">% de técnicos que cometieron el error al menos una vez. Toca uno para ver el detalle.</p>
          <ol class="erank">${shown.map((r, i) => `<li data-id="${r.id}" class="${r.id === sel.id ? 'on' : ''}">
            <span class="er-n">${i + 1}</span>
            <div class="er-main"><div class="er-top"><b>${esc(r.label)}</b>${r.me ? '<span class="tag info">también tú</span>' : ''}</div>
              <div class="er-bar">${bar(r.pct, r.safety ? 'bad' : '')}<span>${r.pct}%</span></div>
              <small><span class="tag ${CAT_CLS[r.cat]}">${CAT_ICON[r.cat]} ${r.cat}</span> ${r.who} técnicos · ${r.times} veces</small></div>
          </li>`).join('')}</ol></div>
        <div class="card errdetail">${sel ? `
          <span class="tag ${CAT_CLS[sel.cat]}">${CAT_ICON[sel.cat]} ${sel.cat}</span>
          <h3>${esc(sel.label)}</h3>
          <div class="ed-big"><b>${sel.pct}%</b><span>de los técnicos<br>(${sel.who} de ${n})</span></div>
          <div class="ed-stats"><div><span>Veces en promedio</span><b>${sel.avgTimes}</b></div><div><span>Lo repitieron</span><b>${sel.recPct}%</b></div><div><span>Competencia</span><b>${comp(sel.comp).icon} ${esc(comp(sel.comp).short)}</b></div></div>
          <p class="small"><b>📍 Dónde ocurre:</b> ${esc(sel.where)}</p>
          ${sel.pair ? `<p class="small"><b>👆 Confusión:</b> buscaban «${esc(sel.pair[0])}» → tocaron «${esc(sel.pair[1])}»</p>` : ''}
          <h4>Por taller</h4>${sel.byTaller.filter(x => x.pct != null).map(x => `<div class="mini"><span>${esc(x.tl.split(' · ')[0])}</span>${bar(x.pct, sel.safety ? 'bad' : '')}<b>${x.pct}%</b></div>`).join('')}
          <h4>Por rol</h4>${sel.byRole.filter(x => x.pct != null).map(x => `<div class="mini"><span>${esc(ROLES[x.r].name.replace('Técnico de ', '').replace('Técnico ', ''))}</span>${bar(x.pct)}<b>${x.pct}%</b></div>`).join('')}
          <div class="actionbox">🎯 <b>Acción sugerida:</b> ${esc(sel.action.text)}<button class="btn sm primary" onclick="go('${sel.action.route}')">Ir →</button></div>` : '<p class="muted">Sin datos con estos filtros.</p>'}
        </div>
      </div>
      <div class="grid g-1-1">
        <div class="card"><h3>👆 Piezas que más se confunden</h3><p class="muted small">En «Señala la pieza»: qué buscaban y qué tocaron por error.</p>
          ${rows.filter(r => r.pair).map(r => `<div class="pairrow"><div><span class="pr-a">${esc(r.pair[0])}</span><span class="pr-arrow">→ tocaron</span><span class="pr-b">${esc(r.pair[1])}</span></div><div class="er-bar">${bar(r.pct)}<span>${r.pct}%</span></div></div>`).join('')}</div>
        <div class="card"><h3>📝 Preguntas más falladas</h3><p class="muted small">Diagnóstico, post-test y revisión diferida.</p>
          <ol class="qfail">${questions.slice(0, 6).map(x => `<li><div class="qf-top"><span class="tag">${comp(x.q.c).icon} ${esc(comp(x.q.c).short)}</span><b>${x.pct}% falla</b></div>
            <p>${esc(x.q.q)}</p><small>✔ Correcta: «${esc(x.q.o[x.q.a])}» · ✘ Más elegida por error: «${esc(x.topWrong)}» (${x.topWrongPct}% de los que fallaron)</small></li>`).join('')}</ol></div>
      </div>
      <div class="card"><h3>📉 Paso más difícil de cada proceso</h3><p class="muted small">% de técnicos que se equivocaron en cada paso.</p>
        <div class="catchips proc">${procs.map(p => `<button data-p="${p.id}" class="${p.id === proc.id ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>
        <div class="steprates">${proc.steps.map((s, k) => `<div class="sr ${s.pct === maxStep && maxStep > 0 ? 'max' : ''}"><span class="sr-n">${k + 1}</span><span class="sr-t">${esc(s.nm)}</span>${bar(s.pct, s.pct === maxStep ? 'bad' : '')}<b>${s.pct}%</b></div>`).join('')}</div></div>
      <div class="card"><h3>🏭 Errores por taller</h3><p class="muted small">% de técnicos de cada taller con al menos un error de cada tipo.</p>
        <div class="tscroll"><table class="tbl heat errheat"><thead><tr><th>Taller</th>${ERROR_CATS.map(c => `<th>${CAT_ICON[c]} ${c}</th>`).join('')}<th>Técnicos</th></tr></thead><tbody>
        ${TALLERES.map(tl => { const g = teamData().filter(t => t.taller === tl && (!teamFilter.role || t.role === teamFilter.role)); return `<tr><td><b>${esc(tl)}</b></td>${ERROR_CATS.map(c => { const v = g.length ? round(g.filter(t => ERROR_CATALOG.some(e => e.cat === c && (t.errCounts || {})[e.id])).length / g.length * 100) : 0; return `<td class="hc" style="background:hsl(${Math.round(120 - v * 1.2)},65%,${v > 60 ? 40 : 36}%)">${v}%</td>`; }).join('')}<td>${g.length}</td></tr>`; }).join('')}
        </tbody></table></div></div>`;
    bindTeamFilters(el, draw);
    $$('.erank li', el).forEach(li => li.onclick = () => { teamFilter.sel = li.dataset.id; draw(); if (matchMedia('(max-width: 1100px)').matches) $('.errdetail', el).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $$('.catchips.proc button', el).forEach(b => b.onclick = () => { teamFilter.proc = b.dataset.p; draw(); });
  };
  draw();
}
function dashSupervisor(el) {
  const redraw = () => dashSupervisor(el);
  const team = filterTeam(teamData());
  const list = (arr, f) => arr.slice(0, 6).map(f).join(', ') + (arr.length > 6 ? ` y ${arr.length - 6} más` : '');
  const teamAvg = COMP_IDS.map(c => round(avg(team.map(t => t.m[c]))));
  const errCount = {};
  team.forEach(t => t.errs.forEach(e => errCount[e] = (errCount[e] || 0) + 1));
  const topErr = Object.entries(errCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const hvRisk = team.filter(t => t.m.hv < 60);
  const forget = team.filter(t => t.post != null && t.delayed != null && t.post - t.delayed >= 12);
  const withViol = team.filter(t => t.viol > 0);
  const heat = v => `hsl(${Math.round(v * 1.2)}, 70%, ${v < 40 ? 38 : 34}%)`;
  el.innerHTML = `
    ${teamFiltersHTML(false)}
    <div class="kpis">
      ${kpi('Técnicos', team.length, teamFilter.taller || 'en todos los talleres')}
      ${kpi('Dominio del equipo', round(avg(teamAvg)), 'promedio')}
      ${kpi('Ganancia promedio', (avg(team.filter(t => t.post != null).map(t => (t.post - t.pre) / (100 - t.pre)))).toFixed(2), 'normalizada')}
      ${kpi('Retención promedio', round(avg(team.filter(t => t.delayed != null).map(t => t.delayed / t.post * 100))) + '%', 'diferida / post')}
      ${kpi('Riesgo seguridad AV', hvRisk.length, 'dominio < 60', hvRisk.length ? 'bad' : 'ok')}
    </div>
    <div class="card alerts"><h3>⚠ Alertas accionables</h3><ul>
      ${hvRisk.length ? `<li class="bad"><b>Brecha crítica en Seguridad AV:</b> ${list(hvRisk, t => esc(t.name))} → bloquear prácticas AV y asignar lección obligatoria.</li>` : ''}
      ${withViol.length ? `<li class="bad"><b>Violaciones de seguridad en simulación:</b> ${list(withViol, t => `${esc(t.name)} (${t.viol})`)} → retroalimentación 1:1.</li>` : ''}
      ${forget.length ? `<li class="warn"><b>Riesgo de olvido (caída ≥ 12 pts post→diferida):</b> ${list(forget, t => esc(t.name))} → reforzar repasos.</li>` : ''}
      ${topErr[0] ? `<li class="warn"><b>Error más común del equipo:</b> ${esc(ERROR_LABELS[topErr[0][0]] || topErr[0][0])} (${topErr[0][1]} técnicos) → <a href="#/tablero/errores">ver el análisis de errores comunes</a>.</li>` : ''}
      ${S.unanswered.length ? `<li class="info"><b>Brechas de contenido:</b> ${S.unanswered.length} pregunta(s) al asistente sin fuente autorizada → enviar a especialista.</li>` : ''}
    </ul></div>
    <div class="card"><h3>Mapa de calor de competencias</h3><div class="tscroll"><table class="tbl heat">
      <thead><tr><th>Técnico</th><th>Taller</th><th>Rol</th>${COMPETENCIAS.map(c => `<th title="${esc(c.name)}">${c.icon} ${esc(c.short)}</th>`).join('')}<th>Pre→Post→Dif.</th><th>Viol.</th><th>XP</th></tr></thead>
      <tbody>${(teamFilter.all ? team : team.slice(0, 12)).map(t => `<tr class="${t.me ? 'me' : ''}"><td><b>${esc(t.name)}</b></td><td class="small">${esc((t.taller || '').split(' · ')[0])}</td><td class="small">${esc(ROLES[t.role].name)}</td>
        ${COMP_IDS.map(c => `<td class="hc" style="background:${heat(t.m[c])}">${t.m[c]}</td>`).join('')}
        <td class="small">${t.pre} → ${t.post ?? '—'} → ${t.delayed ?? '—'}</td><td>${t.viol ? `<span class="tag bad">${t.viol}</span>` : '0'}</td><td>${t.xp}</td></tr>`).join('')}
      <tr class="avg"><td><b>Promedio</b></td><td></td><td></td>${teamAvg.map(v => `<td class="hc" style="background:${heat(v)}">${v}</td>`).join('')}<td></td><td></td><td></td></tr></tbody></table></div>
      <div class="row">${team.length > 12 ? `<button class="btn ghost" id="allRows">${teamFilter.all ? 'Ver menos' : `Ver los ${team.length} técnicos`}</button>` : ''}<button class="btn ghost" id="csv">⬇ Exportar CSV</button></div></div>
    <div class="grid g-1-1">
      <div class="card"><h3>Perfil del equipo</h3>${Charts.radar({ size: 260, labels: COMPETENCIAS.map(c => c.short), series: [{ name: 'Promedio del equipo', values: teamAvg, color: C.team }] })}</div>
      <div class="card"><h3>🏆 Ranking (gamificación)</h3><ol class="rank">${[...team].sort((a, b) => b.xp - a.xp).slice(0, 10).map(t => `<li class="${t.me ? 'me' : ''}"><span>${esc(t.name)}</span><b>${t.xp} XP</b></li>`).join('')}</ol>
        <h4>Errores más frecuentes del equipo</h4><ul class="errs">${topErr.map(([k, n]) => `<li><span class="n">${n}</span>${esc(ERROR_LABELS[k] || k)}</li>`).join('')}</ul></div>
    </div>`;
  bindTeamFilters(el, redraw);
  const ar = $('#allRows', el); if (ar) ar.onclick = () => { teamFilter.all = !teamFilter.all; redraw(); };
  $('#csv').onclick = () => {
    const head = ['tecnico', 'taller', 'rol', ...COMP_IDS, 'pre', 'post', 'diferida', 'violaciones', 'xp'];
    const rows = team.map(t => [t.name, t.taller || '', ROLES[t.role].name, ...COMP_IDS.map(c => t.m[c]), t.pre, t.post ?? '', t.delayed ?? '', t.viol, t.xp]);
    download('equipo_competencias.csv', [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  };
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  // en entornos donde la descarga está bloqueada (p. ej. vista previa incrustada), también se copia al portapapeles
  try { navigator.clipboard.writeText(text).then(() => toast(`⬇ ${name} · también copiado al portapapeles`), () => toast(`⬇ ${name}`)); } catch (e) { toast(`⬇ ${name}`); }
}

/* =========================================================
   VISTA: Escalabilidad e integración
   ========================================================= */
function viewScale(el) {
  el.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Entregable 6</span><h1>Propuesta de escalabilidad e integración</h1>
      <p class="muted">De prototipo a plataforma para cientos de técnicos en talleres con conectividad limitada.</p></div></div>
    <div class="card arch">
      <h3>Arquitectura objetivo</h3>
      <div class="archgrid">
        <div class="col"><h4>Fuentes autorizadas</h4><div class="bx">Manuales de servicio</div><div class="bx">Boletines técnicos</div><div class="bx">Material de capacitación</div><div class="bx">Casos de falla anonimizados</div></div>
        <div class="arrow">→</div>
        <div class="col"><h4>Pipeline de contenido</h4><div class="bx">Ingesta y fragmentación con versión</div><div class="bx">Revisión y aprobación por especialista</div><div class="bx">Índice vectorial + metadatos (modelo, VIN, idioma)</div><div class="bx">Generación de micro-lecciones y reactivos (IA + validación humana)</div></div>
        <div class="arrow">→</div>
        <div class="col"><h4>Servicios</h4><div class="bx">Motor adaptativo (dominio + olvido)</div><div class="bx">Asistente RAG con citas obligatorias</div><div class="bx">Simulador de fallas / 3D (WebGL, WebXR)</div><div class="bx">LRS xAPI (trazabilidad)</div><div class="bx">Analítica y alertas</div></div>
        <div class="arrow">→</div>
        <div class="col"><h4>Clientes</h4><div class="bx">PWA móvil offline</div><div class="bx">Tablet de taller</div><div class="bx">Visor VR / AR</div><div class="bx">Tablero web del supervisor</div></div>
      </div>
    </div>
    <div class="grid g-3">
      ${scaleCard('📚 Integración con documentación técnica', [
        'Conector a la documentación oficial: cada fragmento conserva ID, versión y vigencia; si el manual cambia, las lecciones y reactivos afectados se marcan para revisión.',
        'El asistente solo responde con fragmentos recuperados y siempre cita la fuente; sin fuente → escala al especialista y registra la brecha.',
        'Búsqueda contextual por modelo de autobús, VIN y código de falla (DTC).',
        'Estándares de interoperabilidad: xAPI/cmi5 hacia el LMS corporativo, SSO (SAML/OIDC).'])}
      ${scaleCard('📈 Escala a cientos de técnicos', [
        'Arquitectura multi-tenant por país/concesionario/taller, con roles: técnico, instructor, supervisor, especialista.',
        'Servicios sin estado en contenedores con auto-escalado; contenido estático y modelos 3D vía CDN.',
        'El motor adaptativo es ligero (cálculo en el dispositivo); el servidor solo sincroniza eventos.',
        'Banco de reactivos con formas paralelas y calibración por dificultad (TRI) conforme crecen los datos.'])}
      ${scaleCard('📶 Conectividad limitada', [
        'PWA instalable: service worker con caché del shell, lecciones, modelos 3D e índice de documentos.',
        'Estado local (IndexedDB) y cola de eventos xAPI que se sincroniza al recuperar la señal.',
        'Paquetes de contenido por rol descargables por Wi-Fi del taller; actualizaciones diferenciales.',
        'Este prototipo ya funciona sin conexión: motor 3D propio sin librerías y búsqueda local.'])}
      ${scaleCard('🔐 Protección de datos', [
        'Datos personales mínimos; analítica de equipo agregada y seudonimizada.',
        'Cifrado en tránsito y en reposo; control de acceso por rol; bitácora de auditoría.',
        'Alineado a la LFPDPPP (México) y a las políticas internas de Volvo; aviso de privacidad al técnico.',
        'Los casos de falla reales se anonimizan (sin VIN ni cliente) antes de usarse en simulación.'])}
      ${scaleCard('🥽 Realidad virtual y aumentada', [
        'Hoy: modelo 3D interactivo + modo estéreo para visor de teléfono.',
        'Siguiente: WebXR para AR en tablet (señalar componentes sobre el autobús real, sin intervenirlo).',
        'Modelos CAD simplificados (glTF) exportados desde ingeniería, con niveles de detalle.'])}
      ${scaleCard('🎯 Métricas de impacto para Volvo', [
        'Tiempo hasta competencia (días para alcanzar “Competente”).',
        'Ganancia normalizada y retención a 7/21/60 días.',
        'Recurrencia de errores y violaciones de seguridad en simulación.',
        'Transferencia: correlación con reparaciones repetidas y tiempo de diagnóstico en taller.'])}
    </div>
    <div class="card"><h3>Plan de implementación</h3>
      <div class="roadmap">
        <div><b>Fase 1 · Piloto (3 meses)</b><p>1 taller, 20 técnicos, 2 familias de autobús, 10 escenarios de falla validados.</p></div>
        <div><b>Fase 2 · Expansión (6 meses)</b><p>Conector a documentación oficial, integración LMS/SSO, AR en tablet, 100+ técnicos.</p></div>
        <div><b>Fase 3 · Escala (12 meses)</b><p>Red de concesionarios, generación asistida de contenido, analítica predictiva con telemática.</p></div>
      </div></div>`;
}
const scaleCard = (t, items) => `<div class="card"><h3>${t}</h3><ul class="dots-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;

/* =========================================================
   Datos demo (para presentar al jurado)
   ========================================================= */
function loadDemo() {
  S = defaultState();
  S.user = { name: 'Técnico Demo', role: 'ev', since: Date.now() };
  const pre = { hv: 40, ev: 40, diesel: 70, elec: 70, sw: 40, con: 10, diag: 70 };
  const post = { hv: 100, ev: 100, diesel: 50, elec: 100, sw: 50, con: 100, diag: 100 };
  const del = { hv: 100, ev: 50, diesel: 50, elec: 100, sw: 50, con: 50, diag: 100 };
  Object.entries(S.selfAssess).forEach(([c]) => S.selfAssess[c] = { hv: 4, ev: 3, diesel: 4, elec: 3, sw: 2, con: 2, diag: 4 }[c]);
  const ans = sc => COMP_IDS.flatMap(c => [{ id: c + '-2', ok: sc[c] >= 50 }, { id: c + '-1', ok: sc[c] >= 70 }]);
  S.tests.pre = { day: 0, scores: pre, avg: round(avg(Object.values(pre))), answers: ans(pre) };
  S.log.push({ day: 0, ts: Date.now() - 9e8, type: 'evaluación', text: `Diagnóstico inicial: ${S.tests.pre.avg}/100` });
  ['hv1', 'hv2', 'ev1', 'ev2', 'con1', 'diag1'].forEach((id, i) => { S.lessonsDone[id] = i < 3 ? 0 : 1; S.log.push({ day: S.lessonsDone[id], ts: Date.now() - 8e8 + i * 1e7, type: 'lección', text: `Completó "${LESSONS.find(l => l.id === id).title}"` }); });
  S.practice.push({ id: 'ev_aislamiento', day: 1, score: 59, passed: false, violations: ['no-verificar-ausencia-tension'], errors: ['no-verificar-ausencia-tension', 'cambiar-piezas-sin-diagnostico'], secs: 312, lookups: 1 });
  S.practice.push({ id: 'ev_aislamiento', day: 2, score: 92, passed: true, violations: [], errors: ['herramienta-incorrecta'], secs: 240, lookups: 2 });
  S.practice.push({ id: 'can_comunicacion', day: 2, score: 83, passed: true, violations: [], errors: ['cambiar-piezas-sin-diagnostico'], secs: 190, lookups: 0 });
  S.procs = [
    { id: 'loto_av', day: 1, score: 84, passed: true, mode: 'guiado', errors: ['proc-orden-incorrecto', 'proc-herramienta-incorrecta'], violations: [], secs: 260 },
    { id: 'loto_av', day: 2, score: 100, passed: true, mode: 'evaluacion', errors: [], violations: [], secs: 150 },
    { id: 'arnes_ac', day: 3, score: 59, passed: false, mode: 'evaluacion', errors: ['intervenir-av-sin-verificar', 'proc-torque-incorrecto'], violations: ['intervenir-av-sin-verificar'], secs: 410 },
  ];
  S.log.push({ day: 3, ts: Date.now() - 4e8, type: 'procedimiento', text: 'Reemplazar el arnés AV del compresor de A/C (evaluación): 59/100 · VIOLACIÓN DE SEGURIDAD' });
  S.errors = { 'proc-torque-incorrecto': 1, 'intervenir-av-sin-verificar': 1, 'no-verificar-ausencia-tension': 1, 'cambiar-piezas-sin-diagnostico': 2, 'herramienta-incorrecta': 1 };
  S.qErrors = { 'sw-3': 2, 'diesel-4': 1 };
  S.log.push({ day: 1, ts: Date.now() - 7e8, type: 'práctica', text: 'Autobús eléctrico no entra en READY: 59/100 · VIOLACIÓN DE SEGURIDAD' });
  S.log.push({ day: 2, ts: Date.now() - 6e8, type: 'práctica', text: 'Autobús eléctrico no entra en READY: 92/100' });
  S.log.push({ day: 2, ts: Date.now() - 5.9e8, type: 'práctica', text: 'Varias ECU sin comunicación: 83/100' });
  S.tests.post = { day: 2, scores: post, avg: round(avg(Object.values(post))), answers: ans(post) };
  S.log.push({ day: 2, ts: Date.now() - 5e8, type: 'evaluación', text: `Post-test inmediato: ${S.tests.post.avg}/100` });
  S.tests.delayed = { day: 9, scores: del, avg: round(avg(Object.values(del))), answers: ans(del) };
  S.log.push({ day: 9, ts: Date.now() - 2e8, type: 'evaluación', text: `Revisión diferida: ${S.tests.delayed.avg}/100` });
  COMP_IDS.forEach(c => { S.mastery[c] = round(pre[c] * 0.3 + post[c] * 0.3 + del[c] * 0.4); S.lastPractice[c] = 9; S.stability[c] = 8; });
  S.reviews = [
    { id: uid(), c: 'hv', due: 1, done: true, ok: true, doneDay: 1, interval: 1 }, { id: uid(), c: 'hv', due: 3, done: true, ok: true, doneDay: 3, interval: 3 },
    { id: uid(), c: 'ev', due: 3, done: true, ok: false, doneDay: 3, interval: 3 }, { id: uid(), c: 'con', due: 4, done: true, ok: true, doneDay: 4, interval: 3 },
    { id: uid(), c: 'diag', due: 8, done: true, ok: true, doneDay: 8, interval: 7 },
    { id: uid(), c: 'hv', due: 10, done: false, interval: 7 }, { id: uid(), c: 'ev', due: 10, done: false, interval: 7 }, { id: uid(), c: 'con', due: 22, done: false, interval: 21 },
  ];
  S.day = 10; S.xp = 1180;
  S.badges = ['primer_paso', 'micro_5', 'guardian_av', 'mejora', 'constante', 'manos_expertas'];
  S.unanswered = [{ q: '¿Cuál es el torque de las ruedas?', day: 5 }];
  S.sims = { inversor: { saber: true, kit: true, hacer: 76, demo: 92 }, baterias: { saber: true, kit: false, hacer: null, demo: null } };
  S.log.push({ day: 10, ts: Date.now(), type: 'tiempo', text: 'Datos demo cargados' });
  save();
  toast('Datos demo cargados');
}

/* ---------------- Arranque ---------------- */
function init() {
  $('#plus1').onclick = () => advanceDays(1);
  $('#plus7').onclick = () => advanceDays(7);
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#moreBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  let armed = false;
  $('#resetBtn').onclick = e => {
    if (!armed) { armed = true; e.target.textContent = '¿Seguro? clic otra vez'; setTimeout(() => { armed = false; e.target.textContent = 'Reiniciar datos'; }, 3000); return; }
    S = defaultState(); chat = []; save(); go('inicio');
  };
  $('#demoNav').onclick = () => { loadDemo(); go('tablero'); };
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  setOnline();
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin service worker en este entorno */ });
  }
}
document.addEventListener('DOMContentLoaded', init);

/* =========================================================
   TALLER VIRTUAL — simulación de procedimientos de reparación
   ========================================================= */
const partName = id => id === 'self' ? 'ti mismo' : (COMPONENTS[id]?.name || id);
const toolLabel = id => id ? `${TOOLS[id].icon} ${TOOLS[id].name}` : 'sin herramienta';
function procLocked(p) {
  if (!p.requires) return false;
  return !((S.procs || []).some(x => x.id === p.requires.proc && x.score >= 70) || effMastery('hv') >= p.requires.mastery);
}

/* ---------- Modal y fichas ---------- */
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Cerrar">✕</button>${html}</div>`;
  m.hidden = false;
  $('.modal-x', m).onclick = closeModal;
  m.onclick = e => { if (e.target === m) closeModal(); };
  $$('[data-tool]', m).forEach(b => b.onclick = () => openModal(toolSheet(b.dataset.tool)));
  $$('[data-part]', m).forEach(b => b.onclick = () => openModal(partSheet(b.dataset.part)));
  $$('[data-go]', m).forEach(b => b.onclick = () => { closeModal(); go(b.dataset.go); });
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
const ul = items => `<ul class="dots-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
function toolSheet(id) {
  const t = TOOLS[id];
  const procs = PROCEDURES.filter(p => p.steps.some(s => s.tool === id));
  return `<div class="sheet-head"><span class="sheet-icon">${t.icon}</span><div><span class="eyebrow">${esc(t.cat)}</span><h2>${esc(t.name)}</h2></div></div>
    <p>${esc(t.desc)}</p>
    <div class="sheet-grid">
      <div><h4>Especificaciones</h4>${ul(t.specs)}</div>
      <div><h4>Cómo se usa</h4>${ul(t.uso)}</div>
      <div><h4>Inspección antes de usar</h4><p>${esc(t.inspect)}</p></div>
      <div><h4>Errores comunes</h4>${ul(t.errores)}</div>
    </div>
    <div class="warnbox">⚠ ${esc(t.seguridad)}</div>
    ${procs.length ? `<h4>Se usa en</h4><div class="chips">${procs.map(p => `<button data-go="taller/${p.id}">${esc(p.title)}</button>`).join('')}</div>` : ''}`;
}
function partTasks(id) {
  return PROCEDURES.map(p => ({ p, steps: p.steps.map((s, i) => ({ ...s, n: i + 1 })).filter(s => s.part === id) })).filter(x => x.steps.length);
}
function partSheet(id) {
  const c = COMPONENTS[id], pi = PART_INFO[id] || {};
  const d = DOCS.find(x => x.id === c.doc), l = LESSONS.find(x => x.id === c.lesson);
  const tasks = partTasks(id);
  return `<div class="sheet-head"><span class="sheet-icon">${comp(c.comp).icon}</span><div><span class="eyebrow">${esc(compName(c.comp))}${HV_PARTS.includes(id) ? ' · ⚡ ALTO VOLTAJE' : ''}</span><h2>${esc(c.name)}</h2></div></div>
    <p>${esc(pi.fn || c.desc)}</p>${pi.ubic ? `<p class="muted small">📍 Ubicación: ${esc(pi.ubic)}</p>` : ''}
    <div class="sheet-grid">
      ${pi.specs ? `<div><h4>Especificaciones</h4>${ul(pi.specs)}</div>` : ''}
      ${pi.fallas ? `<div><h4>Fallas comunes</h4>${ul(pi.fallas)}</div>` : ''}
      ${pi.sintomas ? `<div><h4>Síntomas</h4>${ul(pi.sintomas)}</div>` : ''}
      ${pi.tools ? `<div><h4>Herramientas</h4><div class="chips">${pi.tools.map(t => `<button data-tool="${t}">${TOOLS[t].icon} ${esc(TOOLS[t].name)}</button>`).join('')}</div></div>` : ''}
    </div>
    ${pi.seguridad ? `<div class="warnbox">⚠ ${esc(pi.seguridad)}</div>` : ''}
    ${(PART_TASKS[id] || []).length ? `<h4>Inspección y mantenimiento</h4><ul class="qtasks">${PART_TASKS[id].map(([t, x]) => `<li><button class="qt" data-tool="${t}" title="${esc(TOOLS[t].name)}">${TOOLS[t].icon}</button><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
    ${tasks.length ? `<h4>Procedimientos de reparación</h4>${tasks.map(x => `<div class="taskgrp"><b>${esc(x.p.title)}</b><ol>${x.steps.map(s => `<li value="${s.n}">${s.tool ? TOOLS[s.tool].icon : '✋'} ${esc(s.title)}</li>`).join('')}</ol>${S.user ? `<button class="btn sm" data-go="taller/${x.p.id}">Practicar →</button>` : ''}</div>`).join('')}` : ''}
    ${d ? `<div class="docfrag"><b>📄 ${esc(d.title)}</b> <span class="muted">(${esc(d.id)})</span><p>${esc(d.text)}</p></div>` : ''}
    ${S.user && l ? `<button class="btn" data-go="leccion/${l.id}">Micro-lección: ${esc(l.title)} →</button>` : ''}`;
}

/* ---------- Lista de procedimientos + catálogo de herramientas ---------- */
function viewTaller(el, id) {
  if (!S.tests.pre) { el.innerHTML = needPre(); return; }
  const proc = PROCEDURES.find(p => p.id === id);
  if (!proc) {
    el.innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Entregable 3 · Práctica paso a paso</span><h1>Taller virtual</h1>
        <p class="muted">Simulaciones de procedimientos de reparación sobre el modelo 3D: elige la herramienta correcta, aplícala en la pieza correcta y en el orden correcto. Cada acción se evalúa.</p></div></div>
      <div class="grid g-3">${PROCEDURES.map(p => {
        const lock = procLocked(p), last = (S.procs || []).filter(x => x.id === p.id).slice(-1)[0];
        const tools = [...new Set(p.steps.map(s => s.tool).filter(Boolean))];
        return `<div class="card scen ${lock ? 'locked' : ''}">
          <span class="tag ${p.mode === 'ev' ? 'ev' : 'di'}">${p.mode === 'ev' ? '🔋 Eléctrico' : '⛽ Diésel'}</span> <span class="tag">${p.level}</span> <span class="tag">${p.steps.length} tareas</span> ${p.hv ? '<span class="tag warn">⚡ AV</span>' : ''}
          <h3>${esc(p.title)}</h3><p class="muted">${esc(p.intro)}</p>
          <p class="small toolrow">${tools.map(t => `<span title="${esc(TOOLS[t].name)}">${TOOLS[t].icon}</span>`).join('')}</p>
          ${last ? `<p class="small">Último intento: <b>${last.score}</b> · ${last.mode} ${last.violations.length ? '<span class="tag bad">violación</span>' : ''}</p>` : ''}
          ${lock ? `<div class="lockmsg">🔒 Requiere aprobar <b>${esc(PROCEDURES.find(x => x.id === p.requires.proc).title)}</b> o dominio ≥ ${p.requires.mastery} en Seguridad AV.</div><button class="btn" onclick="go('taller/${p.requires.proc}')">Ir al requisito</button>`
            : `<button class="btn primary" onclick="go('taller/${p.id}')">${last ? 'Repetir' : 'Iniciar'} →</button>`}
        </div>`; }).join('')}</div>
      <div class="card"><h3>Catálogo de herramientas</h3><p class="muted small">Toca una herramienta para ver su ficha: especificaciones, uso, inspección, errores comunes y seguridad.</p>
        <div class="toolgrid">${Object.entries(TOOLS).map(([k, t]) => `<button class="toolcard" data-tool="${k}"><span>${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.cat)}</small></button>`).join('')}</div></div>`;
    $$('.toolcard', el).forEach(b => b.onclick = () => openModal(toolSheet(b.dataset.tool)));
    return;
  }
  if (procLocked(proc)) return go('taller');
  runProcedure(el, proc);
}

/* ---------- Ejecución de un procedimiento ---------- */
function runProcedure(el, proc) {
  const steps = proc.steps;
  el.innerHTML = `
    <div class="page-head"><div><a href="#/taller" class="back">← Taller virtual</a><span class="eyebrow">${proc.mode === 'ev' ? '🔋 Autobús eléctrico' : '⛽ Autobús diésel'} · Procedimiento</span><h1>${esc(proc.title)}</h1></div></div>
    <div class="sim taller">
      <div class="tcol">
        <div class="card viewer"><canvas id="cv"></canvas>${viewerTools()}
          <div class="hud" id="hud" hidden></div>
          <div class="equipped" id="equipped">✋ Sin herramienta</div>
          <div class="pickinfo" id="pickinfo">Elige una herramienta abajo y toca la pieza en el modelo</div>
        </div>
        <div class="card tray">
          <div class="tray-head"><b>Caja de herramientas</b><small>Toca para tomarla · toca otra vez para soltarla</small></div>
          <div class="tools" id="tools">${Object.entries(TOOLS).map(([k, t]) => `<button class="tool" data-k="${k}" title="${esc(t.name)}"><span>${t.icon}</span><small>${esc(t.short)}</small></button>`).join('')}</div>
          <div id="toolInfo" class="toolinfo"><p class="muted small">Al tomar una herramienta verás aquí su información: para qué sirve, especificaciones, inspección previa y errores comunes.</p></div>
          <details class="partpick"><summary>¿No alcanzas una pieza en el modelo? Selecciónala de la lista</summary><div class="chips" id="partChips"></div></details>
        </div>
      </div>
      <div class="card panel" id="panel"></div>
    </div>`;
  const scene = mountScene($('#cv'), proc.mode, k => onPart(k));
  (proc.initial || []).forEach(a => { scene.animate(a.id, a.type); const p = scene.parts[a.id]; if (p) { p.cur = [...p.off]; p.aCur = p.a; } });
  const partIds = [...new Set(scene.meshes.filter(m => m.kind === 'part').map(m => m.id))];
  $('#partChips').innerHTML = partIds.map(k => `<button data-k="${k}">${esc(COMPONENTS[k].name)}</button>`).join('');
  $$('#partChips button').forEach(b => b.onclick = () => onPart(b.dataset.k));

  const st = { mode: null, i: 0, tool: null, phase: 'act', errors: [], violations: [], stepErr: steps.map(() => 0), safe: false, ppe: false, start: 0, timer: null };
  cleanup.push(() => clearInterval(st.timer));
  const panel = $('#panel');
  const guided = () => st.mode === 'guiado';

  // --- selección de herramienta ---
  $$('#tools .tool').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    st.tool = st.tool === k ? null : k;
    $$('#tools .tool').forEach(x => x.classList.toggle('on', x.dataset.k === st.tool));
    $('#equipped').innerHTML = st.tool ? `En mano: ${TOOLS[st.tool].icon} <b>${esc(TOOLS[st.tool].name)}</b>` : '✋ Sin herramienta';
    $('#cv').classList.toggle('armed', !!st.tool);
    const t = TOOLS[st.tool];
    $('#toolInfo').innerHTML = t ? `
      <div class="ti-head"><span class="ti-icon">${t.icon}</span><div><b>${esc(t.name)}</b><small>${esc(t.cat)}</small></div><button class="btn sm ghost" id="tiFull">Ficha completa</button></div>
      <p>${esc(t.desc)}</p>
      <div class="ti-grid"><div><h5>Especificaciones</h5>${ul(t.specs)}</div><div><h5>Antes de usar</h5><p>${esc(t.inspect)}</p><h5>Evita</h5>${ul(t.errores.slice(0, 2))}</div></div>
      <div class="warnbox sm">⚠ ${esc(t.seguridad)}</div>` : '<p class="muted small">Sin herramienta en mano.</p>';
    if (t) $('#tiFull').onclick = () => openModal(toolSheet(st.tool));
    drawAction();
  });

  // --- clic en pieza ---
  function onPart(k) {
    const c = COMPONENTS[k], pi = PART_INFO[k] || {};
    $('#pickinfo').innerHTML = `<b>${esc(c.name)}</b>${HV_PARTS.includes(k) ? ' <span class="tag warn">⚡ AV</span>' : ''} — ${esc(pi.fn || c.desc)} <button class="btn link" id="pfull">Ver ficha</button>`;
    $('#pfull').onclick = () => openModal(partSheet(k));
    if (st.mode && st.phase === 'act' && st.tool) apply(k);
  }

  function apply(part) {
    const step = steps[st.i];
    const tool = st.tool;
    if (part !== 'self' && proc.hv && HV_PARTS.includes(part)) {
      if (tool === 'manual') return violation('herramienta-no-aislada-av', 'Usaste herramienta NO aislada en un componente de alto voltaje.');
      if (!st.ppe && !['escaner', 'linterna', 'guantes'].includes(tool)) return violation('av-sin-epp', 'Intentaste intervenir un componente de alto voltaje sin EPP dieléctrico.');
      if (!st.safe && ['aislada', 'torque', 'fijacion', 'conectores', 'megohm'].includes(tool)) return violation('intervenir-av-sin-verificar', 'Intentaste intervenir un componente de alto voltaje antes de verificar la ausencia de tensión.');
    }
    if (tool === step.tool && part === step.part) return success(part);
    const later = steps.findIndex((s, k) => k > st.i && s.tool === tool && s.part === part);
    if (later > -1) return error('proc-orden-incorrecto', `Esa acción corresponde al paso ${later + 1}. Antes completa: «${step.title}».`);
    if (part === step.part) return error('proc-herramienta-incorrecta', guided() ? `${TOOLS[tool].name} no sirve para este paso. Necesitas: ${toolLabel(step.tool)}.` : `Herramienta incorrecta para «${step.title}».`);
    if (tool === step.tool) return error('proc-pieza-incorrecta', guided() ? `Herramienta correcta, pero la pieza es otra: ${partName(step.part)}.` : 'Herramienta correcta, pieza incorrecta.');
    return error('proc-herramienta-incorrecta', guided() ? `Ni la herramienta ni la pieza corresponden. Objetivo: ${toolLabel(step.tool)} → ${partName(step.part)}.` : 'Herramienta y pieza incorrectas para este paso.');
  }
  function fb(cls, html) { const f = $('#pfb'); if (f) f.innerHTML = `<div class="fb ${cls}">${html}</div>`; }
  function error(tag, msg) { st.errors.push(tag); st.stepErr[st.i]++; fb('bad', `✘ ${esc(msg)}`); }
  function violation(tag, msg) {
    st.errors.push(tag); st.violations.push(tag); st.stepErr[st.i] += 2;
    fb('critical', `⚠ <b>VIOLACIÓN DE SEGURIDAD.</b> ${esc(msg)}`);
    const v = $('.viewer'); v.classList.add('shake'); setTimeout(() => v.classList.remove('shake'), 600);
  }
  function success(part) {
    const step = steps[st.i];
    if (step.tool) scene.fx(part === 'self' ? null : part, TOOLS[step.tool].icon);
    if (step.anim) scene.animate(step.anim.id, step.anim.type);
    if (step.ppe) st.ppe = true;
    if (step.reading) {
      const h = $('#hud'); h.hidden = false;
      h.className = 'hud ' + step.reading.status;
      h.innerHTML = `<small>${step.tool ? toolLabel(step.tool) : 'Lectura'}</small><b>${esc(step.reading.text)}</b>`;
    }
    st.phase = step.check ? 'check' : step.input ? 'input' : step.wait ? 'wait' : 'next';
    drawPanel(true);
  }
  function completeStep() {
    const step = steps[st.i];
    if (step.setsSafe) st.safe = true;
    st.i++; st.phase = 'act';
    if (st.i >= steps.length) return finish();
    const nx = steps[st.i];
    if (!nx.tool && nx.part === 'self' && nx.check) st.phase = 'check';
    drawPanel();
  }

  function drawPanel(keepFb) {
    const step = steps[st.i];
    scene.hint = guided() && step.part && step.part !== 'self' ? step.part : null;
    if (guided() && step.part && step.part !== 'self') scene.focusOn(step.part);
    const pct = st.i / steps.length * 100;
    const oldFb = keepFb ? '' : null;
    panel.innerHTML = `
      <div class="row between"><span class="tag ${guided() ? 'info' : 'warn'}">${guided() ? '🧭 Modo guiado' : '🎓 Modo evaluación'}</span><span class="muted small">Tarea ${st.i + 1} de ${steps.length}</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <ol class="tasks">${steps.map((s, k) => `<li class="${k < st.i ? 'done' : k === st.i ? 'cur' : ''}">
        <span class="tk">${k < st.i ? (st.stepErr[k] ? '⚠' : '✓') : k === st.i ? '▶' : k + 1}</span>
        <span>${k <= st.i || guided() ? esc(s.title) : '<span class="muted">Tarea oculta</span>'}</span>
        ${k <= st.i || guided() ? `<em>${s.tool ? TOOLS[s.tool].icon : s.wait ? '⏱' : '✋'}</em>` : ''}</li>`).join('')}</ol>
      <div class="stepcard">
        <span class="eyebrow">Tarea ${st.i + 1} · ${esc(step.title)}</span>
        <p class="instr">${esc(step.instr)}</p>
        ${guided() ? `<p class="small why">💡 <b>Por qué:</b> ${esc(step.why)}</p>` : ''}
        ${guided() && (step.tool || step.part) && st.phase === 'act' ? `<p class="small target">🎯 Objetivo: ${toolLabel(step.tool)}${step.part && step.part !== 'self' ? ` → <b>${esc(partName(step.part))}</b>` : step.part === 'self' ? ' → en ti' : ''}</p>` : ''}
        <div id="act"></div>
        <div id="pfb"></div>
      </div>`;
    if (oldFb === null) { /* sin retroalimentación previa */ }
    drawAction();
  }
  function drawAction() {
    const act = $('#act'); if (!act) return;
    const step = steps[st.i];
    if (st.phase === 'act') {
      if (step.part === 'self' && step.tool) act.innerHTML = `<button class="btn" id="self" ${st.tool ? '' : 'disabled'}>🙋 Usar ${st.tool ? esc(TOOLS[st.tool].short.toLowerCase()) : 'herramienta'} en mí</button>`;
      else if (!step.tool && step.wait) act.innerHTML = `<button class="btn primary" id="startWait">⏱ Iniciar espera</button>`;
      else act.innerHTML = `<p class="muted small">${st.tool ? `Tienes en mano ${TOOLS[st.tool].icon}. Toca la pieza en el modelo 3D.` : 'Elige una herramienta de la caja.'}</p>`;
      const sb = $('#self'); if (sb) sb.onclick = () => apply('self');
      const sw = $('#startWait'); if (sw) sw.onclick = () => { st.phase = 'wait'; drawAction(); };
      return;
    }
    if (st.phase === 'check') {
      const c = step.check, order = shuffle(c.o.map((_, i) => i));
      act.innerHTML = `<p class="q"><b>${esc(c.q)}</b></p><div class="opts">${order.map(i => `<button class="opt" data-i="${i}">${esc(c.o[i])}</button>`).join('')}</div>`;
      $$('.opt', act).forEach(b => b.onclick = () => {
        if (+b.dataset.i === c.a) {
          b.classList.add('right'); $$('.opt', act).forEach(x => x.disabled = true);
          fb('ok', `✔ ${esc(c.fb)}`);
          st.phase = step.input ? 'input' : step.wait ? 'wait' : 'next';
          setTimeout(drawAction, 50);
        } else { b.disabled = true; b.classList.add('wrong'); error('proc-respuesta-incorrecta', c.fb); }
      });
      return;
    }
    if (st.phase === 'input') {
      const inp = step.input;
      act.innerHTML = `<label class="inp"><span>${esc(inp.label)}</span><span class="row"><input type="number" step="0.1" id="valIn" inputmode="decimal" placeholder="0.0"><em>${inp.unit}</em><button class="btn primary" id="valOk">Aplicar</button></span></label>
        <p class="small muted">${guided() ? `Especificación: <b>${inp.value} ${inp.unit}</b> (tolerancia ±${inp.tol})` : 'Consulta la especificación en la ficha de la pieza.'} <button class="btn link" id="specBtn">Ver ficha de la pieza</button></p>`;
      $('#specBtn').onclick = () => openModal(partSheet(step.part));
      $('#valOk').onclick = () => {
        const v = parseFloat($('#valIn').value);
        if (Math.abs(v - inp.value) <= inp.tol) { scene.fx(step.part, '✅'); fb('ok', `✔ ${v} ${inp.unit}: dentro de especificación.`); st.phase = step.wait ? 'wait' : 'next'; drawAction(); }
        else error('proc-torque-incorrecto', isNaN(v) ? 'Escribe un valor.' : `${v} ${inp.unit} está fuera de especificación. ${v < inp.value ? 'Apriete insuficiente: la conexión puede calentarse o aflojarse.' : 'Apriete excesivo: puedes dañar la terminal o la rosca.'}`);
      };
      return;
    }
    if (st.phase === 'wait') {
      const w = step.wait; let left = w.secs;
      act.innerHTML = `<div class="waitbox"><span>${esc(w.label)}</span><div class="progress big"><i id="wbar" style="width:0%"></i></div><b id="wleft">${left} s</b></div>`;
      clearInterval(st.timer);
      st.timer = setInterval(() => {
        left--; const b = $('#wbar'); if (!b) return clearInterval(st.timer);
        b.style.width = ((w.secs - left) / w.secs * 100) + '%'; $('#wleft').textContent = left > 0 ? left + ' s' : 'Listo ✓';
        if (left <= 0) { clearInterval(st.timer); st.phase = 'next'; drawAction(); }
      }, 1000);
      return;
    }
    if (st.phase === 'next') {
      act.innerHTML = `<button class="btn primary" id="nextStep">${st.i === steps.length - 1 ? 'Finalizar procedimiento' : 'Siguiente tarea →'}</button>`;
      $('#nextStep').onclick = completeStep;
    }
  }

  function finish() {
    scene.hint = null;
    const n = steps.length;
    const pts = st.stepErr.reduce((s, e) => s + Math.max(0, 10 - e * 4), 0);
    let score = round(pts / (n * 10) * 100);
    const crit = st.violations.length > 0;
    if (crit) score = Math.min(score, 59);
    const passed = score >= 70 && !crit;
    const secs = round((Date.now() - st.start) / 1000);
    S.procs = S.procs || [];
    S.procs.push({ id: proc.id, day: S.day, score, passed, mode: st.mode, errors: st.errors, violations: st.violations, secs });
    st.errors.forEach(t => S.errors[t] = (S.errors[t] || 0) + 1);
    const k = st.mode === 'guiado' ? 0.25 : 0.4;
    proc.comps.forEach(c => { const m = S.mastery[c]; touch(c, m + (score - m) * k + (passed ? 4 : 0), passed ? 6 : 4); scheduleReviews(c, proc.id); });
    log('procedimiento', `${proc.title} (${st.mode}): ${score}/100${crit ? ' · VIOLACIÓN DE SEGURIDAD' : ''}`);
    addXP(score * (st.mode === 'guiado' ? 0.8 : 1.4), 'Procedimiento');
    if (st.mode === 'evaluacion' && st.errors.length === 0) badge('manos_expertas');
    if (proc.hv && !crit && passed) badge('guardian_av');
    save();
    panel.innerHTML = `
      <span class="eyebrow">Resultado · ${st.mode === 'guiado' ? 'modo guiado' : 'modo evaluación'}</span>
      <div class="score ${passed ? 'pass' : 'fail'}"><b>${score}</b><span>${passed ? 'Procedimiento aprobado' : crit ? 'No aprobado · violación de seguridad' : 'No aprobado · repite el procedimiento'}</span></div>
      <table class="tbl"><thead><tr><th>Tarea</th><th>Herramienta</th><th>Errores</th></tr></thead><tbody>
        ${steps.map((s, k) => `<tr><td>${st.stepErr[k] ? '⚠️' : '✅'} ${esc(s.title)}</td><td>${s.tool ? TOOLS[s.tool].icon : '—'}</td><td>${st.stepErr[k]}</td></tr>`).join('')}
      </tbody></table>
      <div class="rub">
        <div><span>Tiempo</span><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></div>
        <div><span>Errores</span><b>${st.errors.length}</b></div>
        <div><span>Violaciones</span><b class="${crit ? 'bad' : ''}">${st.violations.length}</b></div>
        <div><span>Tareas limpias</span><b>${st.stepErr.filter(e => !e).length}/${n}</b></div>
      </div>
      ${st.errors.length ? `<p class="small"><b>Errores registrados:</b> ${[...new Set(st.errors)].map(t => `<span class="tag ${st.violations.includes(t) ? 'bad' : ''}">${esc(ERROR_LABELS[t] || t)}</span>`).join(' ')}</p>` : ''}
      <div class="row">${st.mode === 'guiado' ? `<button class="btn primary" id="again">Repetir en modo evaluación</button>` : `<button class="btn primary" id="again">Repetir</button>`}<button class="btn ghost" onclick="go('taller')">Otros procedimientos</button></div>`;
    $('#again').onclick = () => { render(); };
  }

  // --- elección de modo ---
  panel.innerHTML = `
    <div class="intro">📋 ${esc(proc.intro)}</div>
    <h3>${steps.length} tareas · ${[...new Set(steps.map(s => s.tool).filter(Boolean))].map(t => TOOLS[t].icon).join(' ')}</h3>
    <p class="muted small">Cómo funciona: 1) toma una herramienta de la caja, 2) toca la pieza en el modelo 3D (o "Usar en mí" para el EPP), 3) responde o registra el valor cuando se pida.</p>
    <div class="modes">
      <button class="modebtn" data-m="guiado"><b>🧭 Modo guiado</b><small>Ves la lista de tareas, el porqué de cada una, la pieza objetivo resaltada y la herramienta sugerida.</small></button>
      <button class="modebtn" data-m="evaluacion"><b>🎓 Modo evaluación</b><small>Sin pistas: tareas ocultas y sin especificaciones a la vista. Cuenta para tu dominio y para insignias.</small></button>
    </div>`;
  $$('.modebtn', panel).forEach(b => b.onclick = () => {
    st.mode = b.dataset.m; st.start = Date.now();
    const s0 = steps[0]; if (!s0.tool && s0.part === 'self' && s0.check) st.phase = 'check';
    drawPanel();
  });
}

/* =========================================================
   APRENDE HACIENDO — módulos Saber → Hacer → Demostrar
   con simulación 3D de procesos paso a paso
   ========================================================= */
const simProg = id => (S.sims = S.sims || {}, S.sims[id] || (S.sims[id] = { saber: false, kit: false, hacer: null, demo: null }));
const simPct = p => round(((p.saber ? 1 : 0) + (p.hacer != null ? 1 : 0) + (p.demo != null && p.demo >= 70 ? 1 : 0)) / 3 * 100);

function viewAprende(el, id) {
  const sim = SIMS.find(s => s.id === id);
  if (!sim) {
    el.innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Módulo práctico · simulación de procesos</span><h1>Aprende haciendo</h1>
        <p class="muted">Cada módulo sigue tres fases: <b>Saber</b> (micro-cápsula de menos de 5 min), <b>Hacer</b> (arma tu kit y practica guiado sobre las piezas en 3D) y <b>Demostrar</b> (sin pistas, con vidas y cronómetro).</p></div></div>
      <div class="method">
        <div><span>📖</span><b>1. Saber</b><small>Lo esencial en una tarjeta: flujo, riesgos y valores clave.</small></div>
        <div><span>🔧</span><b>2. Hacer</b><small>Arma tu kit y repara paso a paso con pistas. Si te equivocas, la pieza se marca en rojo y te explica por qué.</small></div>
        <div><span>🏅</span><b>3. Demostrar</b><small>Mismo proceso sin pistas: 5 vidas, cronómetro y rúbrica. Una falla de seguridad reprueba.</small></div>
      </div>
      <div class="modgrid">${SIMS.map(s => {
        const p = simProg(s.id), pct = simPct(p);
        const ph = [['📖 Saber', p.saber], ['🔧 Hacer', p.hacer != null], ['🏅 Demostrar', p.demo != null && p.demo >= 70]];
        return `<a class="card modcard" href="#/aprende/${s.id}">
          <div class="mc-top"><span class="modcode">${esc(s.section.toUpperCase())} · ${esc(s.code)}</span><span class="chip">⏱ ${s.min} min</span></div>
          <h3>${esc(s.title)} <span class="lvtag">[${esc(s.level)}]</span></h3>
          <p class="muted small">${esc(s.vehicle)} · ${s.steps.length} pasos · ${s.steps.reduce((n, x) => n + x.actions.length, 0)} acciones</p>
          <p class="small">${esc(s.brief)}</p>
          <div class="mc-phases">${ph.map(([t, ok]) => `<span class="${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${t}</span>`).join('')}</div>
          <div class="modprog"><div class="bar"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>
          ${p.demo != null ? `<p class="small">Mejor demostración: <b>${p.demo}</b>/100</p>` : ''}
        </a>`; }).join('')}</div>`;
    return;
  }
  const p = simProg(sim.id);
  let tab = !p.saber ? 'saber' : p.hacer == null ? 'hacer' : 'demostrar';
  const draw = () => {
    cleanup.forEach(f => f()); cleanup = [];
    const pct = simPct(p);
    const tabs = [['saber', '📖', '1. SABER', true], ['hacer', '🔧', '2. HACER', p.saber], ['demostrar', '🏅', '3. DEMOSTRAR', p.hacer != null]];
    el.innerHTML = `
      <div class="modhead card">
        <button class="backbtn" onclick="go(currentModel() ? 'practicar' : 'aprende')" aria-label="Volver">←</button>
        <div><span class="modcode">${esc(sim.section.toUpperCase())} · ${esc(sim.code)}</span>
          <h1>${esc(sim.title)} <span class="lvtag">[${esc(sim.level)}]</span></h1>
          <small class="muted">${esc(sim.vehicle)} · ${sim.min} min · ${sim.comps.map(c => comp(c).short).join(', ')}</small></div>
      </div>
      <div class="modprog big"><div class="bar"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>
      <div class="phasetabs">${tabs.map(([k, ic, t, open]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}" ${open ? '' : 'disabled'}>${open ? ic : '🔒'} ${t}</button>`).join('')}</div>
      <div id="phase"></div>`;
    $$('.phasetabs button', el).forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    const ph = $('#phase');
    if (tab === 'saber') phaseSaber(ph, sim, p, () => { tab = 'hacer'; draw(); });
    if (tab === 'hacer') phaseHacer(ph, sim, p, () => { tab = 'demostrar'; draw(); });
    if (tab === 'demostrar') phaseDemo(ph, sim, p);
  };
  draw();
}

function phaseSaber(el, sim, p, next) {
  const s = sim.saber;
  el.innerHTML = `
    <div class="card capsule">
      <div class="cap-head"><h3>Micro-cápsula</h3><span class="chip">⏱ &lt; 5 min</span></div>
      <div class="flowbox">
        <div class="flow-banner">⚡ ${esc(s.banner)}</div>
        <div class="flowrow">${s.flow.map((f, i) => `${i ? '<span class="farrow"></span>' : ''}<div class="fnode ${f.hl ? 'hl' : ''}"><b>${esc(f.t)}</b><small>${esc(f.s)}</small></div>`).join('')}</div>
        <div class="flow-foot">${esc(s.foot)}</div>
      </div>
      <ul class="capbullets">${s.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <div class="mission">🎯 <b>Tu misión:</b> ${esc(sim.brief)}</div>
    </div>
    <div class="card"><h3>✅ Comprueba que lo entendiste</h3><p class="quiz-q">${esc(s.check.q)}</p>
      <div class="opts" id="sopts">${shuffle(s.check.o.map((_, i) => i)).map(i => `<button class="opt" data-i="${i}">${esc(s.check.o[i])}</button>`).join('')}</div><div id="sfb"></div></div>`;
  $$('#sopts .opt').forEach(b => b.onclick = () => {
    const ok = +b.dataset.i === s.check.a;
    if (!ok) { b.classList.add('wrong'); b.disabled = true; $('#sfb').innerHTML = `<div class="fb bad">✘ Revisa la micro-cápsula: ${esc(s.check.fb)}</div>`; return; }
    b.classList.add('right'); $$('#sopts .opt').forEach(x => x.disabled = true);
    const first = !p.saber; p.saber = true;
    if (first) { addXP(40, 'Micro-cápsula'); log('aprende', `${sim.title}: fase SABER completada`); }
    save();
    $('#sfb').innerHTML = `<div class="fb ok">✔ ${esc(s.check.fb)}</div><button class="btn primary" id="toHacer">Ir a 2. HACER →</button>`;
    $('#toHacer').onclick = next;
  });
}

function phaseHacer(el, sim, p, next) {
  if (!p.kit) {
    const items = shuffle(sim.kit.map((k, i) => ({ ...k, i })));
    el.innerHTML = `
      <div class="card kitgame">
        <h3>🧰 Mini-juego · Arma tu kit</h3>
        <p class="muted">Toca solo lo que necesitas para este trabajo. ¡Cuidado con las trampas!</p>
        <div class="kitlist">${items.map(k => `<button class="kititem" data-i="${k.i}"><span class="kbox"></span><span><b>${esc(k.name)}</b><small>${esc(k.code)}</small></span><em></em></button>`).join('')}</div>
        <div id="kfb"></div>
        <button class="btn primary" id="kcheck">Revisar kit</button>
      </div>`;
    $$('.kititem', el).forEach(b => b.onclick = () => { if (!b.classList.contains('locked')) b.classList.toggle('sel'); });
    $('#kcheck').onclick = () => {
      let bad = 0;
      $$('.kititem', el).forEach(b => {
        const k = sim.kit[+b.dataset.i], sel = b.classList.contains('sel');
        b.classList.remove('good', 'trap', 'miss');
        const em = $('em', b);
        if (sel && k.ok) { b.classList.add('good'); em.textContent = '✓'; }
        else if (sel && !k.ok) { b.classList.add('trap'); em.textContent = k.why; bad++; }
        else if (!sel && k.ok) { b.classList.add('miss'); em.textContent = 'Faltó: ' + k.why; bad++; }
        else em.textContent = '';
      });
      if (!bad) {
        p.kit = true; addXP(30, 'Kit completo'); save();
        $('#kfb').innerHTML = `<div class="fb ok">✔ ¡Kit completo! Tienes todo lo necesario y ninguna trampa.</div>`;
        $('#kcheck').textContent = 'Comenzar simulación →';
        $('#kcheck').onclick = () => phaseHacer(el, sim, p, next);
      } else {
        S.errors['kit-incorrecto'] = (S.errors['kit-incorrecto'] || 0) + 1; save();
        $('#kfb').innerHTML = `<div class="fb bad">✘ ${bad} elemento(s) por corregir: en rojo lo que sobra, en ámbar lo que falta.</div>`;
      }
    };
    return;
  }
  el.innerHTML = `<div class="card simintro"><b>🔧 Práctica guiada.</b> La pieza que debes tocar parpadea en naranja y la herramienta sugerida se marca en la caja. Si te equivocas, la pieza se pone en rojo, pierdes una vida ❤ y te explica por qué.</div><div id="simbox"></div>`;
  runSim($('#simbox'), sim, { guided: true, onDone: r => {
    p.hacer = Math.max(p.hacer ?? 0, r.score);
    recordSim(sim, r, 'guiado');
    return { label: 'Ir a 3. DEMOSTRAR →', action: next };
  } });
}

function phaseDemo(el, sim, p) {
  el.innerHTML = `
    <div class="card demointro">
      <h3>🏅 Demuestra que puedes hacerlo solo</h3>
      <ul class="rules"><li>❤ 5 vidas: cada error resta 1; una violación de seguridad resta 2 y reprueba.</li><li>🙈 Sin pistas: no se resalta la pieza ni la herramienta.</li><li>⏱ Con cronómetro y calificación por rúbrica.</li></ul>
      ${p.demo != null ? `<p>Tu mejor resultado: <b>${p.demo}</b>/100</p>` : ''}
      <button class="btn primary" id="startDemo">Comenzar demostración</button>
    </div><div id="simbox"></div>`;
  $('#startDemo').onclick = () => {
    $('.demointro').remove();
    runSim($('#simbox'), sim, { guided: false, onDone: r => {
      p.demo = Math.max(p.demo ?? 0, r.score);
      recordSim(sim, r, 'evaluacion');
      return { label: 'Volver a los módulos', action: () => go('aprende') };
    } });
  };
}

function recordSim(sim, r, mode) {
  S.procs = S.procs || [];
  S.procs.push({ id: 'sim-' + sim.id, day: S.day, score: r.score, passed: r.passed, mode, errors: r.errors, violations: r.violations, secs: r.secs });
  r.errors.forEach(t => S.errors[t] = (S.errors[t] || 0) + 1);
  const k = mode === 'guiado' ? 0.25 : 0.45;
  sim.comps.forEach(c => { const m = S.mastery[c]; touch(c, m + (r.score - m) * k + (r.passed ? 4 : 0), r.passed ? 6 : 4); scheduleReviews(c, 'sim-' + sim.id); });
  log('simulación', `${sim.title} (${mode === 'guiado' ? 'HACER' : 'DEMOSTRAR'}): ${r.score}/100${r.violations.length ? ' · VIOLACIÓN DE SEGURIDAD' : ''}${r.out ? ' · sin vidas' : ''}`);
  addXP(r.score * (mode === 'guiado' ? 0.8 : 1.5), mode === 'guiado' ? 'Práctica guiada' : 'Demostración');
  if (mode === 'evaluacion' && r.passed && !r.errors.length) badge('manos_expertas');
  if (mode === 'evaluacion' && r.passed && sim.mode === 'ev') badge('guardian_av');
  save();
}

/* ---------- Motor de la simulación ---------- */
function runSim(box, sim, { guided, onDone }) {
  const sc = SIM_SCENES[sim.scene];
  const flat = [];
  sim.steps.forEach((stp, si) => stp.actions.forEach((a, ai) => flat.push({ ...a, si, ai })));
  const MAXH = 5;
  box.innerHTML = `
    <div class="simwrap ${guided ? 'guided' : 'exam'}">
      <div class="sim-top">
        <div class="hearts" id="hearts"></div>
        <span class="chip ${guided ? 'blue' : 'orange'}">${guided ? '🧭 Práctica guiada' : '🎓 Demostración · sin pistas'}</span>
        <span class="chip timer" id="timer">⏱ 0:00</span>
      </div>
      <div class="stepper" id="stepper"></div>
      <div class="sim-grid">
        <div class="stage" id="stage">
          <canvas id="scv"></canvas>
          <div class="reading" id="reading" hidden></div>
          <div class="inhand" id="inhand">✋ Sin herramienta</div>
          <div class="stage-msg" id="smsg" hidden></div>
          <div class="vtools"><button class="vt" data-a="in" title="Acercar">＋</button><button class="vt" data-a="out" title="Alejar">－</button><button class="vt" data-a="reset" title="Vista inicial">⟲</button><button class="vt" data-a="full" title="Pantalla completa">⛶</button></div>
          <div class="stage-hint">Arrastra para girar · rueda o pellizco para acercar · toca una pieza</div>
          <div class="overlay" id="ovl" hidden></div>
        </div>
        <div class="sim-side">
          <div class="taskcard" id="task"></div>
          <div class="traycard"><div class="tray-title">Caja de herramientas <small>toca para tomar</small></div><div class="simtray" id="tray"></div><div class="toolmini" id="toolmini"><span class="muted small">Toma una herramienta para ver para qué sirve.</span></div></div>
        </div>
      </div>
    </div>`;
  const cam = sc.cam;
  const scene = new E3D.Scene($('#scv', box), { hideInternal: false, xray: false, gridStep: sc.grid, shadowRect: sc.shadow, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, target: [...cam.target] });
  scene.setMeshes(sc.build());
  scene.labels = { ...sim.parts };
  scene.tags = { ...(sim.tags || {}) };
  (sim.initial || []).forEach(x => scene.setPart(x.id, { ...x, instant: true }));
  cleanup.push(() => scene.destroy());

  const st = { idx: 0, tool: null, hearts: MAXH, errors: [], violations: [], stepErr: sim.steps.map(() => 0), phase: 'act', ppe: false, safe: false, start: Date.now(), over: false, timers: [] };
  const tick = setInterval(() => { const s = round((Date.now() - st.start) / 1000); const t = $('#timer', box); if (t && !st.over) t.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 1000);
  cleanup.push(() => { clearInterval(tick); st.timers.forEach(clearInterval); });
  const stage = $('#stage', box);
  const pname = k => sim.parts[k] || COMPONENTS[k]?.name || k;

  $$('.vt', box).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'in') scene.zoom(0.85);
    if (a === 'out') scene.zoom(1.18);
    if (a === 'reset') { scene.yaw = cam.yaw; scene.pitch = cam.pitch; scene.dist = cam.dist; scene.target = [...cam.target]; }
    if (a === 'full') { try { document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); } catch (e) { toast('Pantalla completa no disponible aquí'); } }
  });

  // --- caja de herramientas ---
  $('#tray', box).innerHTML = sim.tray.map(k => `<button class="stool" data-k="${k}" title="${esc(TOOLS[k].name)}"><span>${TOOLS[k].icon}</span><small>${esc(TOOLS[k].short)}</small></button>`).join('');
  $$('.stool', box).forEach(b => b.onclick = () => {
    if (st.over) return;
    st.tool = st.tool === b.dataset.k ? null : b.dataset.k;
    drawTray();
    const t = TOOLS[st.tool];
    $('#inhand', box).innerHTML = t ? `En mano: ${t.icon} <b>${esc(t.name)}</b>` : '✋ Sin herramienta';
    $('#scv', box).classList.toggle('armed', !!t);
    $('#toolmini', box).innerHTML = t ? `<div class="tm-head"><span>${t.icon}</span><div><b>${esc(t.name)}</b><small>${esc(t.cat)}</small></div><button class="btn sm ghost" id="tmf">Ficha</button></div><p>${esc(t.desc)}</p><div class="warnbox sm">⚠ ${esc(t.seguridad)}</div>` : '<span class="muted small">Sin herramienta en mano.</span>';
    if (t) $('#tmf', box).onclick = () => openModal(toolSheet(st.tool));
    drawAction();
  });
  function drawTray() {
    const a = flat[st.idx];
    $$('.stool', box).forEach(b => {
      b.classList.toggle('on', b.dataset.k === st.tool);
      b.classList.toggle('suggest', guided && !st.over && a && st.phase === 'act' && a.tool === b.dataset.k && st.tool !== a.tool);
    });
  }

  // --- HUD ---
  function drawHearts(lost) {
    $('#hearts', box).innerHTML = Array.from({ length: MAXH }, (_, i) => `<span class="hrt ${i < st.hearts ? 'hfull' : 'hempty'} ${lost && i >= st.hearts && i < st.hearts + lost ? 'hlost' : ''}">${i < st.hearts ? '❤' : '♡'}</span>`).join('');
  }
  function drawStepper() {
    const cur = flat[st.idx]?.si ?? sim.steps.length;
    $('#stepper', box).innerHTML = sim.steps.map((s, i) => `<div class="sstep ${i < cur ? 'done' : i === cur ? 'cur' : ''} ${st.stepErr[i] ? 'haserr' : ''}">
      <span class="sn">${i < cur ? '✓' : i + 1}</span><span class="stt">${esc(s.title)}</span>${st.stepErr[i] ? `<span class="se">${st.stepErr[i]}✘</span>` : ''}</div>`).join('<i class="sline"></i>');
  }
  function stageMsg(kind, html, ms = 1800) {
    const m = $('#smsg', box); if (!m) return;
    m.className = 'stage-msg ' + kind; m.innerHTML = html; m.hidden = false;
    clearTimeout(m._t); m._t = setTimeout(() => { m.hidden = true; }, ms);
  }

  // --- tarjeta de la acción actual ---
  function drawTask() {
    const a = flat[st.idx], stp = sim.steps[a.si];
    scene.hint = guided && a.part && a.part !== 'self' ? a.part : null;
    const text = !guided && a.orderMsg ? 'Continúa con la secuencia correcta.' : a.text;
    $('#task', box).innerHTML = `
      <div class="tk-head"><span class="eyebrow">Paso ${a.si + 1} de ${sim.steps.length} · ${esc(stp.title)}</span><span class="tk-sub">Acción ${a.ai + 1}/${stp.actions.length}</span></div>
      <div class="tk-dots">${stp.actions.map((_, i) => `<i class="${i < a.ai ? 'd' : i === a.ai ? 'c' : ''}"></i>`).join('')}</div>
      <p class="tk-text">${esc(text)}</p>
      ${guided && a.hint ? `<p class="tk-hint">💡 ${esc(a.hint)}</p>` : ''}
      <div id="az"></div><div id="afb"></div>`;
    drawAction(); drawTray(); drawStepper();
  }
  function drawAction() {
    const az = $('#az', box); if (!az || st.over) return;
    const a = flat[st.idx];
    if (st.phase === 'act') {
      if (a.wait) { az.innerHTML = `<button class="btn primary" id="wbtn">⏱ Iniciar espera</button>`; $('#wbtn', box).onclick = () => { st.phase = 'wait'; drawAction(); }; }
      else if (a.part === 'self') { az.innerHTML = `<button class="btn" id="selfb" ${st.tool ? '' : 'disabled'}>🙋 Usar ${st.tool ? esc(TOOLS[st.tool].short.toLowerCase()) : 'herramienta'} en mí</button>`; const sb = $('#selfb', box); if (sb) sb.onclick = () => onSelf(); }
      else az.innerHTML = `<p class="small muted">${st.tool ? `Tienes ${TOOLS[st.tool].icon} en la mano: toca la pieza en el modelo.` : 'Toma una herramienta de la caja.'}</p>`;
    }
    if (st.phase === 'choice') {
      const c = a.choice;
      az.innerHTML = `<p class="q"><b>${esc(c.q)}</b></p><div class="opts">${shuffle(c.o.map((_, i) => i)).map(i => `<button class="opt" data-i="${i}">${esc(c.o[i])}</button>`).join('')}</div>`;
      $$('.opt', az).forEach(b => b.onclick = () => {
        if (+b.dataset.i === c.a) { b.classList.add('right'); $$('.opt', az).forEach(x => x.disabled = true); complete(); }
        else { b.classList.add('wrong'); b.disabled = true; fail(a.part, c.fb, false, 'proc-respuesta-incorrecta'); }
      });
    }
    if (st.phase === 'input') {
      const inp = a.input;
      az.innerHTML = `<label class="inp"><span>${esc(inp.label)}</span><span class="row"><input type="number" step="0.5" id="vin" inputmode="decimal" placeholder="0"><em>${inp.unit}</em><button class="btn primary" id="vok">Aplicar</button></span></label>
        <p class="small muted">${guided ? `Especificación: ${inp.value} ${inp.unit}` : 'Escribe la especificación correcta.'}</p>`;
      const go2 = () => {
        const v = parseFloat($('#vin', box).value);
        if (Math.abs(v - inp.value) <= inp.tol) complete();
        else fail(a.part, isNaN(v) ? 'Escribe un valor de torque.' : `${v} ${inp.unit} está fuera de especificación. ${v < inp.value ? 'Poco apriete: la conexión se afloja o se calienta.' : 'Demasiado apriete: puedes barrer la rosca o dañar la pieza.'}`, false, 'proc-torque-incorrecto');
      };
      $('#vok', box).onclick = go2; $('#vin', box).onkeydown = e => { if (e.key === 'Enter') go2(); };
      $('#vin', box).focus();
    }
    if (st.phase === 'wait') {
      let left = a.wait;
      az.innerHTML = `<div class="waitbox"><div class="progress big"><i id="wbar" style="width:0%"></i></div><b id="wleft">${left} s</b></div>`;
      const iv = setInterval(() => {
        left--; const b = $('#wbar', box); if (!b) return clearInterval(iv);
        b.style.width = ((a.wait - left) / a.wait * 100) + '%'; $('#wleft', box).textContent = left > 0 ? `${left} s` : 'Listo ✓';
        if (left <= 0) { clearInterval(iv); complete(); }
      }, 1000);
      st.timers.push(iv);
    }
  }

  // --- interacción ---
  scene.onPick = k => onPart(k);
  window.__simPick = k => onPart(k); // gancho para pruebas automatizadas
  function onSelf() {
    const a = flat[st.idx];
    if (st.phase !== 'act' || st.over) return;
    if (a.part === 'self' && st.tool === a.tool) return success('self');
    fail(null, guided ? `Para este paso necesitas ${TOOLS[a.tool].icon} ${TOOLS[a.tool].name}.` : 'Herramienta incorrecta.', false, 'proc-herramienta-incorrecta');
  }
  function onPart(k) {
    if (st.over) return;
    const a = flat[st.idx];
    if (st.phase !== 'act') { stageMsg('info', `<b>${esc(pname(k))}</b>`); return; }
    if (!st.tool) { stageMsg('info', `<b>${esc(pname(k))}</b> · toma primero una herramienta`); return; }
    if (a.traps && a.traps[k]) { const tr = a.traps[k]; return fail(k, tr.msg, tr.safety, tr.tag || 'proc-orden-incorrecto'); }
    const hv = sim.hvParts || [];
    if (hv.includes(k)) {
      if (['manual', 'cinta'].includes(st.tool)) return fail(k, 'Usaste herramienta NO aislada en un componente de alto voltaje.', true, 'herramienta-no-aislada-av');
      if (!st.ppe) return fail(k, 'Tocaste un componente de alto voltaje sin guantes dieléctricos.', true, 'av-sin-epp');
      if (!st.safe && (sim.unsafeUntilVerified || []).includes(k)) return fail(k, 'Intentaste abrir o intervenir el inversor sin verificar 0 V.', true, 'intervenir-av-sin-verificar');
    }
    if (k === a.part) {
      if (st.tool === a.tool) return success(k);
      if (a.toolTraps && a.toolTraps[st.tool]) return fail(k, a.toolTraps[st.tool], false, 'reparacion-provisional');
      return fail(k, guided ? `${TOOLS[st.tool].name} no sirve para esto. Usa ${TOOLS[a.tool].icon} ${TOOLS[a.tool].name}.` : 'Herramienta incorrecta para esta acción.', false, 'proc-herramienta-incorrecta');
    }
    const later = flat.findIndex((x, j) => j > st.idx && x.part === k);
    if (later > -1) return fail(k, a.orderMsg || (guided ? `Todavía no. Primero: ${a.text}` : 'Todavía no: hay otra acción antes.'), false, 'proc-orden-incorrecto');
    stageMsg('info', `<b>${esc(pname(k))}</b> · no es parte de esta acción`);
  }
  function fail(k, msg, safety, tag) {
    const a = flat[st.idx];
    const lost = Math.min(st.hearts, safety ? 2 : 1);
    st.hearts -= lost;
    st.errors.push(tag); if (safety) st.violations.push(tag);
    st.stepErr[a.si]++;
    if (k && k !== 'self') scene.flash(k, '#ef4444', 1100);
    stage.classList.remove('err'); void stage.offsetWidth; stage.classList.add('err');
    if (safety) { stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 600); }
    stageMsg(safety ? 'bad crit' : 'bad', `${safety ? '⚠ VIOLACIÓN DE SEGURIDAD' : '✘ Error'}${k && k !== 'self' ? ` · ${esc(pname(k))}` : ''}`, 1600);
    $('#afb', box).innerHTML = `<div class="fb ${safety ? 'critical' : 'bad'}">${safety ? '⚠ <b>Seguridad:</b> ' : '✘ '}${esc(msg)} <span class="lifel">−${lost} ❤</span></div>`;
    drawHearts(lost); drawStepper();
    if (st.hearts <= 0) gameOver();
  }
  function success(k) {
    const a = flat[st.idx];
    if (k !== 'self') { scene.flash(k, '#22c55e', 700); scene.fx(k, TOOLS[a.tool].icon); }
    if (a.ppe) st.ppe = true;
    if (a.choice) { st.phase = 'choice'; $('#afb', box).innerHTML = ''; drawAction(); drawTray(); return; }
    if (a.input) { st.phase = 'input'; $('#afb', box).innerHTML = `<div class="fb ok">✔ Herramienta y pieza correctas. Ahora el valor.</div>`; drawAction(); drawTray(); return; }
    complete();
  }
  function complete() {
    const a = flat[st.idx];
    (a.anim || []).forEach(x => scene.setPart(x.id, x));
    if (a.setsSafe) st.safe = true;
    if (a.reading) {
      const r = $('#reading', box); r.hidden = false; r.className = 'reading ' + a.reading.status;
      r.innerHTML = `<small>${a.tool ? `${TOOLS[a.tool].icon} ${esc(TOOLS[a.tool].name)}` : 'Lectura'}</small><b>${esc(a.reading.text)}</b>`;
    }
    stageMsg('ok', '✔ ¡Bien!', 900);
    $('#afb', box).innerHTML = `<div class="fb ok">✔ ${esc(a.reading ? a.reading.text : 'Correcto.')}</div>`;
    st.phase = 'done';
    scene.hint = null; drawTray();
    const t = setTimeout(() => {
      if (st.over) return;
      st.idx++;
      if (st.idx >= flat.length) return finish(false);
      st.phase = 'act'; drawTask();
    }, a.reading ? 1300 : 800);
    cleanup.push(() => clearTimeout(t));
  }
  function result(out) {
    const n = st.errors.length - st.violations.length;
    let score = Math.max(0, round(100 - n * 8 - st.violations.length * 25));
    if (out) score = Math.min(score, 40);
    if (st.violations.length) score = Math.min(score, 59);
    return { score, passed: !out && score >= 70 && !st.violations.length, errors: [...st.errors], violations: [...st.violations], secs: round((Date.now() - st.start) / 1000), hearts: st.hearts, out };
  }
  function gameOver() { finish(true); }
  function finish(out) {
    st.over = true; scene.hint = null; drawTray(); drawStepper();
    const r = result(out);
    const nxt = onDone(r) || {};
    const stars = r.passed ? (r.score >= 90 ? 3 : r.score >= 80 ? 2 : 1) : 0;
    const ov = $('#ovl', box);
    ov.hidden = false;
    ov.innerHTML = `<div class="ovcard ${r.passed ? 'pass' : 'fail'}">
      <div class="ovicon">${out ? '💔' : r.passed ? '🏆' : '⚠'}</div>
      <h2>${out ? 'Te quedaste sin vidas' : r.passed ? '¡Proceso completado!' : r.violations.length ? 'Completado con violación de seguridad' : 'Completado, pero con muchos errores'}</h2>
      <div class="stars">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
      <div class="ovscore"><b>${r.score}</b><span>/100</span></div>
      <div class="ovstats"><div><span>Tiempo</span><b>${Math.floor(r.secs / 60)}:${String(r.secs % 60).padStart(2, '0')}</b></div><div><span>Errores</span><b>${r.errors.length}</b></div><div><span>Seguridad</span><b class="${r.violations.length ? 'bad' : ''}">${r.violations.length}</b></div><div><span>Vidas</span><b>${r.hearts}❤</b></div></div>
      ${r.errors.length ? `<div class="ovtags">${[...new Set(r.errors)].map(t => `<span class="tag ${r.violations.includes(t) ? 'bad' : ''}">${esc(ERROR_LABELS[t] || t)}</span>`).join('')}</div>` : ''}
      <div class="row center-row"><button class="btn ghost" id="retry">↻ Repetir</button>${r.passed || !out ? `<button class="btn primary" id="nextb">${esc(nxt.label || 'Continuar')}</button>` : ''}</div>
    </div>`;
    $('#retry', box).onclick = () => { cleanup.forEach(f => f()); cleanup = []; runSim(box, sim, { guided, onDone }); };
    const nb = $('#nextb', box); if (nb) nb.onclick = () => (nxt.action ? nxt.action() : go('aprende'));
  }

  drawHearts(0); drawTask();
}

/* =========================================================
   SEÑALA LA PIEZA — identificar cada pieza/herramienta del
   proceso en el modelo 3D (3 intentos; al tercero se muestra)
   ========================================================= */
function viewSenala(el, id) {
  const pr = SENALA.find(p => p.id === id);
  if (!pr) {
    el.innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Práctica · reconocimiento de piezas</span><h1>Señala la pieza</h1>
        <p class="muted">Aprende un proceso completo reconociendo cada pieza y herramienta en el orden en que se usan.</p></div></div>
      <div class="howto card">
        <div><span>1</span><b>Lee la instrucción</b><small>«Señala la bujía», «Señala el borne negativo»…</small></div>
        <div><span>2</span><b>Toca la pieza en el modelo 3D</b><small>Gíralo y acércalo para encontrarla.</small></div>
        <div><span>3</span><b>Tienes 3 intentos</b><small>Cada error se marca en rojo y te dice qué tocaste. Al tercero, el modelo te muestra la pieza.</small></div>
      </div>
      <div class="modgrid">${SENALA.map(p => {
        const last = (S.procs || []).filter(x => x.id === 'senala-' + p.id).slice(-1)[0];
        return `<a class="card modcard" href="#/senala/${p.id}">
          <div class="mc-top"><span class="modcode">SEÑALA LA PIEZA</span><span class="chip">⏱ ${p.min} min</span></div>
          <h3>${p.icon} ${esc(p.title)}</h3><p class="muted small">${esc(p.subtitle)} · ${p.steps.length} pasos</p>
          <p class="small">${esc(p.intro.split('. ')[0])}.</p>
          ${last ? `<p class="small">Último resultado: <b>${last.score}</b>/100</p>` : '<span class="chip orange">Nuevo</span>'}
        </a>`; }).join('')}</div>`;
    return;
  }
  runSenala(el, pr);
}

function runSenala(el, pr) {
  const sc = SENALA_SCENES[pr.scene] || SIM_SCENES[pr.scene];
  const N = pr.steps.length;
  el.innerHTML = `
    <div class="modhead card">
      <button class="backbtn" onclick="go(currentModel() ? 'practicar' : 'senala')" aria-label="Volver">←</button>
      <div><span class="modcode">SEÑALA LA PIEZA · ${N} PASOS</span><h1>${pr.icon} ${esc(pr.title)}</h1><small class="muted">${esc(pr.subtitle)}</small></div>
    </div>
    <div class="idwrap">
      <div class="id-top"><span class="chip" id="idStep">Paso 1 de ${N}</span><div class="progress"><i id="idProg" style="width:0%"></i></div><span class="chip orange" id="idPts">⭐ 0</span></div>
      <div class="id-prompt" id="idPrompt"></div>
      <div class="id-body">
      <aside class="tl" id="tl" aria-label="Línea del tiempo del proceso">
        <div class="tl-head">Línea del tiempo</div>
        <button class="tl-more" id="tlTop" type="button"></button>
        <div class="tl-view" id="tlView" tabindex="0"><ol class="tl-track" id="tlTrack"></ol></div>
        <button class="tl-more" id="tlBot" type="button"></button>
        <button class="tl-now" id="tlNow" type="button" hidden>⤵ Ir al paso actual</button>
      </aside>
      <div class="stage id-stage" id="stage">
        <canvas id="scv"></canvas>
        <div class="reading" id="reading" hidden></div>
        <div class="stage-msg" id="smsg" hidden></div>
        <div class="vtools"><button class="vt" data-a="in" title="Acercar">＋</button><button class="vt" data-a="out" title="Alejar">－</button><button class="vt" data-a="reset" title="Vista inicial">⟲</button><button class="vt" data-a="full" title="Pantalla completa">⛶</button></div>
        <div class="stage-hint">Arrastra para girar · pellizca para acercar</div>
        <div class="overlay" id="ovl" hidden></div>
      </div>
      </div>
      <div id="idFb"></div>
    </div>`;
  const cam = sc.cam;
  const scene = new E3D.Scene($('#scv'), { hideInternal: false, xray: false, gridStep: sc.grid, shadowRect: sc.shadow, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, target: [...cam.target] });
  scene.setMeshes(sc.build());
  scene.labels = {};                       // sin etiquetas al pasar el cursor: hay que reconocer la pieza
  scene.tags = { ...(sc.tags || {}) };
  (sc.initial || []).forEach(x => scene.setPart(x.id, { ...x, instant: true }));
  cleanup.push(() => scene.destroy());
  const stage = $('#stage');
  $$('.vt', stage).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'in') scene.zoom(0.85);
    if (a === 'out') scene.zoom(1.18);
    if (a === 'reset') { scene.yaw = cam.yaw; scene.pitch = cam.pitch; scene.dist = cam.dist; scene.target = [...cam.target]; }
    if (a === 'full') { try { document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); } catch (e) { toast('Pantalla completa no disponible aquí'); } }
  });
  const nm = k => pr.names[k] || k;
  const st = { i: 0, att: 0, revealed: false, pts: 0, phase: 'intro', res: [], errors: [], start: 0 };

  function msg(kind, html, ms = 1700) {
    const m = $('#smsg'); m.className = 'stage-msg ' + kind; m.innerHTML = html; m.hidden = false;
    clearTimeout(m._t); m._t = setTimeout(() => { m.hidden = true; }, ms);
  }
  // Línea del tiempo vertical: muestra pasos anteriores, el actual y los siguientes, y se desplaza al avanzar
  $('#tlTrack').innerHTML = pr.steps.map((s, k) => `<li class="tl-item" data-k="${k}"><span class="tl-dot">${k + 1}</span><div class="tl-txt"><b>${esc(s.short || s.say)}</b><small></small></div></li>`).join('');
  // La línea del tiempo se puede recorrer con scroll; al avanzar vuelve sola al paso actual
  const tlGeom = () => { const mobile = matchMedia('(max-width: 820px)').matches; return { side: mobile ? 1 : 2, H: mobile ? 54 : 64 }; };
  let tlFirst = true;
  function tlIndicators() {
    const view = $('#tlView'); if (!view) return;
    const { H } = tlGeom();
    const above = Math.round(view.scrollTop / H);
    const below = Math.max(0, N - Math.round((view.scrollTop + view.clientHeight) / H));
    $('#tlTop').textContent = above ? `↑ ${above} paso${above > 1 ? 's' : ''} antes` : '';
    $('#tlBot').textContent = below ? `↓ ${below} paso${below > 1 ? 's' : ''} más` : '';
    $('#tlTop').disabled = !above; $('#tlBot').disabled = !below;
    const curTop = st.i * H;
    $('#tlNow').hidden = curTop >= view.scrollTop - 2 && curTop + H <= view.scrollTop + view.clientHeight + 2;
  }
  function tlScrollToCurrent(smooth = true) {
    const view = $('#tlView'); if (!view) return;
    const { side, H } = tlGeom();
    view.scrollTo({ top: Math.max(0, (st.i - side) * H), behavior: smooth ? 'smooth' : 'auto' });
  }
  function drawList() {
    const { side, H } = tlGeom();
    const view = $('#tlView'); if (!view) return;
    view.style.height = (H * (side * 2 + 1)) + 'px';
    $$('#tlTrack .tl-item').forEach(li => {
      const k = +li.dataset.k, r = st.res[k], d = Math.abs(k - st.i);
      li.style.height = H + 'px';
      li.className = 'tl-item ' + (r ? 'done' : k === st.i ? 'cur' : 'todo') + (r && r.revealed ? ' shown' : '') + (k === st.i && st.att ? ' err' : '');
      li.style.opacity = r || d === 0 ? 1 : d === 1 ? 0.85 : 0.6;
      $('.tl-dot', li).textContent = r ? (r.revealed ? '!' : '✓') : k + 1;
      $('small', li).textContent = r ? (r.revealed ? 'Te la mostramos' : r.att === 0 ? '1er intento' : `${r.att + 1} intentos`)
        : k === st.i ? (st.revealed ? 'Pieza mostrada' : `Ahora · intento ${Math.min(st.att + 1, 3)} de 3`)
        : k === st.i + 1 ? 'Siguiente' : `Paso ${k + 1}`;
    });
    if (st.lastTl !== st.i) { st.lastTl = st.i; tlScrollToCurrent(!tlFirst); tlFirst = false; }
    tlIndicators();
  }
  $('#tlView').addEventListener('scroll', tlIndicators, { passive: true });
  $('#tlTop').onclick = () => $('#tlView').scrollBy({ top: -tlGeom().H * 2, behavior: 'smooth' });
  $('#tlBot').onclick = () => $('#tlView').scrollBy({ top: tlGeom().H * 2, behavior: 'smooth' });
  $('#tlNow').onclick = () => tlScrollToCurrent(true);
  const onResize = () => { st.lastTl = -1; drawList(); };
  window.addEventListener('resize', onResize);
  cleanup.push(() => window.removeEventListener('resize', onResize));
  function drawPrompt() {
    const s = pr.steps[st.i];
    $('#idStep').textContent = `Paso ${st.i + 1} de ${N}`;
    $('#idProg').style.width = (st.i / N * 100) + '%';
    $('#idPts').textContent = `⭐ ${st.pts}`;
    $('#idPrompt').innerHTML = `
      <span class="id-num">${st.i + 1}</span>
      <div class="id-say"><b>${esc(s.say)}</b>
        <div class="tries">${[0, 1, 2].map(k => `<i class="${k < st.att ? 'used' : ''}">${k < st.att ? '✕' : ''}</i>`).join('')}<small>${st.revealed ? 'Pieza mostrada: tócala para continuar' : `Intento ${Math.min(st.att + 1, 3)} de 3`}</small></div>
      </div>`;
    drawList();
  }
  function onPick(k) {
    if (st.phase !== 'pick') { if (st.phase !== 'intro') msg('info', `<b>${esc(nm(k))}</b>`); return; }
    const s = pr.steps[st.i];
    if (k === s.target) return correct();
    if (st.revealed) { msg('info', `Eso es: <b>${esc(nm(k))}</b>. Toca la pieza marcada en naranja.`); return; }
    st.att++;
    st.errors.push('identificacion-incorrecta');
    scene.flash(k, '#ef4444', 1100); scene.fx(k, '❌');
    stage.classList.remove('err'); void stage.offsetWidth; stage.classList.add('err');
    msg('bad', `✘ Eso es: ${esc(nm(k))}`);
    if (st.att >= 3) {
      st.revealed = true;
      scene.hint = s.target; scene.labels = { ...scene.labels, [s.target]: nm(s.target) };
      $('#idFb').innerHTML = `<div class="fb reveal">👀 <b>Esta es la pieza: ${esc(nm(s.target))}.</b> Te la marcamos en naranja. Tócala para continuar.<br><small>${esc(s.hint)}</small></div>`;
    } else {
      $('#idFb').innerHTML = `<div class="fb bad">✘ Tocaste <b>${esc(nm(k))}</b>. Esa no es. ${st.att === 2 ? `<br>💡 <b>Pista:</b> ${esc(s.hint)}` : 'Intenta de nuevo.'}</div>`;
    }
    drawPrompt();
  }
  function correct() {
    const s = pr.steps[st.i];
    const got = st.revealed ? 0 : 3 - st.att;
    st.pts += got;
    st.res[st.i] = { att: st.att, revealed: st.revealed };
    scene.hint = null;
    scene.flash(s.target, '#22c55e', 900);
    scene.labels = { ...scene.labels, [s.target]: nm(s.target) };
    msg('ok', st.revealed ? `Ahí está: ${esc(nm(s.target))}` : `✔ ¡Correcto! +${got} ⭐`);
    if (s.question) { st.phase = 'question'; return drawQuestion(); }
    learn();
  }
  function drawQuestion() {
    const q = pr.steps[st.i].question;
    $('#idFb').innerHTML = `<div class="fb ok">✔ <b>${esc(nm(pr.steps[st.i].target))}</b>. Antes de seguir:</div>
      <div class="card idq"><p><b>${esc(q.q)}</b></p><div class="opts">${shuffle(q.o.map((_, k) => k)).map(k => `<button class="opt" data-k="${k}">${esc(q.o[k])}</button>`).join('')}</div></div>`;
    $$('.idq .opt').forEach(b => b.onclick = () => {
      if (+b.dataset.k === q.a) { learn(q.fb); }
      else { b.classList.add('wrong'); b.disabled = true; st.errors.push('proc-respuesta-incorrecta'); msg('bad', '✘ Respuesta incorrecta'); }
    });
  }
  function learn(extra) {
    const s = pr.steps[st.i];
    st.phase = 'learn';
    (s.anim || []).forEach(x => scene.setPart(x.id, x));
    if (s.reading) { const r = $('#reading'); r.hidden = false; r.className = 'reading ' + s.reading.status; r.innerHTML = `<small>Resultado</small><b>${esc(s.reading.text)}</b>`; }
    const last = st.i === N - 1;
    $('#idFb').innerHTML = `<div class="learncard">
      <div class="lc-head">✔ ${esc(nm(s.target))}</div>
      <p>${esc(s.learn)}</p>${extra ? `<p class="small">💡 ${esc(extra)}</p>` : ''}
      <button class="btn primary" id="idNext">${last ? 'Ver resultado' : 'Siguiente paso →'}</button></div>`;
    $('#idNext').onclick = () => {
      if (last) return finish();
      st.i++; st.att = 0; st.revealed = false; st.phase = 'pick';
      $('#idFb').innerHTML = ''; drawPrompt();
    };
    drawList();
    $('#idNext').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function finish() {
    st.phase = 'done';
    $('#idProg').style.width = '100%';
    const max = N * 3, score = round(st.pts / max * 100);
    const shown = pr.steps.filter((_, k) => st.res[k]?.revealed);
    const first = st.res.filter(r => r && !r.revealed && r.att === 0).length;
    const passed = score >= 70;
    const stars = score >= 90 ? 3 : score >= 75 ? 2 : score >= 55 ? 1 : 0;
    const secs = round((Date.now() - st.start) / 1000);
    S.procs = S.procs || [];
    S.procs.push({ id: 'senala-' + pr.id, day: S.day, score, passed, mode: 'identificacion', errors: [...st.errors], violations: [], secs });
    st.errors.forEach(t => S.errors[t] = (S.errors[t] || 0) + 1);
    pr.comps.forEach(c => { const m = S.mastery[c]; touch(c, m + (score - m) * 0.25, 4); scheduleReviews(c, 'senala-' + pr.id); });
    log('señala', `${pr.title}: ${score}/100 · ${first}/${N} al primer intento`);
    addXP(score * 0.9, 'Señala la pieza');
    save();
    const ov = $('#ovl'); ov.hidden = false;
    ov.innerHTML = `<div class="ovcard ${passed ? 'pass' : 'fail'}">
      <div class="ovicon">${passed ? '🏆' : '📚'}</div>
      <h2>${passed ? '¡Proceso completado!' : 'Proceso completado: sigue practicando'}</h2>
      <div class="stars">${[1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('')}</div>
      <div class="ovscore"><b>${score}</b><span>/100</span></div>
      <div class="ovstats"><div><span>1er intento</span><b>${first}/${N}</b></div><div><span>Errores</span><b>${st.errors.length}</b></div><div><span>Mostradas</span><b>${shown.length}</b></div><div><span>Tiempo</span><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></div></div>
      ${shown.length ? `<p class="small"><b>Repasa:</b> ${shown.map(s => esc(nm(s.target))).join(', ')}</p>` : ''}
      <div class="row center-row"><button class="btn ghost" id="again">↻ Repetir</button><button class="btn primary" onclick="go('practicar')">Volver a los módulos</button></div>
    </div>`;
    $('#again').onclick = () => render();
  }
  scene.onPick = onPick;
  window.__simPick = onPick; // gancho para pruebas automatizadas

  // pantalla de inicio
  const ov = $('#ovl'); ov.hidden = false;
  ov.innerHTML = `<div class="ovcard intro"><div class="ovicon">${pr.icon}</div><h2>${esc(pr.title)}</h2><p>${esc(pr.intro)}</p>
    <ul class="rules"><li>👆 Toca la pieza en el modelo (gíralo para buscarla).</li><li>❌ Cada error se marca en rojo y te dice qué tocaste.</li><li>👀 Al tercer error, el modelo te muestra la pieza.</li></ul>
    <button class="btn primary" id="idStart">Comenzar</button></div>`;
  $('#idStart').onclick = () => { ov.hidden = true; st.phase = 'pick'; st.start = Date.now(); drawPrompt(); };
  drawPrompt();
}

/* =========================================================
   PRACTICAR — punto de entrada a todas las prácticas
   ========================================================= */
/* =========================================================
   PRACTICAR — garage de modelos (tipo videojuego) → módulos
   (grupos de función) → prácticas del módulo
   ========================================================= */
const currentModel = () => BUS_MODELS.find(m => m.id === S.bus) || null;
const powerMatch = (power, model) => power === 'all' || (power === 'ev' && model.power !== 'diesel') || (power === 'combustion' && model.power !== 'electrico');
function practicesFor(model, group) {
  return PRACTICE_CATALOG.filter(p => p.group === group && powerMatch(p.power, model)).map(p => {
    let title = '', min = 5, route = '', done = false, pct = 0, locked = false, steps = '';
    if (p.type === 'senala') { const x = SENALA.find(z => z.id === p.id); title = x.title; min = x.min; route = 'senala/' + x.id; steps = `${x.steps.length} pasos`; done = (S.procs || []).some(r => r.id === 'senala-' + x.id); }
    if (p.type === 'aprende') { const x = SIMS.find(z => z.id === p.id); title = x.title; min = x.min; route = 'aprende/' + x.id; steps = `${x.steps.length} pasos`; pct = simPct(simProg(x.id)); done = pct === 100; }
    if (p.type === 'taller') { const x = PROCEDURES.find(z => z.id === p.id); title = x.title; min = x.min; route = 'taller/' + x.id; steps = `${x.steps.length} tareas`; done = (S.procs || []).some(r => r.id === x.id && r.passed); locked = procLocked(x); }
    if (p.type === 'fallas') { const x = SCENARIOS.find(z => z.id === p.id); title = x.title; min = x.min; route = 'practica/' + x.id; steps = `${Object.keys(x.nodes).length} decisiones`; done = S.practice.some(r => r.id === x.id && r.passed); locked = scenarioLocked(x); }
    return { ...p, title, min, route, done, pct: done ? 100 : pct, locked, steps };
  }).sort((a, b) => PRACTICE_TYPES[a.type].order - PRACTICE_TYPES[b.type].order);
}
const busThumbs = {};
function busThumb(model) {
  if (busThumbs[model.id]) return busThumbs[model.id];
  try {
    const c = document.createElement('canvas'); c.width = 420; c.height = 230;
    const v = E3D.buildModel(model);
    const sc = new E3D.Scene(c, { manual: true, body: v.body, shadowRect: v.shadow, dist: v.dist * 0.92, yaw: 0.78, pitch: 0.26, target: [0, 1.55, 0] });
    sc.setMeshes(v.meshes);
    busThumbs[model.id] = sc.snapshot();
  } catch (e) { busThumbs[model.id] = ''; }
  return busThumbs[model.id];
}
function applyModelToScene(scene, model, mode) {
  const v = E3D.buildModel(model, mode);
  scene.setMeshes(v.meshes); scene.body = v.body; scene.shadowRect = v.shadow; scene.dist = v.dist; scene.target = [0, 1.6, 0];
  return v;
}

function viewPracticar(el, param) {
  if (param === 'elegir' || !currentModel()) return viewGarage(el);
  if (param && /^m\d$/.test(param)) return viewModule(el, +param.slice(1));
  viewModules(el);
}

function viewGarage(el) {
  let idx = Math.max(0, BUS_MODELS.findIndex(m => m.id === S.bus));
  const maxP = Math.max(...BUS_MODELS.map(m => FUNCTION_GROUPS.filter(g => g.available).reduce((s, g) => s + practicesFor(m, g.n).length, 0)));
  el.innerHTML = `
    <div class="garage">
      <div class="g-head"><span class="eyebrow">Paso 1 de 2 · Garage</span><h1>Elige tu autobús</h1>
        <p class="muted">Cada modelo tiene sus propios módulos de práctica. Usa las flechas, el teclado (← →) o toca una miniatura.</p></div>
      <div class="g-main">
        <div class="g-stage" id="gStage">
          <canvas id="gcv"></canvas>
          <button class="g-arrow l" id="gPrev" aria-label="Modelo anterior">‹</button>
          <button class="g-arrow r" id="gNext" aria-label="Modelo siguiente">›</button>
          <div class="g-count" id="gCount"></div>
          <div class="g-dots" id="gDots"></div>
        </div>
        <div class="g-info" id="gInfo"></div>
      </div>
      <div class="g-thumbs" id="gThumbs"></div>
      <p class="g-note">Modelos de referencia para el prototipo: formas y datos simplificados.</p>
    </div>`;
  const scene = new E3D.Scene($('#gcv'), { autoRotate: true, xray: false, pitch: 0.3, yaw: 0.8 });
  cleanup.push(() => scene.destroy());
  const show = (i, dir = 0) => {
    idx = (i + BUS_MODELS.length) % BUS_MODELS.length;
    const m = BUS_MODELS[idx];
    applyModelToScene(scene, m);
    scene.yaw = 0.8; scene.autoRotate = true;
    const groups = FUNCTION_GROUPS.filter(g => g.available);
    const nP = groups.reduce((s, g) => s + practicesFor(m, g.n).length, 0);
    const hv = m.power === 'electrico' ? 100 : m.power === 'hibrido' ? 60 : 0;
    const stat = (label, pct, val) => `<div class="g-stat"><span>${label}</span><div class="g-bar"><i style="width:${pct}%"></i></div><b>${val}</b></div>`;
    const info = $('#gInfo');
    info.innerHTML = `
      <div class="g-chips"><span class="chip">${esc(m.tipo)}</span><span class="chip ${m.power === 'diesel' ? 'orange' : 'blue'}">${POWER_LABEL[m.power]}</span></div>
      <h2>${esc(m.name)}</h2>
      <p>${esc(m.desc)}</p>
      <div class="g-stats">
        ${stat('Longitud', round(m.len / 18 * 100), `≈ ${m.len} m`)}
        ${stat('Alto voltaje', hv, hv === 100 ? 'Alto' : hv ? 'Medio' : 'No aplica')}
        ${stat('Prácticas', round(nP / maxP * 100), `${nP}`)}
        ${stat('Módulos', round(groups.length / FUNCTION_GROUPS.length * 100), `${groups.length} de ${FUNCTION_GROUPS.length}`)}
      </div>
      <button class="btn primary g-select" id="gSelect">▶ Seleccionar este autobús</button>
      ${S.bus === m.id ? '<p class="small muted g-current">✓ Es tu autobús actual</p>' : ''}`;
    info.classList.remove('slide-l', 'slide-r'); void info.offsetWidth; if (dir) info.classList.add(dir > 0 ? 'slide-r' : 'slide-l');
    $('#gSelect').onclick = () => { S.bus = m.id; log('práctica', `Eligió el autobús ${m.name}`); save(); toast(`🚌 ${m.name} seleccionado`); go('practicar'); };
    $('#gCount').textContent = `${idx + 1} / ${BUS_MODELS.length}`;
    $('#gDots').innerHTML = BUS_MODELS.map((_, k) => `<i class="${k === idx ? 'on' : ''}"></i>`).join('');
    $$('#gThumbs .g-thumb').forEach((t, k) => t.classList.toggle('on', k === idx));
    const on = $('#gThumbs .g-thumb.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  };
  $('#gThumbs').innerHTML = BUS_MODELS.map((m, k) => `<button class="g-thumb" data-k="${k}"><span class="g-img">${busThumb(m) ? `<img src="${busThumb(m)}" alt="">` : '🚌'}</span><b>${esc(m.name.replace('Volvo ', ''))}</b><small>${esc(m.tipo)} · ${POWER_LABEL[m.power]}</small>${S.bus === m.id ? '<em>Actual</em>' : ''}</button>`).join('');
  $$('#gThumbs .g-thumb').forEach(t => t.onclick = () => show(+t.dataset.k, +t.dataset.k > idx ? 1 : -1));
  $('#gPrev').onclick = () => show(idx - 1, -1);
  $('#gNext').onclick = () => show(idx + 1, 1);
  const onKey = e => { if (e.key === 'ArrowLeft') show(idx - 1, -1); if (e.key === 'ArrowRight') show(idx + 1, 1); if (e.key === 'Enter' && document.activeElement === document.body) $('#gSelect').click(); };
  document.addEventListener('keydown', onKey);
  cleanup.push(() => document.removeEventListener('keydown', onKey));
  show(idx);
}

function busBar(model, extra = '') {
  return `<div class="busbar card">
    <span class="bb-img">${busThumb(model) ? `<img src="${busThumb(model)}" alt="">` : '🚌'}</span>
    <div><span class="eyebrow">Tu autobús</span><b>${esc(model.name)}</b><small>${esc(model.tipo)} · ${POWER_LABEL[model.power]}</small></div>
    ${extra}<button class="btn ghost" onclick="go('practicar/elegir')">🔄 Cambiar autobús</button></div>`;
}

// práctica principal de cada módulo: el botón del módulo lleva directo a ella
function primaryPractice(model, n) {
  if (n === 2) return { route: 'senala/bujias', title: 'Cambio de bujía', type: 'senala' };
  if (n === 3) return { route: 'senala/bateria24', title: 'Reemplazo de batería', type: 'senala' };
  return null;
}
function viewModules(el) {
  const m = currentModel();
  const avail = FUNCTION_GROUPS.filter(g => g.available);
  el.innerHTML = `
    ${busBar(m)}
    <div class="page-head"><div><span class="eyebrow">Paso 2 de 2 · Módulos</span><h1>Elige un módulo</h1>
      <p class="muted">Organizados por grupo de función, como en la información de servicio. Por ahora están disponibles ${avail.map(g => `<b>${g.n} · ${esc(g.name)}</b>`).join(' y ')}; el resto se habilitará al escalar la plataforma.</p></div></div>
    <div class="fgrid">${FUNCTION_GROUPS.map(g => {
      const list = g.available ? practicesFor(m, g.n) : [];
      const done = list.filter(p => p.done).length;
      const sub = typeof g.sub === 'string' ? g.sub : g.sub[m.power];
      return `<button class="fcard ${g.available ? '' : 'locked'}" data-g="${g.n}" ${g.available ? '' : 'aria-disabled="true"'}>
        <span class="fnum">${g.n}</span>
        <span class="ficon">${g.icon}</span>
        <b>${esc(g.name)}</b><small>${esc(sub)}</small>
        ${g.available ? `<span class="fmain">${PRACTICE_TYPES[primaryPractice(m, g.n).type].icon} ${esc(primaryPractice(m, g.n).title)}</span>
          <div class="fprog"><div class="bar"><i style="width:${list.length ? round(done / list.length * 100) : 0}%"></i></div><span>${done}/${list.length} prácticas</span></div>
          <span class="frow"><span class="fgo">▶ Practicar</span><a class="fmore" href="#/practicar/m${g.n}">Otras prácticas (${Math.max(0, list.length - 1)})</a></span>`
          : '<span class="flock">🔒 Próximamente</span>'}
      </button>`; }).join('')}</div>`;
  $$('.fcard', el).forEach(b => b.onclick = () => {
    const g = FUNCTION_GROUPS.find(x => x.n === +b.dataset.g);
    if (!g.available) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); toast(`🔒 «${g.name}» estará disponible cuando se escale la plataforma`); return; }
    go(primaryPractice(m, g.n).route);
  });
  $$('.fmore', el).forEach(a => a.onclick = e => e.stopPropagation());
}

function viewModule(el, n) {
  const m = currentModel(), g = FUNCTION_GROUPS.find(x => x.n === n);
  if (!g || !g.available) return go('practicar');
  const list = practicesFor(m, n);
  const done = list.filter(p => p.done).length;
  const next = list.find(p => !p.done && !p.locked);
  const sub = typeof g.sub === 'string' ? g.sub : g.sub[m.power];
  el.innerHTML = `
    ${busBar(m)}
    <div class="modhead card">
      <button class="backbtn" onclick="go('practicar')" aria-label="Volver a los módulos">←</button>
      <span class="fnum big">${g.n}</span>
      <div><span class="modcode">GRUPO DE FUNCIÓN ${g.n} · ${esc(m.name.toUpperCase())}</span><h1>${g.icon} ${esc(g.name)}</h1><small class="muted">${esc(sub)}</small></div>
    </div>
    <div class="modprog big"><div class="bar"><i style="width:${list.length ? round(done / list.length * 100) : 0}%"></i></div><b>${done}/${list.length}</b></div>
    ${next ? `<div class="banner next-prac" onclick="go('${next.route}')">▶ <b>Siguiente recomendado:</b> ${PRACTICE_TYPES[next.type].icon} ${esc(next.title)} <span class="muted">· ${esc(PRACTICE_TYPES[next.type].name)}</span></div>` : ''}
    <div class="plist">${list.map(p => `
      <a class="card pcard ${p.locked ? 'locked' : ''} ${p.done ? 'done' : ''}" href="#/${p.route}">
        <span class="pc-type">${PRACTICE_TYPES[p.type].icon}</span>
        <div class="pc-main">
          <span class="eyebrow">${esc(PRACTICE_TYPES[p.type].name)}</span>
          <b>${esc(p.title)}</b>
          <small>${p.steps} · ⏱ ${p.min} min${p.note ? ` · ${esc(p.note)}` : ''}</small>
          ${!p.done && p.pct ? `<div class="modprog"><div class="bar"><i style="width:${p.pct}%"></i></div><b>${p.pct}%</b></div>` : ''}
        </div>
        <span class="pc-status">${p.locked ? '🔒 Requisito' : p.done ? '✓ Completado' : 'Empezar →'}</span>
      </a>`).join('') || '<p class="muted">No hay prácticas de este módulo para este tipo de autobús.</p>'}</div>
    <div class="row"><button class="btn ghost" onclick="go('inspeccion')">🚌 Explorar el ${esc(m.name)} en 3D</button></div>`;
}
