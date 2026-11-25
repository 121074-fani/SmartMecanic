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
    var cursor = document.createElement('i');                   // puntero sobre el visor (estilo .hdot existente)
    cursor.className = 'hdot';
    cursor.style.cssText = 'z-index:6;pointer-events:none;transition:background .12s, width .12s, height .12s';
    stage.appendChild(cursor);

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
    var pinched = false, pinchStart = null, dragging = false, lastTap = 0, prevPt = null;
    var vel = { x: 0, y: 0 }, open = false, curPt = null;
    var fx = oneEuro(1.4, 0.03), fy = oneEuro(1.4, 0.03);
    var octx = overlay.getContext('2d');

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
          lost = 99; pinched = false; dragging = false; fx.reset(); fy.reset();
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
      cursor.style.display = 'none';
      octx.clearRect(0, 0, overlay.width, overlay.height);
      scene.hover = null;
      pinched = false; dragging = false; vel.x = vel.y = 0;
    }

    function dispose() { disposed = true; stop(); cursor.remove(); if (box) box.remove(); overlay.remove(); btn.remove(); }
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

    /* ---------- dibujo del esqueleto ---------- */
    function drawHands(hands, primary) {
      var w = overlay.clientWidth, h = overlay.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) { overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr); }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      hands.forEach(function (lm, i) {
        var pts = lm.map(function (p) { return coverMap(p.x, p.y, w, h); });
        var main = i === primary;
        octx.lineWidth = main ? 2 : 1.5;
        octx.strokeStyle = main ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.35)';
        octx.beginPath();
        CONNECTIONS.forEach(function (c) { octx.moveTo(pts[c[0]][0], pts[c[0]][1]); octx.lineTo(pts[c[1]][0], pts[c[1]][1]); });
        octx.stroke();
        octx.fillStyle = main ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)';
        pts.forEach(function (p) { octx.beginPath(); octx.arc(p[0], p[1], main ? 2.6 : 2, 0, Math.PI * 2); octx.fill(); });
        if (main) {   // punta del índice brillante (verde con pinza)
          var t = pts[8];
          octx.beginPath(); octx.arc(t[0], t[1], 9, 0, Math.PI * 2);
          octx.fillStyle = pinched ? 'rgba(34,197,94,.35)' : 'rgba(245,130,31,.35)'; octx.fill();
          octx.beginPath(); octx.arc(t[0], t[1], 4.5, 0, Math.PI * 2);
          octx.fillStyle = pinched ? '#22c55e' : '#f5821f'; octx.fill();
        }
      });
    }

    /* ---------- acciones ---------- */
    function tap(cx, cy) {
      var now = performance.now();
      if (now - lastTap < TAP_COOLDOWN) return;
      lastTap = now;
      var el = document.elementFromPoint(cx, cy);
      if (el === scene.canvas) {
        var hit = scene.selectAt(cx, cy);
        cursor.style.background = hit ? '#22c55e' : '';
        setTimeout(function () { cursor.style.background = ''; }, 350);
        return;
      }
      // botones dentro del visor (acercar, vista inicial, "Continuar" de un aviso…)
      var target = el && stage.contains(el) && el.closest('button, a, [data-a], .opt, [onclick]');
      if (target && target !== btn) target.click();
    }

    function updateCursor(cx, cy) {
      var r = stage.getBoundingClientRect();
      cursor.style.display = 'block';
      cursor.style.width = cursor.style.height = pinched ? '20px' : '16px';
      cursor.style.transform = 'translate(' + (cx - r.left) + 'px,' + (cy - r.top) + 'px) translate(-50%, -50%)';
    }

    /** Procesa el resultado de MediaPipe de un cuadro. */
    function handle(res, now) {
      var dt = Math.min(0.1, Math.max(0.008, (now - (lastFrameT || now - FRAME_MS)) / 1000));
      lastFrameT = now;
      var hands = (res && res.landmarks) || [];
      if (!hands.length) {
        if (++lost > LOST_FRAMES) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          cursor.style.display = 'none';
          if (scene.hover && curPt) scene.hover = null;
          pinched = false; dragging = false; pinchStart = null; prevPt = null; curPt = null; open = false;
          setStatus(mobile ? 'Muestra tu mano frente a la cámara · pinza para tocar · pinza sostenida para girar' : 'Muestra tu mano a la cámara');
        }
        return;
      }
      // mano principal: la más cercana al puntero anterior (o la primera)
      var primary = 0;
      if (hands.length > 1 && curPt) {
        var best = Infinity;
        hands.forEach(function (lm, i) { var p = toStage(lm[8]); var d = Math.hypot(p[0] - curPt[0], p[1] - curPt[1]); if (d < best) { best = d; primary = i; } });
      }
      var lm = hands[primary];
      if (lost > LOST_FRAMES) { fx.reset(); fy.reset(); }
      lost = 0;

      // pinza con histéresis (absoluta y relativa al tamaño de la palma)
      var d = dist(lm[4], lm[8]), palm = dist(lm[0], lm[9]) || 1e-3;
      var wasPinched = pinched;
      if (!pinched && (d < PINCH_ON || d / palm < PINCH_REL_ON)) pinched = true;
      else if (pinched && d > PINCH_OFF && d / palm > PINCH_REL_OFF) pinched = false;
      open = !pinched && isOpenHand(lm);

      // puntero: punta del índice; con pinza, el punto medio pulgar–índice (más estable)
      var src = pinched ? { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 } : lm[8];
      var raw = toStage(src);
      var cutoff = open ? 0.5 : undefined;                       // mano abierta: puntero más estable (precisión)
      var cx = fx.filter(raw[0], dt, cutoff), cy = fy.filter(raw[1], dt, cutoff);
      curPt = [cx, cy];
      drawHands(hands, primary);
      updateCursor(cx, cy);

      if (pinched && !wasPinched) { pinchStart = [cx, cy]; prevPt = [cx, cy]; dragging = false; vel.x = vel.y = 0; }
      if (pinched) {
        if (!dragging && Math.hypot(cx - pinchStart[0], cy - pinchStart[1]) > DRAG_PX) dragging = true;
        if (dragging) {
          var ddx = cx - prevPt[0], ddy = cy - prevPt[1];
          scene.rotateBy(ddx * 1.15, ddy * 1.15);
          vel.x = ddx * 1.15 / dt; vel.y = ddy * 1.15 / dt;
          setStatus('Girando el modelo');
        }
        prevPt = [cx, cy];
      }
      if (!pinched && wasPinched) {
        if (!dragging) tap(cx, cy);
        dragging = false; pinchStart = null; prevPt = null;
      }
      if (open) vel.x = vel.y = 0;

      var hit = scene.hoverAt(cx, cy);
      if (!dragging) {
        var name = hit && scene.labels && scene.labels[hit];
        setStatus(open ? 'Mano abierta · modelo estable para apuntar con precisión'
          : pinched ? 'Pinza: suelta sin mover para tocar · muévela para girar'
            : hit ? (name ? 'Apuntando: ' + name + ' · haz pinza para tocar' : 'Apuntando a una pieza · haz pinza para tocar')
              : 'Apunta con el índice a una pieza');
      }
    }

    function loop(now) {
      if (!active) return;
      raf = requestAnimationFrame(loop);
      // inercia suave del giro después de soltar la pinza (se frena sola o con la mano abierta)
      if (!dragging && (Math.abs(vel.x) > 5 || Math.abs(vel.y) > 5)) {
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
    stage.__handGestures = { scene: scene, handle: function (res, t) { handle(res, t || performance.now()); }, state: function () { return { pinched: pinched, dragging: dragging, open: open, cursor: curPt }; } };
    return api;
  }

  window.HandGestures = { supported: supported, attach: attach, version: MP_VERSION, preload: loadVision };
})();
