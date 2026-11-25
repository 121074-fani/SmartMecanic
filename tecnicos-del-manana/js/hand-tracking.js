/* =========================================================
   Técnicos del Mañana — Seguimiento de manos real (MediaPipe HandLandmarker)
   ---------------------------------------------------------
   Todo corre en el navegador: las imágenes de la cámara nunca salen del equipo.
   MediaPipe Tasks Vision se descarga una sola vez (CDN) y el service worker lo
   guarda en su propia caché para que funcione sin conexión.

   Gestos sobre el visor 3D (window.HandGestures.attach):
     · Apuntar   → la punta del índice (landmark 8) es el puntero: resalta la pieza
                    bajo el dedo (pick del motor = "rayo" en pantalla) y muestra su etiqueta.
     · Pinza     → pulgar (4) + índice (8) juntos y soltar sin mover = tocar la pieza
                    (mismo scene.onPick que un toque: mismas reglas EPP → LOTO → 0 V).
     · Pinza sostenida + mover → gira el modelo.
     · Mano abierta (5 dedos)  → detiene el giro y estabiliza el puntero para piezas pequeñas.
   Expone: HandGestures.supported(), HandGestures.attach(stage, scene, { mobile }) → stop()
   ========================================================= */
(function () {
  'use strict';

  var MP_VERSION = '1.2.2';
  var MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION;
  var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  var FRAME_MS = 33;            // ~30 fps de análisis para no calentar el celular
  var PINCH_ON = 0.055;         // distancia pulgar–índice (coordenadas normalizadas) para cerrar la pinza
  var PINCH_OFF = 0.08;         // histéresis: se abre por encima de este valor
  var PINCH_REL_ON = 0.33;      // lo mismo relativo al tamaño de la palma (mano lejos o cerca)
  var PINCH_REL_OFF = 0.46;
  var DRAG_PX = 18;             // desplazamiento con pinza que convierte el "toque" en "arrastre"
  var TAP_COOLDOWN = 600;       // debounce entre toques
  var LOST_FRAMES = 6;          // cuadros sin mano antes de ocultar el puntero
  var CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

  var visionPromise = null;
  // import() dinámico "oculto": el servidor de desarrollo de Vite reescribe los import() de los .js que sirve
  // y les antepone una sentencia `import`, lo que rompe este script clásico (no es un módulo).
  var importModule = new Function('url', 'return import(url)');
  /** Carga (una vez) el módulo de MediaPipe y sus archivos WASM. */
  function loadVision() {
    if (!visionPromise) {
      visionPromise = importModule(MP_BASE + '/vision_bundle.mjs').then(function (m) {
        return m.FilesetResolver.forVisionTasks(MP_BASE + '/wasm').then(function (fileset) { return { m: m, fileset: fileset }; });
      });
      visionPromise.catch(function () { visionPromise = null; });   // permite reintentar (p. ej. al volver la red)
    }
    return visionPromise;
  }
  var hasWebGL2 = function () { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } };
  /** GPU si hay WebGL2; si falla, CPU (WASM). */
  function createLandmarker() {
    return loadVision().then(function (v) {
      var make = function (delegate) {
        return v.m.HandLandmarker.createFromOptions(v.fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: delegate },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      };
      return hasWebGL2() ? make('GPU').catch(function () { return make('CPU'); }) : make('CPU');
    });
  }

  function supported() {
    return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof WebAssembly === 'object');
  }

  /* Filtro One Euro: suaviza el temblor sin retrasar los movimientos rápidos */
  function oneEuro(minCutoff, beta) {
    var x = null, dx = 0;
    var alpha = function (cut, dt) { return 1 / (1 + 1 / (2 * Math.PI * cut * dt)); };
    return {
      reset: function () { x = null; dx = 0; },
      filter: function (v, dt, cutoff) {
        if (x === null) { x = v; return v; }
        var ad = alpha(1, dt); dx = ad * ((v - x) / dt) + (1 - ad) * dx;
        var a = alpha((cutoff || minCutoff) + beta * Math.abs(dx), dt); x = a * v + (1 - a) * x;
        return x;
      },
    };
  }

  var say = function (msg) { if (typeof toast === 'function') toast(msg); };
  var clamp01 = function (v) { return Math.min(1, Math.max(0, v)); };
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };

  /** Mano abierta: los 4 dedos extendidos (punta más lejos de la muñeca que su articulación media) y pulgar separado. */
  function isOpenHand(lm) {
    var palm = dist(lm[0], lm[9]) || 1e-3;
    var fingers = [[8, 6], [12, 10], [16, 14], [20, 18]].every(function (f) { return dist(lm[f[0]], lm[0]) > dist(lm[f[1]], lm[0]) * 1.15; });
    var thumb = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.05 && dist(lm[4], lm[8]) > palm * 0.6;
    return fingers && thumb;
  }

  /**
   * Conecta el seguimiento de manos al visor.
   * @param stage  contenedor .stage (con .vtools)
   * @param scene  instancia de E3D.Scene
   * @param opts   { mobile: boolean } → celular: cámara de fondo (trasera por defecto); escritorio: ventanita (frontal)
   *               { external: { getVideo, bar, tip } } → usa la cámara que ya abrió otro modo (realidad aumentada):
   *               el botón "Mano" va en la barra de ese modo y no se abre una segunda cámara.
   * @returns dispose() para limpiar (con .stop() y .onStart), o null si no aplica
   */
  function attach(stage, scene, opts) {
    opts = opts || {};
    var ext = opts.external || null;
    var tools = stage.querySelector('.vtools');
    if ((!tools && !ext) || !supported()) return null;
    var mobile = !!opts.mobile || !!ext;
    var mode = mobile ? 'background' : 'pip';
    var facing = mobile ? 'environment' : 'user';

    /* ---------- interfaz (clases existentes de la app) ---------- */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Tocar y girar el modelo con la mano (cámara)';
    if (ext) {
      btn.className = 'arbtn2';
      btn.innerHTML = '{{i:hand}} Mano';
      ext.bar.insertBefore(btn, ext.bar.querySelector('.arclose'));
    } else {
      btn.className = mobile ? 'vt arbtn' : 'vt';
      btn.innerHTML = mobile ? '{{i:hand}}<b>Mano</b>' : '{{i:hand}}';
      tools.prepend(btn);
    }

    var video = ext ? null : document.createElement('video');
    if (video) { video.setAttribute('playsinline', ''); video.muted = true; video.autoplay = true; }
    var overlay = document.createElement('canvas');            // esqueleto de la mano
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';

    var box = null, statusEl, switchBtn = null, closeBtn = null;
    if (ext) {
      stage.appendChild(overlay);
      statusEl = ext.tip;
    } else if (mode === 'pip') {
      box = document.createElement('div');
      box.className = 'handcam'; box.hidden = true;
      box.innerHTML = '<span class="hlabel">Cargando reconocimiento de manos…</span><button type="button" class="hclose" aria-label="Apagar cámara">✕</button>' +
        '<button type="button" class="hclose" data-hswitch aria-label="Cambiar de cámara" title="Cambiar de cámara" style="right:auto;left:4px" hidden>⇄</button>';
      box.prepend(overlay); box.prepend(video);
      stage.appendChild(box);
      statusEl = box.querySelector('.hlabel');
      closeBtn = box.querySelector('.hclose:not([data-hswitch])');
      switchBtn = box.querySelector('[data-hswitch]');
    } else {
      video.className = 'arvideo';
      box = document.createElement('div');
      box.className = 'arhud'; box.hidden = true;
      box.innerHTML = '<div class="arbar"><span class="arlive"><i></i>Control con la mano</span>' +
        '<button type="button" class="arbtn2" data-hswitch hidden>Cambiar cámara</button>' +
        '<button type="button" class="arclose" aria-label="Apagar cámara">✕</button></div>' +
        '<div class="artip">Cargando reconocimiento de manos…</div>';
      stage.appendChild(box);
      statusEl = box.querySelector('.artip');
      closeBtn = box.querySelector('.arclose');
      switchBtn = box.querySelector('[data-hswitch]');
    }
    var setStatus = function (t) { if (statusEl && statusEl.textContent !== t) statusEl.textContent = t; if (statusEl) statusEl.hidden = !t; };

    /* ---------- estado ---------- */
    var stream = null, landmarker = null, raf = 0, active = false, disposed = false, starting = false;
    var lastDetect = 0, lastVideoTime = -1, lastFrameT = 0, lost = 99;
    var lastTap = 0, vel = { x: 0, y: 0 }, zoom = null, twoPinch = false, holder = null, tapper = null;
    var octx = overlay.getContext('2d');
    /** Un rastreador por mano (MediaPipe la identifica como izquierda/derecha), cada uno con 2 puntos: índice y pulgar. */
    var trackers = {};

    function applyMirror() {
      // espejo solo con la cámara frontal (como un espejo); la trasera muestra el mundo tal cual
      video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
    }

    function openCamera() {
      if (ext) {   // la cámara ya está abierta por la realidad aumentada: solo se toma su video
        video = ext.getVideo();
        stream = video && video.srcObject;
        return stream ? Promise.resolve() : Promise.reject(new Error('sin cámara'));
      }
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: mobile ? 960 : 640 }, height: { ideal: mobile ? 720 : 480 }, frameRate: { ideal: 30 } },
        audio: false,
      }).then(function (s) {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = s;
        video.srcObject = s;
        applyMirror();
        // no se espera a play(): si la cámara tarda en dar imagen, el modelo se carga en paralelo
        // y el ciclo de análisis simplemente espera a que haya cuadros (readyState ≥ 2)
        video.play().catch(function () { /* autoplay bloqueado: se reintenta al recibir datos */ });
      });
    }

    function start() {
      if (starting || active) return;
      if (typeof api.onStart === 'function') api.onStart();   // p. ej. apagar la otra cámara (AR) antes de abrir esta
      starting = true;
      btn.classList.add('on');
      if (box) box.hidden = false;
      if (mode === 'background' && !ext) { stage.prepend(video); stage.classList.add('ar-on'); scene.noGrid = true; }
      scene.autoRotate = false;
      setStatus('Cargando reconocimiento de manos…');
      openCamera()
        .catch(function (e) {
          throw { camera: true, e: e };
        })
        .then(function () {
          // ¿hay más de una cámara? entonces se ofrece el selector
          if (switchBtn && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then(function (ds) {
              switchBtn.hidden = ds.filter(function (d) { return d.kind === 'videoinput'; }).length < 2;
            }).catch(function () {});
          }
          return landmarker || createLandmarker();
        })
        .then(function (lmk) {
          starting = false;
          if (disposed || !stream) { if (lmk && lmk !== landmarker) lmk.close(); return; }
          landmarker = lmk;
          active = true;
          lost = 99; resetTrackers(); buildShelf(); buildActions();
          setStatus(mobile ? 'Muestra tu mano frente a la cámara · pinza para tocar · pinza sostenida para girar' : 'Muestra tu mano a la cámara');
          raf = requestAnimationFrame(loop);
        })
        .catch(function (err) {
          starting = false;
          var cam = err && err.camera;
          var e = cam ? err.e : err;
          stop();
          if (cam) say(e && e.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Puedes seguir tocando la pantalla.' : 'No se pudo abrir la cámara. Puedes seguir tocando la pantalla.');
          else say('No se pudo cargar el reconocimiento de manos (¿sin conexión la primera vez?). Puedes seguir tocando la pantalla.');
        });
    }

    function stop() {
      active = false;
      cancelAnimationFrame(raf); raf = 0;
      if (!ext) {   // la cámara de la realidad aumentada la administra ese modo
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        if (video) video.srcObject = null;
        if (video && video.parentNode && mode === 'background') video.remove();
        stage.classList.remove('ar-on');
        if (mode === 'background') scene.noGrid = false;
      }
      stream = null;
      if (landmarker) { try { landmarker.close(); } catch (e) { /* ya cerrado */ } landmarker = null; }
      if (box) box.hidden = true;
      btn.classList.remove('on');
      hideTrackers(); removeShelf();
      octx.clearRect(0, 0, overlay.width, overlay.height);
      scene.hover = null;
      vel.x = vel.y = 0; zoom = null; twoPinch = false;
    }

    function dispose() { disposed = true; stop(); removeTrackers(); if (box) box.remove(); overlay.remove(); btn.remove(); }
    var api = dispose;
    api.stop = function () { if (active || starting) stop(); };
    api.isActive = function () { return active || starting; };

    /* ---------- coordenadas ---------- */
    // video con object-fit: cover dentro de una caja de w×h → posición en píxeles de la caja
    function coverMap(nx, ny, w, h) {
      var vw = (video && video.videoWidth) || 640, vh = (video && video.videoHeight) || 480;
      var s = Math.max(w / vw, h / vh);
      var x = facing === 'user' ? 1 - nx : nx;
      return [(w - vw * s) / 2 + x * vw * s, (h - vh * s) / 2 + ny * vh * s];
    }
    /** landmark normalizado → coordenadas de pantalla sobre el visor */
    function toStage(p) {
      var r = stage.getBoundingClientRect();
      if (mode === 'background') {
        var c = coverMap(p.x, p.y, r.width, r.height);
        return [r.left + Math.min(r.width, Math.max(0, c[0])), r.top + Math.min(r.height, Math.max(0, c[1]))];
      }
      // ventanita: la zona central de la cámara (12 %–88 %) cubre todo el visor, para llegar a las orillas sin estirar el brazo
      var x = facing === 'user' ? 1 - p.x : p.x;
      return [r.left + clamp01((x - 0.12) / 0.76) * r.width, r.top + clamp01((p.y - 0.12) / 0.76) * r.height];
    }

    /* ---------- puntos por mano (índice = puntero, pulgar = segundo punto) ---------- */
    function dotEl(size, css) {
      var d = document.createElement('i');
      d.className = 'hdot';                                     // estilo de puntero existente de la app
      d.style.cssText = 'z-index:6;pointer-events:none;width:' + size + 'px;height:' + size + 'px;transition:background .12s, width .12s, height .12s;' + (css || '');
      stage.appendChild(d);
      return d;
    }
    function makeTracker(key) {
      var badge = document.createElement('span');               // herramienta en la mano
      badge.style.cssText = 'position:absolute;left:0;top:0;display:none;z-index:7;pointer-events:none;padding:2px 6px;border-radius:999px;background:#fff;border:1.5px solid var(--navy);color:var(--navy);font-size:.8rem;line-height:1.2;box-shadow:0 4px 12px rgba(11,45,82,.25)';
      stage.appendChild(badge);
      return {
        key: key, missing: 0,
        fx: oneEuro(1.4, 0.03), fy: oneEuro(1.4, 0.03), gx: oneEuro(1.4, 0.03), gy: oneEuro(1.4, 0.03),
        pinched: false, pinchStart: null, prevPt: null, dragging: false, zooming: false, open: false, pt: null, thumb: null,
        dot: dotEl(16), thumbDot: dotEl(11, 'background:transparent;border:2px solid #fff;box-shadow:0 0 0 2px rgba(245,130,31,.8)'), badge: badge,
      };
    }
    var list = function () { return Object.keys(trackers).map(function (k) { return trackers[k]; }); };
    var visible = function () { return list().filter(function (t) { return t.pt && t.missing <= LOST_FRAMES; }); };
    var anyDragging = function () { return list().some(function (t) { return t.dragging || t.zooming; }); };
    function hideTracker(t) {
      t.dot.style.display = t.thumbDot.style.display = t.badge.style.display = 'none';
      t.pinched = t.dragging = t.zooming = t.open = false; t.pinchStart = t.prevPt = t.pt = t.thumb = null;
    }
    function hideTrackers() { list().forEach(hideTracker); }
    function resetTrackers() { list().forEach(function (t) { hideTracker(t); t.fx.reset(); t.fy.reset(); t.gx.reset(); t.gy.reset(); t.missing = 99; }); }
    function removeTrackers() { list().forEach(function (t) { t.dot.remove(); t.thumbDot.remove(); t.badge.remove(); }); trackers = {}; }
    function place(el, cx, cy, r) { el.style.display = 'block'; el.style.transform = 'translate(' + (cx - r.left) + 'px,' + (cy - r.top) + 'px) translate(-50%, -50%)'; }

    /* ---------- repisa de herramientas dentro del visor ----------
       Las herramientas de la práctica están en la "Caja de herramientas" (.simtray, fuera del visor).
       Con la mano activa se muestran también dentro del visor: una pinza sobre una herramienta la "agarra"
       pulsando el botón real de la caja (misma lógica, validación y sugerencias del modo guiado). */
    var shelf = null, shelfObs = null;
    function findTray() {
      var root = stage.closest('.sim-grid') || stage.parentNode;
      return (root && root.querySelector('.simtray')) || null;
    }
    function heldTool() {
      var tray = findTray(), on = tray && tray.querySelector('.stool.on');
      return on ? { k: on.dataset.k, icon: (on.querySelector('span') || on).innerHTML, name: on.title } : null;
    }
    function syncShelf() {
      if (!shelf) return;
      var tray = findTray();
      Array.prototype.forEach.call(shelf.querySelectorAll('.stool'), function (c) {
        var real = tray && tray.querySelector('.stool[data-k="' + c.dataset.k + '"]');
        c.classList.toggle('on', !!real && real.classList.contains('on'));
        c.classList.toggle('suggest', !!real && real.classList.contains('suggest'));
      });
      if (!heldTool()) holder = null;
    }
    function buildShelf() {
      removeShelf();
      var tray = findTray();
      if (!tray || !tray.querySelector('.stool')) return;
      shelf = document.createElement('div');
      shelf.setAttribute('aria-label', 'Herramientas al alcance de la mano');
      // arriba a la izquierda; termina antes de la ventanita de la cámara (escritorio) o del aviso inferior (celular)
      shelf.style.cssText = 'position:absolute;left:10px;top:' + (mode === 'background' ? 58 : 12) + 'px;z-index:5;display:flex;flex-direction:column;gap:6px;' +
        'max-height:calc(100% - ' + (mode === 'pip' ? 210 : 190) + 'px);overflow-y:auto;padding:6px;border-radius:14px;background:rgba(255,255,255,.6);backdrop-filter:blur(4px);box-shadow:0 6px 20px rgba(11,45,82,.18)';
      Array.prototype.forEach.call(tray.querySelectorAll('.stool'), function (b) {
        var c = document.createElement('button');
        c.type = 'button'; c.className = 'stool'; c.dataset.k = b.dataset.k; c.title = b.title;
        c.style.cssText = 'width:62px;padding:6px 2px 5px';
        c.innerHTML = b.innerHTML;
        c.addEventListener('click', function () {
          b.click();                                            // la caja real decide: tomar o soltar
          holder = heldTool() ? tapper : null;
          syncShelf();
        });
        shelf.appendChild(c);
      });
      stage.appendChild(shelf);
      shelfObs = new MutationObserver(syncShelf);
      shelfObs.observe(tray, { subtree: true, attributes: true, attributeFilter: ['class'] });
      syncShelf();
    }
    function removeShelf() {
      if (shelfObs) { shelfObs.disconnect(); shelfObs = null; }
      if (shelf) { shelf.remove(); shelf = null; }
      removeActions();
    }

    /* Botones de acción del paso actual ("Usar guantes en mí", "Iniciar espera", opciones de respuesta…):
       viven en la tarjeta de tarea, fuera del visor; se replican abajo del visor para alcanzarlos con la mano. */
    var actBar = null, actObs = null;
    function findTask() {
      var root = stage.closest('.sim-grid') || stage.parentNode;
      return (root && root.querySelector('.taskcard')) || null;
    }
    function syncActions() {
      if (!actBar) return;
      var task = findTask();
      var real = task ? Array.prototype.filter.call(task.querySelectorAll('button'), function (b) { return !b.disabled && b.offsetParent !== null; }) : [];
      actBar.innerHTML = '';
      real.slice(0, 4).forEach(function (b) {
        var c = document.createElement('button');
        c.type = 'button'; c.className = b.className || 'btn'; c.innerHTML = b.innerHTML;
        c.addEventListener('click', function () { b.click(); });
        actBar.appendChild(c);
      });
      actBar.style.display = real.length ? 'flex' : 'none';
    }
    function buildActions() {
      removeActions();
      var task = findTask();
      if (!task) return;
      actBar = document.createElement('div');
      actBar.setAttribute('aria-label', 'Acciones del paso al alcance de la mano');
      actBar.style.cssText = 'position:absolute;left:50%;bottom:' + (mode === 'background' ? 112 : 56) + 'px;transform:translateX(-50%);z-index:5;' +
        'display:none;flex-wrap:wrap;justify-content:center;gap:6px;max-width:72%';
      stage.appendChild(actBar);
      actObs = new MutationObserver(syncActions);
      actObs.observe(task, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'class'] });
      syncActions();
    }
    function removeActions() {
      if (actObs) { actObs.disconnect(); actObs = null; }
      if (actBar) { actBar.remove(); actBar = null; }
    }

    /* ---------- dibujo del esqueleto ---------- */
    function drawHands(hands) {
      var w = overlay.clientWidth, h = overlay.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) { overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr); }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      hands.forEach(function (hd) {
        var pts = hd.lm.map(function (p) { return coverMap(p.x, p.y, w, h); });
        var pin = hd.t && hd.t.pinched;
        octx.lineWidth = 2;
        octx.strokeStyle = 'rgba(255,255,255,.75)';
        octx.beginPath();
        CONNECTIONS.forEach(function (c) { octx.moveTo(pts[c[0]][0], pts[c[0]][1]); octx.lineTo(pts[c[1]][0], pts[c[1]][1]); });
        octx.stroke();
        octx.fillStyle = 'rgba(255,255,255,.9)';
        pts.forEach(function (p) { octx.beginPath(); octx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); octx.fill(); });
        [8, 4].forEach(function (i) {                           // los dos puntos de contacto: índice y pulgar
          var t = pts[i], r = i === 8 ? 4.5 : 3.5;
          octx.beginPath(); octx.arc(t[0], t[1], r * 2, 0, Math.PI * 2);
          octx.fillStyle = pin ? 'rgba(34,197,94,.35)' : 'rgba(245,130,31,.35)'; octx.fill();
          octx.beginPath(); octx.arc(t[0], t[1], r, 0, Math.PI * 2);
          octx.fillStyle = pin ? '#22c55e' : '#f5821f'; octx.fill();
        });
      });
    }

    /* ---------- acciones ---------- */
    function tap(cx, cy, t) {
      var now = performance.now();
      if (now - lastTap < TAP_COOLDOWN) return;
      lastTap = now; tapper = t;
      // botones dentro del visor (herramientas de la repisa, acciones del paso, acercar, "Comenzar"…).
      // Se buscan por geometría: elementFromPoint no ve lo que quedó fuera de la pantalla (visor parcialmente desplazado).
      var el = document.elementFromPoint(cx, cy);
      var target = (el && stage.contains(el) && el.closest(TAPPABLE)) || buttonAt(cx, cy);
      if (target && target !== btn) { target.click(); return; }
      if (!el || el === scene.canvas || !stage.contains(el)) {
        var hit = scene.selectAt(cx, cy);
        t.dot.style.background = hit ? '#22c55e' : '';
        setTimeout(function () { t.dot.style.background = ''; }, 350);
      }
    }
    var TAPPABLE = 'button, a, [data-a], .opt, [onclick]';
    /** Botón visible del visor bajo el punto (el último en el DOM queda encima). */
    function buttonAt(cx, cy) {
      var all = stage.querySelectorAll(TAPPABLE);
      for (var i = all.length - 1; i >= 0; i--) {
        var b = all[i];
        if (b === btn || b.disabled || !b.offsetParent || b.closest('[hidden]')) continue;
        var r = b.getBoundingClientRect();
        if (r.width && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return b;
      }
      return null;
    }

    /** Actualiza una mano: sus 2 puntos, la pinza y lo que hace (tocar / girar / agarrar). */
    function updateTracker(t, lm, dt, r) {
      if (t.missing > LOST_FRAMES) { t.fx.reset(); t.fy.reset(); t.gx.reset(); t.gy.reset(); }
      t.missing = 0;
      var d = dist(lm[4], lm[8]), palm = dist(lm[0], lm[9]) || 1e-3;
      var was = t.pinched;
      if (!t.pinched && (d < PINCH_ON || d / palm < PINCH_REL_ON)) t.pinched = true;
      else if (t.pinched && d > PINCH_OFF && d / palm > PINCH_REL_OFF) t.pinched = false;
      t.open = !t.pinched && isOpenHand(lm);
      var cutoff = t.open ? 0.5 : undefined;                    // mano abierta: puntos más estables (precisión)
      // punto 1 (puntero): punta del índice; con pinza, el punto medio pulgar–índice (más estable)
      var src = t.pinched ? { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 } : lm[8];
      var raw = toStage(src), rawT = toStage(lm[4]);
      t.pt = [t.fx.filter(raw[0], dt, cutoff), t.fy.filter(raw[1], dt, cutoff)];
      // punto 2: punta del pulgar
      t.thumb = [t.gx.filter(rawT[0], dt, cutoff), t.gy.filter(rawT[1], dt, cutoff)];
      var cx = t.pt[0], cy = t.pt[1];
      t.dot.style.width = t.dot.style.height = t.pinched ? '20px' : '16px';
      place(t.dot, cx, cy, r);
      if (t.pinched) t.thumbDot.style.display = 'none'; else place(t.thumbDot, t.thumb[0], t.thumb[1], r);

      if (t.pinched && !was) { t.pinchStart = [cx, cy]; t.prevPt = [cx, cy]; t.dragging = false; t.zooming = false; vel.x = vel.y = 0; }
      if (t.pinched) {
        if (twoPinch) t.zooming = true;                         // dos pinzas: el zoom lo resuelve handle()
        else {
          if (!t.dragging && !t.zooming && Math.hypot(cx - t.pinchStart[0], cy - t.pinchStart[1]) > DRAG_PX) t.dragging = true;
          if (t.dragging) {
            var ddx = cx - t.prevPt[0], ddy = cy - t.prevPt[1];
            scene.rotateBy(ddx * 1.15, ddy * 1.15);
            vel.x = ddx * 1.15 / dt; vel.y = ddy * 1.15 / dt;
          }
        }
        t.prevPt = [cx, cy];
      }
      if (!t.pinched && was) {
        if (!t.dragging && !t.zooming) tap(cx, cy, t);
        t.dragging = false; t.zooming = false; t.pinchStart = null; t.prevPt = null;
      }
      if (t.open) vel.x = vel.y = 0;
    }

    /** Procesa el resultado de MediaPipe de un cuadro (hasta 2 manos). */
    function handle(res, now) {
      var dt = Math.min(0.1, Math.max(0.008, (now - (lastFrameT || now - FRAME_MS)) / 1000));
      lastFrameT = now;
      var hands = (res && res.landmarks) || [];
      var sides = (res && (res.handedness || res.handednesses)) || [];
      var r = stage.getBoundingClientRect();
      if (!hands.length) {
        if (++lost > LOST_FRAMES) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          if (visible().length) scene.hover = null;
          hideTrackers(); zoom = null; twoPinch = false;
          setStatus(mobile ? 'Muestra tus manos frente a la cámara · pinza para tocar · pinza sostenida para girar' : 'Muestra tus manos a la cámara');
        }
        return;
      }
      lost = 0;
      var seen = {}, drawn = [];
      hands.forEach(function (lm, i) {
        var side = sides[i] && sides[i][0] && sides[i][0].categoryName;
        var key = side && !seen[side] ? side : 'mano' + i;
        seen[key] = true;
        var t = trackers[key] || (trackers[key] = makeTracker(key));
        updateTracker(t, lm, dt, r);
        drawn.push({ lm: lm, t: t });
      });
      list().forEach(function (t) { if (!seen[t.key] && ++t.missing > LOST_FRAMES) hideTracker(t); });
      drawHands(drawn);

      // dos manos en pinza: separarlas acerca el modelo, juntarlas lo aleja
      var pins = visible().filter(function (t) { return t.pinched; });
      twoPinch = pins.length >= 2;
      if (twoPinch) {
        var span = Math.hypot(pins[0].pt[0] - pins[1].pt[0], pins[0].pt[1] - pins[1].pt[1]) || 1;
        if (!zoom) zoom = { span: span, dist: scene.dist };
        else scene.dist = Math.min(40, Math.max(8, zoom.dist * zoom.span / span));
        pins.forEach(function (t) { t.zooming = true; t.dragging = false; });
        vel.x = vel.y = 0;
      } else zoom = null;

      // herramienta en la mano: su ícono acompaña al índice de la mano que la tomó
      var tool = heldTool(), vis = visible();
      var carrier = tool ? (holder && vis.indexOf(holder) >= 0 ? holder : vis[0]) : null;
      list().forEach(function (t) {
        if (t === carrier && t.pt) {
          t.badge.innerHTML = tool.icon;
          t.badge.style.display = 'block';
          t.badge.style.transform = 'translate(' + (t.pt[0] - r.left + 12) + 'px,' + (t.pt[1] - r.top - 30) + 'px)';
        } else t.badge.style.display = 'none';
      });

      // resaltado: la mano en pinza, si no la que tiene herramienta, si no la primera
      var lead = pins[0] || carrier || vis[0];
      var hit = lead ? scene.hoverAt(lead.pt[0], lead.pt[1]) : null;
      if (zoom) return setStatus('Dos manos: separa para acercar · junta para alejar');
      if (anyDragging()) return setStatus('Girando el modelo');
      var name = hit && scene.labels && scene.labels[hit];
      setStatus(lead && lead.open ? 'Mano abierta · modelo estable para apuntar con precisión'
        : lead && lead.pinched ? 'Pinza: suelta sin mover para tocar · muévela para girar'
          : hit ? (name ? 'Apuntando: ' + name + ' · haz pinza para tocar' : 'Apuntando a una pieza · haz pinza para tocar')
            : tool ? 'En mano: ' + tool.name + ' · apunta a la pieza y haz pinza'
              : shelf ? 'Haz pinza sobre una herramienta de la izquierda para tomarla'
                : 'Apunta con el índice a una pieza');
    }

    function loop(now) {
      if (!active) return;
      raf = requestAnimationFrame(loop);
      // inercia suave del giro después de soltar la pinza (se frena sola o con la mano abierta)
      if (!anyDragging() && (Math.abs(vel.x) > 5 || Math.abs(vel.y) > 5)) {
        var k = 1 / 60;
        scene.rotateBy(vel.x * k, vel.y * k);
        vel.x *= 0.88; vel.y *= 0.88;
      }
      if (now - lastDetect < FRAME_MS || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastDetect = now; lastVideoTime = video.currentTime;
      var res;
      try { res = landmarker.detectForVideo(video, now); } catch (e) { return; }
      handle(res, now);
    }

    btn.addEventListener('click', function () { if (active || starting) stop(); else start(); });
    if (closeBtn) closeBtn.addEventListener('click', stop);
    if (switchBtn) switchBtn.addEventListener('click', function () {
      facing = facing === 'user' ? 'environment' : 'user';
      openCamera().catch(function () { say('No se pudo cambiar de cámara.'); });
    });

    // para pruebas automatizadas: inyecta un resultado de MediaPipe sin cámara
    stage.__handGestures = { scene: scene, handle: function (res, t) { handle(res, t || performance.now()); }, state: function () {
      var v = visible(), t = v[0];
      return { hands: v.length, points: v.length * 2, pinched: !!(t && t.pinched), dragging: anyDragging(), open: !!(t && t.open), cursor: t ? t.pt : null, zoom: !!zoom, tool: heldTool() && heldTool().k, shelf: !!shelf };
    } };
    return api;
  }

  window.HandGestures = { supported: supported, attach: attach, version: MP_VERSION, preload: loadVision };
})();
