/* =========================================================
   Técnicos del Mañana ⇄ Fleet Academy (Dashboard del Supervisor)
   Puente de integración — NO agrega interfaz propia.

   1. Sesión unificada: identidad trazable del técnico (id, ASE, nivel léxico)
      leída de `fa-session-tecnico` (la crea el login del Dashboard).
   2. Contenido: inyecta los PublishedModulePackage publicados por el supervisor
      en LESSONS, QUESTIONS, PROCEDURES, PART_INFO, PART_TASKS y DOCS
      (sin borrar los datos base).
   3. Telemetría: observa los cambios de estado de la app (envolviendo `save()`)
      y emite TelemetryEvent con cola offline → API local `/api/events`.

   Se carga ANTES de app.js (para inyectar contenido antes de que se indexe)
   y engancha la telemetría en DOMContentLoaded (antes de init()).
   Las claves de almacenamiento están duplicadas en src/services/hubClient.ts.
   ========================================================= */
(function () {
  'use strict';

  var KEYS = {
    users: 'fa-users',
    session: 'fa-session-tecnico',
    hub: 'fa-hub',
    modules: 'fa-hub-modules',
    events: 'fa-hub-events',
    outbox: 'fa-hub-outbox',
    anon: 'fa-anon-id',
    lastToken: 'fa-bridge-last-token',
  };
  var STORE = 'tdm_state_v1';
  var API = '/api';
  var MAX_OUTBOX = 2000;
  var ROLE_TO_ASE = { diesel: 'T2', elec: 'T6', ev: 'L3', nuevo: 'H' };

  var readJSON = function (k, fb) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } };
  var writeJSON = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  var uuid = function () {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* contexto no seguro */ }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  };
  var channel = null;
  try { channel = new BroadcastChannel('fa-hub'); } catch (e) { channel = null; }
  var notify = function (topic) { try { channel && channel.postMessage({ topic: topic, at: Date.now() }); } catch (e) { /* noop */ } };

  /* ═════════════ 1. Sesión e identidad ═════════════ */

  var hub = readJSON(KEYS.hub, null);
  var sameOriginHub = !!(hub && hub.loginUrl && hub.loginUrl.indexOf(location.origin) === 0);
  var params = new URLSearchParams(location.search);

  function logout() {
    writeJSON(KEYS.session, null);
    notify('session');
    if (sameOriginHub) location.replace(hub.loginUrl);
    else location.replace(location.pathname);
  }

  if (params.has('logout')) { logout(); return; }

  function validSession() {
    var s = readJSON(KEYS.session, null);
    if (!s || !s.tecnico || s.role !== 'Técnico') return null;
    if (s.expiresAt && s.expiresAt < Date.now()) return null;
    var users = readJSON(KEYS.users, null);
    // si el supervisor revocó el acceso, la sesión deja de ser válida
    if (users && !users.some(function (u) { return u.email === s.email; })) return null;
    return s;
  }

  var session = validSession();
  if (!session && sameOriginHub) {
    // hay login unificado en este origen: el técnico debe identificarse
    location.replace(hub.loginUrl);
    return;
  }

  /** Identidad que se guarda en S.user (claves extra a las que usa app.js). */
  var identity = session ? {
    id: session.tecnico.id,
    email: session.email,
    name: session.tecnico.nombre,
    role: session.tecnico.rolApp,
    especialidadASE: session.tecnico.especialidadASE,
    nivelLexico: session.tecnico.nivelLexico,
    depot: session.tecnico.depot,
  } : null;

  // Estado por técnico: cada identidad tiene su propio historial en el mismo navegador.
  if (identity) {
    var cur = readJSON(STORE, null);
    var owner = cur && cur.user ? (cur.user.id || 'anon') : null;
    var next = cur;
    if (owner && owner !== identity.id) {
      writeJSON(STORE + '::' + owner, cur);
      next = readJSON(STORE + '::' + identity.id, null);
    } else if (!owner) {
      next = cur || readJSON(STORE + '::' + identity.id, null);
    }
    next = next || {};
    next.user = Object.assign({ since: Date.now() }, next.user && next.user.id === identity.id ? next.user : {}, identity);
    writeJSON(STORE, next);
  }

  /** Perfil para la telemetría (también en modo anónimo, sin hub). */
  function profile(S) {
    if (identity) return { id: identity.id, nombre: identity.name, especialidadASE: identity.especialidadASE, nivelLexico: identity.nivelLexico };
    if (!S || !S.user) return null;
    var anon = readJSON(KEYS.anon, null);
    if (!anon) { anon = 'anon-' + uuid().slice(0, 8); writeJSON(KEYS.anon, anon); }
    return { id: anon, nombre: S.user.name || 'Técnico', especialidadASE: ROLE_TO_ASE[S.user.role] || 'H', nivelLexico: 'Operativo' };
  }

  /* ═════════════ 2. Inyección de módulos publicados ═════════════ */

  // Globales de data*.js (const de script clásico: accesibles por nombre, no como window.X)
  var G = {
    LESSONS: typeof LESSONS !== 'undefined' ? LESSONS : [],
    QUESTIONS: typeof QUESTIONS !== 'undefined' ? QUESTIONS : [],
    PROCEDURES: typeof PROCEDURES !== 'undefined' ? PROCEDURES : [],
    PART_INFO: typeof PART_INFO !== 'undefined' ? PART_INFO : {},
    PART_TASKS: typeof PART_TASKS !== 'undefined' ? PART_TASKS : {},
    DOCS: typeof DOCS !== 'undefined' ? DOCS : [],
    COMPETENCIAS: typeof COMPETENCIAS !== 'undefined' ? COMPETENCIAS : [],
    SCENARIOS: typeof SCENARIOS !== 'undefined' ? SCENARIOS : [],
    SIMS: typeof SIMS !== 'undefined' ? SIMS : [],
    SENALA: typeof SENALA !== 'undefined' ? SENALA : [],
    ERROR_LABELS: typeof ERROR_LABELS !== 'undefined' ? ERROR_LABELS : {},
  };
  var COMP_OK = {};
  G.COMPETENCIAS.forEach(function (c) { COMP_OK[c.id] = true; });

  /** id de lección / pregunta / procedimiento → id del paquete (para moduloId en la telemetría) */
  var moduleOf = {};
  /** lo agregado a PART_INFO / PART_TASKS por código, para poder reemplazarlo en una nueva versión */
  var addedByCode = {};
  var injectedIds = {};

  function upsert(arr, item) {
    var i = -1;
    for (var k = 0; k < arr.length; k++) if (arr[k].id === item.id) { i = k; break; }
    if (i >= 0) arr[i] = item; else arr.push(item);
  }

  function latestPerCode(pkgs) {
    var by = {};
    (pkgs || []).forEach(function (p) {
      if (!p || p.schema !== 'fa.module/v1' || !p.entrenamiento) return;
      if (!by[p.codigo] || by[p.codigo].version < p.version) by[p.codigo] = p;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  function removeAdded(code) {
    var prev = addedByCode[code];
    if (!prev) return;
    prev.specs.forEach(function (x) { var pi = G.PART_INFO[x[0]]; if (pi && pi.specs) pi.specs = pi.specs.filter(function (s) { return s !== x[1]; }); });
    prev.tasks.forEach(function (x) { var t = G.PART_TASKS[x[0]]; if (t) G.PART_TASKS[x[0]] = t.filter(function (r) { return !(r[0] === x[1] && r[1] === x[2]); }); });
    delete addedByCode[code];
  }

  function inject(pkg) {
    var e = pkg.entrenamiento, mid = pkg.id;
    if (injectedIds[pkg.codigo] === mid) return false;
    removeAdded(pkg.codigo);
    var added = { specs: [], tasks: [] };
    (e.lecciones || []).forEach(function (l) { if (COMP_OK[l.comp]) { upsert(G.LESSONS, l); moduleOf[l.id] = mid; } });
    (e.preguntas || []).forEach(function (q) { if (COMP_OK[q.c]) { upsert(G.QUESTIONS, q); moduleOf[q.id] = mid; } });
    (e.procedimientos || []).forEach(function (p) { upsert(G.PROCEDURES, p); moduleOf[p.id] = mid; });
    (e.docs || []).forEach(function (d) { upsert(G.DOCS, d); });
    Object.keys(e.partInfo || {}).forEach(function (pid) {
      var patch = e.partInfo[pid];
      var pi = G.PART_INFO[pid];
      if (!pi) return; // solo piezas del modelo 3D
      pi.specs = pi.specs || []; pi.procs = pi.procs || []; pi.tools = pi.tools || [];
      (patch.specs || []).forEach(function (s) { if (pi.specs.indexOf(s) < 0) { pi.specs.push(s); added.specs.push([pid, s]); } });
      (patch.procs || []).forEach(function (s) { if (pi.procs.indexOf(s) < 0) pi.procs.push(s); });
      (patch.tools || []).forEach(function (s) { if (pi.tools.indexOf(s) < 0) pi.tools.push(s); });
    });
    Object.keys(e.tareasPiezas || {}).forEach(function (pid) {
      if (!G.PART_INFO[pid]) return;
      var list = G.PART_TASKS[pid] = G.PART_TASKS[pid] || [];
      (e.tareasPiezas[pid] || []).forEach(function (t) {
        if (!list.some(function (r) { return r[0] === t[0] && r[1] === t[1]; })) { list.push([t[0], t[1]]); added.tasks.push([pid, t[0], t[1]]); }
      });
    });
    addedByCode[pkg.codigo] = added;
    injectedIds[pkg.codigo] = mid;
    return true;
  }

  function injectAll(pkgs) {
    var fresh = [];
    latestPerCode(pkgs).forEach(function (p) { try { if (inject(p)) fresh.push(p); } catch (err) { console.warn('[bridge] módulo no inyectado', p && p.id, err); } });
    return fresh;
  }

  // inyección síncrona desde la caché local, antes de que app.js indexe DOCS
  injectAll(readJSON(KEYS.modules, []));

  var booted = false;

  var escHtml = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var BANNER_ROUTES = { inicio: 1, ruta: 1, practicar: 1 };
  /** Aviso con el módulo más reciente del supervisor que tenga lecciones pendientes. */
  function moduleBanner() {
    if (typeof S === 'undefined' || !S.user) return;
    var route = (location.hash || '#/inicio').split('/')[1] || 'inicio';
    if (!BANNER_ROUTES[route] || location.hash.split('/')[2]) return;
    var view = document.getElementById('view');
    if (!view || view.querySelector('.banner[data-bridge]')) return;
    var mods = latestPerCode(readJSON(KEYS.modules, [])).sort(function (a, b) { return String(b.fechaPublicacion).localeCompare(String(a.fechaPublicacion)); });
    var done = S.lessonsDone || {};
    var pending = [];
    mods.forEach(function (m) {
      var lessons = G.LESSONS.filter(function (l) { return l.moduloId === m.id; });
      var todo = lessons.filter(function (l) { return done[l.id] == null; });
      var procs = G.PROCEDURES.filter(function (p) { return p.moduloId === m.id; });
      if (todo.length || (procs.length && !(S.procs || []).some(function (x) { return x.id === procs[0].id; }))) pending.push({ m: m, todo: todo, total: lessons.length, procs: procs });
    });
    if (!pending.length) return;
    var p = pending[0];
    var target = p.todo.length ? 'leccion/' + p.todo[0].id : 'taller/' + p.procs[0].id;
    var div = document.createElement('div');
    div.className = 'banner';
    div.setAttribute('data-bridge', 'modulos');
    div.innerHTML = '📦 Nuevo de tu supervisor: <b>' + escHtml(p.m.nombre) + '</b> · ' +
      (p.todo.length ? (p.total - p.todo.length) + ' de ' + p.total + ' micro-lecciones' : 'práctica en el Taller') +
      (pending.length > 1 ? ' <span class="muted">(+' + (pending.length - 1) + ' módulo(s) más)</span>' : '') +
      ' → <u>' + (p.todo.length && p.todo.length < p.total ? 'continuar' : 'empezar') + '</u>';
    div.addEventListener('click', function () { if (typeof go === 'function') go(target); });
    var sub = view.querySelector('.subnav');
    if (sub) sub.insertAdjacentElement('afterend', div); else view.prepend(div);
  }
  var LIST_ROUTES = { inicio: 1, ruta: 1, taller: 1, practicar: 1, tablero: 1 };
  function onNewModules(fresh) {
    if (!fresh.length || !booted) return;
    fresh.forEach(function (p) { if (typeof toast === 'function') toast('📦 Nuevo módulo del supervisor: ' + p.codigo + ' · ' + p.nombre); });
    var route = (location.hash || '#/inicio').split('/')[1] || 'inicio';
    if (LIST_ROUTES[route] && !location.hash.split('/')[2] && typeof render === 'function') render();
  }

  function api(path, init) {
    if (navigator.onLine === false || !location.protocol.startsWith('http')) return Promise.resolve(null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { ctrl && ctrl.abort(); }, 5000);
    var opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, init || {});
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(API + path, opts)
      .then(function (r) { return r.ok && (r.headers.get('content-type') || '').indexOf('json') >= 0 ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (x) { clearTimeout(t); return x; });
  }

  /**
   * Respaldo estático: catálogo público que el servidor exporta al publicar
   * (/data/manuales/index.json + /data/manuales/<CODIGO>.json). Sirve en hosting estático sin API.
   */
  var STATIC_BASE = '/data/manuales/';
  function getStatic(path) {
    if (!location.protocol.startsWith('http')) return Promise.resolve(null);
    return fetch(STATIC_BASE + path, { cache: 'no-cache' })
      .then(function (r) { return r.ok && (r.headers.get('content-type') || '').indexOf('json') >= 0 ? r.json() : null; })
      .catch(function () { return null; });
  }
  function pullStatic() {
    return getStatic('index.json').then(function (idx) {
      if (!idx || !Array.isArray(idx.manuales)) return null;
      var known = {};
      readJSON(KEYS.modules, []).forEach(function (m) { known[m.id] = 1; });
      var missing = idx.manuales.filter(function (m) { return m && m.archivo && !known[m.id]; });
      return Promise.all(missing.map(function (m) { return getStatic(encodeURIComponent(m.archivo)); }))
        .then(function (pkgs) { return pkgs.filter(function (p) { return p && p.schema === 'fa.module/v1'; }); });
    });
  }

  function pullModules() {
    return api('/modules').then(function (remote) {
      return Array.isArray(remote) ? remote : pullStatic();
    }).then(function (remote) {
      if (!Array.isArray(remote)) return;
      var local = readJSON(KEYS.modules, []);
      var ids = {};
      local.forEach(function (m) { ids[m.id] = 1; });
      var merged = local.concat(remote.filter(function (m) { return m && !ids[m.id]; }));
      if (merged.length !== local.length) writeJSON(KEYS.modules, merged);
      onNewModules(injectAll(merged));
    });
  }

  /* ═════════════ 3. Telemetría ═════════════ */

  var TAG_CAT = {
    'abrir-av-energizado': 'loto', 'desconectar-av-energizado': 'loto', 'epp-inadecuado': 'loto', 'no-verificar-ausencia-tension': 'loto',
    'verificacion-incompleta': 'loto', 'reparacion-av-no-autorizada': 'loto', 'intervenir-av-sin-verificar': 'loto',
    'herramienta-no-aislada-av': 'loto', 'av-sin-epp': 'loto', 'secuencia-bornes': 'loto',
    'proc-torque-incorrecto': 'torque',
    'kit-incorrecto': 'sbom', 'proc-pieza-incorrecta': 'sbom', 'identificacion-incorrecta': 'sbom',
    'herramienta-incorrecta': 'aislamiento',
  };
  var CRITICAL = {
    'abrir-av-energizado': 'Bloqueo LOTO / MSD', 'desconectar-av-energizado': 'Bloqueo LOTO / MSD', 'reparacion-av-no-autorizada': 'Bloqueo LOTO / MSD',
    'herramienta-no-aislada-av': 'Herramienta aislada', 'epp-inadecuado': 'EPP', 'av-sin-epp': 'EPP',
    'no-verificar-ausencia-tension': 'Verificación 0 V', 'intervenir-av-sin-verificar': 'Verificación 0 V', 'verificacion-incompleta': 'Verificación 0 V',
    'secuencia-bornes': 'Secuencia de bornes', 'manipular-postratamiento': 'Postratamiento', 'puentear-red': 'Red de datos',
  };
  var label = function (tag) { return G.ERROR_LABELS[tag] || tag; };
  var find = function (name, id) { return (G[name] || []).find(function (x) { return x.id === id; }) || null; };
  function titleOf(id) {
    var raw = String(id).replace(/^(sim|senala)-/, '');
    var x = find('PROCEDURES', id) || find('SCENARIOS', id) || find('SIMS', raw) || find('SENALA', raw);
    return x ? x.title : id;
  }

  var outbox = readJSON(KEYS.outbox, []);
  var flushTimer = null;
  function enqueue(list) {
    if (!list.length) return;
    outbox = readJSON(KEYS.outbox, []).concat(list).slice(-MAX_OUTBOX);
    writeJSON(KEYS.outbox, outbox);
    notify('events');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 400);
  }
  var flushing = false;
  function flush() {
    outbox = readJSON(KEYS.outbox, []);
    if (flushing || !outbox.length) return Promise.resolve();
    flushing = true;
    var batch = outbox.slice(0, 200);
    return api('/events', { method: 'POST', body: JSON.stringify({ events: batch }) }).then(function (r) {
      if (r && r.ok && Array.isArray(r.ids)) {
        var done = {};
        r.ids.forEach(function (id) { done[id] = 1; });
        var delivered = batch.filter(function (e) { return done[e.eventId]; });
        var known = readJSON(KEYS.events, []);
        writeJSON(KEYS.events, known.concat(delivered).slice(-5000));
        writeJSON(KEYS.outbox, readJSON(KEYS.outbox, []).filter(function (e) { return !done[e.eventId]; }));
        notify('events');
      }
    }).then(function () { flushing = false; if (readJSON(KEYS.outbox, []).length && batch.length === 200) return flush(); });
  }

  /** `dia`: día simulado en que ocurrió la actividad (p. ej. el día del examen), si difiere de hoy. */
  function build(S, tipo, modo, payload, moduloId, dia) {
    var p = profile(S);
    if (!p) return null;
    return {
      schema: 'fa.telemetry/v1', eventId: uuid(), tecnicoId: p.id, moduloId: moduloId || null, timestamp: Date.now(),
      tipo: tipo, modo: modo, diaSimulado: dia != null ? dia : (S.day || 0),
      tecnico: { nombre: p.nombre, especialidadASE: p.especialidadASE, nivelLexico: p.nivelLexico },
      payload: payload,
    };
  }

  var testKey = function (t) { return t ? [t.day, t.avg, (t.answers || []).length, JSON.stringify(t.scores || {})].join('|') : null; };
  function snap(S) {
    return {
      pre: testKey(S.tests && S.tests.pre), post: testKey(S.tests && S.tests.post), delayed: testKey(S.tests && S.tests.delayed),
      lessons: Object.assign({}, S.lessonsDone), qErr: Object.assign({}, S.qErrors),
      practice: (S.practice || []).length, procs: (S.procs || []).length,
      errors: Object.assign({}, S.errors),
      reviewsDone: (S.reviews || []).filter(function (r) { return r.done; }).length,
      unanswered: (S.unanswered || []).length,
    };
  }
  var moduleOfAnswers = function (t) {
    var a = (t && t.answers) || [];
    for (var i = 0; i < a.length; i++) if (moduleOf[a[i].id]) return moduleOf[a[i].id];
    return null;
  };
  var routeFor = function (q) {
    q = String(q || '').toLowerCase();
    if (/alto voltaje|\bav\b|bater|inversor|msd|aislamiento|el[eé]ctric|carga/.test(q)) return 'L3';
    if (/di[eé]sel|turbo|inyec|dpf|adblue|urea|escape|combustible/.test(q)) return 'T2';
    if (/\bcan\b|ecu|software|sensor|24 ?v|j1939|telem/.test(q)) return 'T6';
    return 'H';
  };

  function activityEvents(S, entry, modo) {
    var out = [];
    var mid = moduleOf[entry.id] || null;
    var titulo = titleOf(entry.id);
    var viol = entry.violations || [];
    out.push(build(S, 'practica.completada', modo, {
      score: entry.score, passed: !!entry.passed, actividad: entry.id, titulo: titulo,
      etiqueta: viol.length ? 'Violación: ' + viol.map(label).join(', ') : undefined,
    }, mid));
    var perTag = {};
    (entry.errors || []).forEach(function (tag) { perTag[tag] = (perTag[tag] || 0) + 1; });
    Object.keys(perTag).forEach(function (tag) {
      var critical = viol.indexOf(tag) >= 0 || !!CRITICAL[tag];
      for (var i = 0; i < Math.min(5, perTag[tag]); i++) {
        out.push(build(S, critical ? 'seguridad.error_critico' : 'error.registrado', modo, {
          tag: tag, etiqueta: label(tag), categoria: TAG_CAT[tag] || 'diagnostico',
          componente: CRITICAL[tag] ? CRITICAL[tag] + ' · ' + titulo : titulo,
          severidad: critical ? 'critica' : 'media', actividad: entry.id,
        }, mid));
      }
    });
    return out;
  }

  function diff(S, prev) {
    var now = snap(S);
    var evs = [];
    var lvl = function (avg) { try { return levelLabel(avg).t; } catch (e) { return avg >= 70 ? 'Avanzado' : avg >= 40 ? 'Intermedio' : 'Básico'; } };
    if (now.pre && now.pre !== prev.pre) {
      var pre = S.tests.pre;
      evs.push(build(S, 'diagnostico.completado', 'Teoría', { score: pre.avg, scores: pre.scores, nivelDetectado: lvl(pre.avg), passed: pre.avg >= 70 }, moduleOfAnswers(pre), pre.day));
    }
    if (now.post && now.post !== prev.post) {
      var post = S.tests.post;
      evs.push(build(S, 'examen.post', 'Teoría', { score: post.avg, scores: post.scores, passed: post.avg >= 70 }, moduleOfAnswers(post), post.day));
    }
    if (now.delayed && now.delayed !== prev.delayed) {
      var del = S.tests.delayed, ret = null;
      try { ret = retention(); } catch (e) { ret = null; }
      evs.push(build(S, 'examen.diferido', 'Teoría', { score: del.avg, scores: del.scores, passed: del.avg >= 70, retencion: ret }, moduleOfAnswers(del), del.day));
    }
    Object.keys(now.lessons).forEach(function (id) {
      if (prev.lessons[id] === now.lessons[id] && (prev.qErr['lesson:' + id] || 0) === (now.qErr['lesson:' + id] || 0)) return;
      var failed = (now.qErr['lesson:' + id] || 0) > (prev.qErr['lesson:' + id] || 0);
      var l = find('LESSONS', id);
      evs.push(build(S, 'leccion.completada', 'Teoría', { actividad: id, titulo: l ? l.title : id, passed: !failed }, moduleOf[id]));
    });
    if (now.practice > prev.practice) (S.practice || []).slice(prev.practice).forEach(function (e) { evs = evs.concat(activityEvents(S, e, 'Rescate en Ruta')); });
    if (now.procs > prev.procs) (S.procs || []).slice(prev.procs).forEach(function (e) { evs = evs.concat(activityEvents(S, e, 'Taller')); });
    Object.keys(now.errors).forEach(function (tag) {
      var n = now.errors[tag], before = prev.errors[tag] || 0;
      if (n >= 2 && n > before) evs.push(build(S, 'error.repetido', 'Taller', { tag: tag, etiqueta: label(tag), categoria: TAG_CAT[tag] || 'diagnostico', repeticiones: n, severidad: CRITICAL[tag] ? 'critica' : 'alta' }, null));
    });
    if (now.reviewsDone > prev.reviewsDone) evs.push(build(S, 'repaso.completado', 'Teoría', { repeticiones: now.reviewsDone - prev.reviewsDone }, null));
    if (now.unanswered > prev.unanswered) (S.unanswered || []).slice(prev.unanswered).forEach(function (u) {
      evs.push(build(S, 'delegacion.solicitada', 'Taller', { especialidadDestino: routeFor(u.q), motivo: 'Pregunta sin fuente autorizada: "' + String(u.q).slice(0, 120) + '"' }, null));
    });
    return { events: evs.filter(Boolean), snap: now };
  }

  /* ═════════════ 4. Enganche con app.js ═════════════ */

  var last = null;
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof save !== 'function' || typeof S === 'undefined') return;
    last = snap(S);
    var original = save;
    window.save = function () {
      var demo = false;
      if (identity && (!S.user || S.user.id !== identity.id)) {
        // "Reiniciar datos" o "Cargar datos demo": se conserva la identidad trazable
        demo = !!(S.user && !S.user.id && S.user.name === 'Técnico Demo');
        S.user = Object.assign({ since: Date.now() }, identity);
      }
      var r = original.apply(this, arguments);
      try {
        // el estado reiniciado o los datos demo no son actividad real del técnico
        var reset = (S.practice || []).length < last.practice || (S.procs || []).length < last.procs;
        if (demo || reset) last = snap(S);
        else { var d = diff(S, last); last = d.snap; enqueue(d.events); }
      } catch (err) { console.warn('[bridge] telemetría', err); }
      return r;
    };
    booted = true;

    // Aviso de módulos del supervisor (estilo .banner existente) en Inicio / Mi ruta / Practicar,
    // visible aunque el técnico aún no haga el diagnóstico (que oculta la ruta).
    if (typeof render === 'function') {
      var originalRender = render;
      window.render = function () {
        var r = originalRender.apply(this, arguments);
        try { moduleBanner(); } catch (err) { console.warn('[bridge] aviso de módulos', err); }
        return r;
      };
    }

    // botón "Cerrar sesión" del pie de la barra lateral (solo con sesión unificada)
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && identity) {
      logoutBtn.hidden = false;
      logoutBtn.title = 'Cerrar la sesión de ' + identity.name;
      logoutBtn.addEventListener('click', function () { flush().then(logout, logout); });
    }

    var p = profile(S);
    if (session && p && readJSON(KEYS.lastToken, null) !== session.token) {
      writeJSON(KEYS.lastToken, session.token);
      enqueue([build(S, 'sesion.inicio', 'Teoría', { actividad: 'login', titulo: 'Inicio de sesión en la app del técnico' }, null)].filter(Boolean));
    }
    window.addEventListener('online', function () { flush(); pullModules(); });
    setInterval(flush, 15000);
    setInterval(pullModules, 20000);
    flush();
    pullModules();
  });

  if (channel) channel.addEventListener('message', function (e) {
    if (e.data && e.data.topic === 'modules') onNewModules(injectAll(readJSON(KEYS.modules, [])));
    if (e.data && e.data.topic === 'session' && identity && !validSession()) logout();
  });
  window.addEventListener('storage', function (e) {
    if (e.key === KEYS.modules) onNewModules(injectAll(readJSON(KEYS.modules, [])));
  });

  /** API pública para depuración e integraciones (consola del navegador). */
  window.TDM_BRIDGE = {
    version: 1,
    identity: identity,
    logout: logout,
    flush: flush,
    pullModules: pullModules,
    outbox: function () { return readJSON(KEYS.outbox, []); },
    modules: function () { return latestPerCode(readJSON(KEYS.modules, [])); },
    moduleOf: moduleOf,
    /** Solicitud explícita de delegación a otra especialidad ASE. */
    requestDelegation: function (especialidadDestino, motivo) {
      if (typeof S === 'undefined') return;
      enqueue([build(S, 'delegacion.solicitada', 'Taller', { especialidadDestino: especialidadDestino, motivo: motivo || '' }, null)].filter(Boolean));
    },
  };
})();
