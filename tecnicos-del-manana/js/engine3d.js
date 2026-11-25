/* =========================================================
   Mini motor 3D (Canvas 2D, sin dependencias → funciona offline)
   - Primitivas: caja y cilindro
   - Cámara orbital (arrastrar = rotar, rueda/pinch = zoom)
   - Iluminación Lambert, ordenamiento por profundidad (painter)
   - Selección de piezas por clic, resaltado pulsante
   - Modo rayos X y modo estéreo (visor VR tipo cardboard)
   ========================================================= */
const E3D = (() => {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const LIGHT = norm([0.5, 0.75, 0.6]);
  const FILL = norm([-0.6, 0.25, -0.55]);

  function finalize(mesh) {
    const c = [0, 0, 0];
    mesh.verts.forEach(v => { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; });
    mesh.center = c.map(x => x / mesh.verts.length);
    mesh.normals = mesh.faces.map(f => {
      const a = mesh.verts[f[0]], b = mesh.verts[f[1]], d = mesh.verts[f[2]];
      let n = norm(cross(sub(b, a), sub(d, a)));
      const fc = faceCenter(mesh, f);
      if (dot(n, sub(fc, mesh.center)) < 0) n = [-n[0], -n[1], -n[2]];
      return n;
    });
    mesh.fcenters = mesh.faces.map(f => faceCenter(mesh, f));
    mesh.rgb = hex(mesh.color);
    return mesh;
  }
  function faceCenter(mesh, f) {
    const c = [0, 0, 0];
    f.forEach(i => { const v = mesh.verts[i]; c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; });
    return c.map(x => x / f.length);
  }

  /** Caja: pos = centro, size = [x,y,z] */
  function _box({ id, pos, size, color, kind = 'part', alpha = 1 }) {
    const [x, y, z] = pos, [w, h, d] = size.map(s => s / 2);
    const verts = [
      [x - w, y - h, z - d], [x + w, y - h, z - d], [x + w, y + h, z - d], [x - w, y + h, z - d],
      [x - w, y - h, z + d], [x + w, y - h, z + d], [x + w, y + h, z + d], [x - w, y + h, z + d],
    ];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    return finalize({ id, verts, faces, color, kind, alpha });
  }

  /** Prisma de 8 vértices: base b y tapa t = [x0, x1, z0, z1, y] (sirve para techos biselados) */
  function _hexa({ id, b, t, color, kind = 'part', alpha = 1 }) {
    const verts = [
      [b[0], b[4], b[2]], [b[1], b[4], b[2]], [t[1], t[4], t[2]], [t[0], t[4], t[2]],
      [b[0], b[4], b[3]], [b[1], b[4], b[3]], [t[1], t[4], t[3]], [t[0], t[4], t[3]],
    ];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    return finalize({ id, verts, faces, color, kind, alpha });
  }

  /** Cilindro a lo largo de un eje ('x' | 'y' | 'z') */
  function _cylinder({ id, pos, radius, length, axis = 'y', segs = 14, color, kind = 'part', alpha = 1 }) {
    const verts = [], faces = [];
    const map = (a, r1, r2) => axis === 'x' ? [a, r1, r2] : axis === 'y' ? [r1, a, r2] : [r1, r2, a];
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2, c = Math.cos(t) * radius, s = Math.sin(t) * radius;
      [-length / 2, length / 2].forEach(a => {
        const p = map(a, c, s);
        verts.push([pos[0] + p[0], pos[1] + p[1], pos[2] + p[2]]);
      });
    }
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      faces.push([i * 2, j * 2, j * 2 + 1, i * 2 + 1]);
    }
    faces.push([...Array(segs)].map((_, i) => i * 2));
    faces.push([...Array(segs)].map((_, i) => i * 2 + 1));
    return finalize({ id, verts, faces, color, kind, alpha });
  }

  /** Extrusión de un perfil convexo [[y, z], ...] a lo largo de x; fx1(y) permite inclinar el frente */
  function _extrude({ id, profile, x0, x1, fx1, segs = 10, color, kind = 'part', alpha = 1 }) {
    // se divide a lo largo de x para que el ordenamiento por profundidad funcione con piezas cercanas
    const verts = [], faces = [], n = profile.length;
    for (let k = 0; k <= segs; k++) profile.forEach(([y, z]) => { const xe = fx1 ? fx1(y) : x1; verts.push([x0 + (xe - x0) * k / segs, y, z]); });
    for (let k = 0; k < segs; k++) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = k * n, b = (k + 1) * n;
      faces.push([a + i, a + j, b + j, b + i]);
    }
    faces.push(profile.map((_, i) => i));
    faces.push(profile.map((_, i) => segs * n + i));
    return finalize({ id, verts, faces, color, kind, alpha });
  }
  /** Perfil de rectángulo redondeado en el plano y–z (sentido antihorario) */
  function roundedProfile(y0, y1, z0, z1, rTop = 0, rBot = 0, segs = 5) {
    const P = [];
    const arc = (cy, cz, r, a0, a1) => { for (let k = 0; k <= segs; k++) { const a = a0 + (a1 - a0) * k / segs; P.push([cy + Math.sin(a) * r, cz + Math.cos(a) * r]); } };
    if (rBot) { arc(y0 + rBot, z0 + rBot, rBot, Math.PI, Math.PI * 1.5); arc(y0 + rBot, z1 - rBot, rBot, Math.PI * 1.5, Math.PI * 2); } else { P.push([y0, z0], [y0, z1]); }
    if (rTop) { arc(y1 - rTop, z1 - rTop, rTop, 0, Math.PI / 2); arc(y1 - rTop, z0 + rTop, rTop, Math.PI / 2, Math.PI); } else { P.push([y1, z1], [y1, z0]); }
    return P;
  }
  const withFx = fn => o => Object.assign(fn(o), { gloss: o.gloss || 0, emit: !!o.emit, soft: !!o.soft, full: !!o.full });
  const box = withFx(_box), cylinder = withFx(_cylinder), hexa = withFx(_hexa), extrude = withFx(_extrude);

  class Scene {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.meshes = [];
      this.yaw = opts.yaw ?? 0.75;
      this.pitch = opts.pitch ?? 0.38;
      this.dist = opts.dist ?? 18;
      this.target = opts.target ?? [0, 1.5, 0];
      this.highlight = null;   // id de componente resaltado
      this.selected = null;
      this.hover = null;
      this.xray = !!opts.xray;
      this.stereo = false;
      this.autoRotate = !!opts.autoRotate;
      this.labels = {};        // id -> texto
      this.parts = {};         // id -> { off:[x,y,z], cur:[x,y,z], tint:'#hex', alpha }
      this.floaters = [];      // efectos flotantes de herramienta
      this.hint = null;        // pieza objetivo sugerida (modo guiado)
      this.tags = {};          // id -> texto corto siempre visible (p. ej. número de tornillo)
      this.hideInternal = opts.hideInternal ?? true;   // ocultar piezas dentro de la carrocería (modelo de autobús)
      this.gridStep = opts.gridStep ?? 1.2;
      this.shadowRect = opts.shadowRect === undefined ? [-6.3, 6.3, -1.5, 1.5] : opts.shadowRect;
      this.gridColor = opts.gridColor ?? 'rgba(15,42,74,0.10)';
      this.onPick = null;
      this.drawn = [];
      this.view = null;        // realidad aumentada: { ox, oy, rot } desplaza y gira la imagen para que el modelo quede "fijo" en el mundo
      this.noGrid = false;     // sin rejilla (cuando el fondo es la cámara)
      this.running = true;
      // límites de la carrocería (cambian con el largo/alto de cada modelo)
      this.body = opts.body || { hx: 6, cy: 1.85, hy: 1.35, hz: 1.25, top: 3.2 };
      if (opts.manual) { this.dpr = 1; return; }   // modo manual: sin ciclo de animación (miniaturas)
      this._bind();
      this._resize();
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(canvas);
      const loop = (t) => { if (!this.running) return; this.render(t); this._raf = requestAnimationFrame(loop); };
      this._raf = requestAnimationFrame(loop);
    }
    destroy() { this.running = false; cancelAnimationFrame(this._raf); this._ro && this._ro.disconnect(); }
    snapshot() { this.render(0); return this.canvas.toDataURL('image/png'); }
    setMeshes(m) { this.meshes = m; }
    _resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, r.width * dpr);
      this.canvas.height = Math.max(1, r.height * dpr);
      this.dpr = dpr;
    }
    _bind() {
      const c = this.canvas;
      let down = null, moved = 0, pinch = null;
      const pts = new Map();
      c.addEventListener('pointerdown', e => {
        c.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        down = [e.clientX, e.clientY]; moved = 0; this.autoRotate = false;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: this.dist }; }
      });
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect();
        if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          this.dist = Math.min(40, Math.max(8, pinch.dist * pinch.d / d));
          moved = 99; return;
        }
        if (down) {
          const dx = e.clientX - down[0], dy = e.clientY - down[1];
          moved += Math.abs(dx) + Math.abs(dy);
          this.yaw -= dx * 0.008;
          this.pitch = Math.min(1.35, Math.max(-0.15, this.pitch + dy * 0.006));
          down = [e.clientX, e.clientY];
        } else {
          const hit = this.pick((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr);
          this.hover = hit;
          c.style.cursor = hit ? 'pointer' : 'grab';
        }
      });
      const up = e => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (down && moved < 6) {
          const r = c.getBoundingClientRect();
          const hit = this.pick((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr);
          if (hit) { this.selected = hit; this.onPick && this.onPick(hit); }
        }
        down = null;
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', () => { this.hover = null; });
      c.addEventListener('wheel', e => {
        e.preventDefault();
        this.dist = Math.min(40, Math.max(8, this.dist * (1 + Math.sign(e.deltaY) * 0.08)));
      }, { passive: false });
    }
    /** Animaciones de pieza: remove (sale y se vuelve fantasma), install (regresa en verde), repair (tinte verde), reset */
    _st(id) { return this.parts[id] || (this.parts[id] = { off: [0, 0, 0], cur: [0, 0, 0], a: 1, aCur: 1, tint: null, flash: null }); }
    /** Estado de una pieza: off (desplazamiento), a (opacidad 0–1), tint (color), instant (sin animación) */
    setPart(id, { off, a, tint, instant } = {}) {
      const st = this._st(id);
      if (off) st.off = [...off];
      if (a != null) st.a = a;
      if (tint !== undefined) st.tint = tint;
      if (instant) { st.cur = [...st.off]; st.aCur = st.a; }
    }
    /** Destello temporal (rojo = error, verde = acierto) */
    flash(id, color = '#ef4444', ms = 900) { const st = this._st(id); st.flash = { color, until: performance.now() + ms }; }
    /** Animaciones de pieza para el taller: remove, install, repair, reset */
    animate(id, type) {
      if (type === 'remove') this.setPart(id, { off: [0, 1.6, 0], a: 0.3, tint: null });
      if (type === 'install') this.setPart(id, { off: [0, 0, 0], a: 1, tint: '#22c55e' });
      if (type === 'repair') this.setPart(id, { tint: '#22c55e' });
      if (type === 'reset') this.setPart(id, { off: [0, 0, 0], a: 1, tint: null });
    }
    resetParts() { this.parts = {}; this.floaters = []; }
    fx(id, text) { this.floaters.push({ id, text, t0: performance.now() }); }
    zoom(f) { this.dist = Math.min(40, Math.max(8, this.dist * f)); }
    focusOn(id) {
      const m = this.meshes.find(m => m.id === id);
      if (!m) return;
      this._anim = { from: [...this.target], to: [m.center[0] * 0.35, 1.2 + m.center[1] * 0.25, m.center[2] * 0.3], t: 0 };
    }
    camera(yawOffset = 0) {
      const yaw = this.yaw + yawOffset, p = this.pitch;
      const pos = [
        this.target[0] + this.dist * Math.cos(p) * Math.sin(yaw),
        this.target[1] + this.dist * Math.sin(p),
        this.target[2] + this.dist * Math.cos(p) * Math.cos(yaw),
      ];
      const fwd = norm(sub(this.target, pos));
      const right = norm(cross(fwd, [0, 1, 0]));
      const up = cross(right, fwd);
      return { pos, fwd, right, up };
    }
    pick(x, y) {
      for (let i = this.drawn.length - 1; i >= 0; i--) {
        const d = this.drawn[i];
        if (d.alpha < 0.5 && d.mesh.kind !== 'part') continue;
        if (pointInPoly(x, y, d.pts)) return d.mesh.kind === 'part' ? d.mesh.id : null;
      }
      return null;
    }
    render(t = 0) {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      if (this.autoRotate) this.yaw += 0.003;
      if (this._anim) {
        this._anim.t = Math.min(1, this._anim.t + 0.06);
        const k = 1 - Math.pow(1 - this._anim.t, 3);
        this.target = this._anim.from.map((v, i) => v + (this._anim.to[i] - v) * k);
        if (this._anim.t >= 1) this._anim = null;
      }
      for (const st of Object.values(this.parts)) { st.cur = st.cur.map((v, i) => v + (st.off[i] - v) * 0.12); st.aCur += (st.a - st.aCur) * 0.15; }
      ctx.clearRect(0, 0, W, H);
      if (this.stereo) {
        const half = W / 2;
        [[-0.035, 0], [0.035, half]].forEach(([off, x0]) => {
          ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, half, H); ctx.clip();
          this._draw(x0, 0, half, H, off, t, x0 === 0);
          ctx.restore();
        });
        ctx.fillStyle = '#000'; ctx.fillRect(half - 2, 0, 4, H);
      } else {
        this._draw(0, 0, W, H, 0, t, true);
      }
    }
    _draw(x0, y0, W, H, yawOff, t, keepPick) {
      const ctx = this.ctx;
      const cam = this.camera(yawOff);
      const f = Math.min(W * 0.75, H) * 1.45;
      const cx = x0 + W / 2, cy = y0 + H / 2 + H * 0.04;
      const V = this.view, vc = V ? Math.cos(V.rot || 0) : 1, vs = V ? Math.sin(V.rot || 0) : 0;
      const vx = V ? (V.ox || 0) * this.dpr : 0, vy = V ? (V.oy || 0) * this.dpr : 0;
      const proj = (p) => {
        const d = sub(p, cam.pos);
        const z = dot(d, cam.fwd);
        let X = dot(d, cam.right) * f / z, Y = -dot(d, cam.up) * f / z;
        if (V) { const x2 = X * vc - Y * vs, y2 = X * vs + Y * vc; X = x2 + vx; Y = y2 + vy; }
        return [cx + X, cy + Y, z];
      };
      // suelo (rejilla)
      if (!this.noGrid) {
      ctx.lineWidth = 1 * this.dpr;
      ctx.strokeStyle = this.gridColor;
      const g = this.gridStep, G = g * 10;
      for (let i = -10; i <= 10; i++) {
        ctx.globalAlpha = 1 - Math.abs(i) / 11;
        [[[i * g, 0, -G], [i * g, 0, G]], [[-G, 0, i * g], [G, 0, i * g]]].forEach(([a, b]) => {
          const pa = proj(a), pb = proj(b);
          if (pa[2] < 0.5 || pb[2] < 0.5) return;
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        });
      }
      ctx.globalAlpha = 1;
      }
      // sombra
      const R = this.shadowRect;
      if (R) {
        [0.5, 0.3, 0.15, 0].forEach((e, k) => {
          const sh = [[R[0] - e, 0.01, R[2] - e], [R[1] + e, 0.01, R[2] - e], [R[1] + e, 0.01, R[3] + e], [R[0] - e, 0.01, R[3] + e]].map(proj);
          if (!sh.every(p => p[2] > 0.5)) return;
          ctx.fillStyle = this.noGrid ? `rgba(0,0,0,${[0.08, 0.1, 0.12, 0.2][k]})` : `rgba(15,42,74,${[0.04, 0.05, 0.06, 0.1][k]})`;
          ctx.beginPath(); sh.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.fill();
        });
      }

      const list = [];
      const pulse = 0.5 + 0.5 * Math.sin(t / 180);
      for (const m of this.meshes) {
        let alpha = m.alpha;
        // con carrocería opaca, las piezas internas no se dibujan (evita que "atraviesen" la carrocería)
        if (this.hideInternal && !this.xray && m.kind === 'part' && Math.abs(m.center[0]) < this.body.hx - 0.05 && m.center[1] < this.body.top && Math.abs(m.center[2]) < this.body.hz - 0.01 && m.id !== this.highlight && m.id !== this.selected && m.id !== this.hint && !(pstOf(this, m.id))) continue;
        if (this.xray && (m.kind === 'body' || m.kind === 'deco' || m.kind === 'trim')) alpha = m.kind === 'body' ? 0.12 : 0.18;
        const pst = this.parts[m.id];
        const off = pst ? pst.cur : null;
        if (pst) { if (pst.aCur < 0.04) continue; if (pst.aCur < 0.999) alpha = Math.min(alpha, pst.aCur); }
        const fl = pst && pst.flash && pst.flash.until > performance.now() ? pst.flash : null;
        const p2 = off ? m.verts.map(v => proj([v[0] + off[0], v[1] + off[1], v[2] + off[2]])) : m.verts.map(proj);
        const isHL = m.id === this.highlight || m.id === this.selected || m.id === this.hint;
        const isHover = m.id === this.hover;
        // ventanas, puertas y franjas están sobre la superficie: se dibujan después de la carrocería
        const layer = (this.hideInternal && m.kind === 'deco' && m.id !== 'wheel' && m.id !== 'hub' && !this.xray) ? 1 : 0;
        // equipo montado sobre el techo: se dibuja después de la carrocería
        const roofTop = this.hideInternal && !this.xray && (m.kind === 'part' || m.kind === 'trim') && m.center[1] > this.body.top + 0.1 ? 1 : 0;
        let out = null;
        if (layer) {
          const B = this.body, d = sub(m.center, [0, B.cy, 0]), sc = [d[0] / B.hx, d[1] / B.hy, d[2] / B.hz];
          const ax = sc.map(Math.abs).indexOf(Math.max(...sc.map(Math.abs)));
          out = { ax, sg: Math.sign(sc[ax]) };
        }
        for (let fi = 0; fi < m.faces.length; fi++) {
          const face = m.faces[fi];
          const pts = face.map(i => p2[i]);
          if (pts.some(p => p[2] < 0.3)) continue;
          const n = m.normals[fi];
          const fc = off ? [m.fcenters[fi][0] + off[0], m.fcenters[fi][1] + off[1], m.fcenters[fi][2] + off[2]] : m.fcenters[fi];
          const toCam = sub(cam.pos, fc);
          if (dot(n, toCam) <= 0) continue;
          if (layer && !m.full && n[out.ax] * out.sg < 0.9) continue; // solo la cara exterior de un detalle de superficie
          let depth = pts.reduce((s, p) => s + p[2], 0) / pts.length;
          let shade = m.emit ? 1.08 : 0.58 + 0.4 * Math.max(0, dot(n, LIGHT)) + 0.1 * Math.max(0, dot(n, FILL)) + 0.05 * Math.max(0, n[1]);
          let [r, g, b] = m.rgb;
          let spec = 0;
          if (m.gloss) { const hv = norm([LIGHT[0] + toCam[0] / Math.hypot(...toCam), LIGHT[1] + toCam[1] / Math.hypot(...toCam), LIGHT[2] + toCam[2] / Math.hypot(...toCam)]); spec = m.gloss * Math.pow(Math.max(0, dot(n, hv)), 28) * 255; }
          if (pst && pst.tint) { const tc = hex(pst.tint); r = (r + tc[0] * 2) / 3; g = (g + tc[1] * 2) / 3; b = (b + tc[2] * 2) / 3; }
          if (fl) { const tc = hex(fl.color), k = 0.55 + 0.45 * Math.abs(Math.sin(t / 90)); r = r + (tc[0] - r) * k; g = g + (tc[1] - g) * k; b = b + (tc[2] - b) * k; shade = Math.max(shade, 0.95); }
          if (isHL) {
            const k = 0.35 + 0.45 * pulse;
            r = r + (255 - r) * k; g = g + (140 - g) * k; b = b + (30 - b) * k;
            shade = Math.max(shade, 0.85);
          } else if (isHover) { shade = Math.min(1.25, shade + 0.25); }
          list.push({ pts, depth, fill: `rgba(${Math.min(255, r * shade + spec) | 0},${Math.min(255, g * shade + spec) | 0},${Math.min(255, b * shade + spec) | 0},${isHL ? 1 : alpha})`, alpha: isHL ? 1 : alpha, mesh: m, hl: isHL, layer: m.kind === 'floor' ? -1 : (layer || roofTop) });
        }
      }
      list.sort((a, b) => (a.layer - b.layer) || (b.depth - a.depth));
      for (const d of list) {
        ctx.beginPath();
        d.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.closePath();
        ctx.fillStyle = d.fill; ctx.fill();
        if (d.mesh.soft && d.alpha > 0.5 && !d.hl) { ctx.strokeStyle = d.fill; ctx.lineWidth = 0.8 * this.dpr; ctx.stroke(); }
        if ((d.alpha > 0.5 && !d.mesh.soft) || d.hl) {
          ctx.strokeStyle = d.hl ? 'rgba(255,200,120,0.9)' : 'rgba(15,23,42,0.22)';
          ctx.lineWidth = (d.hl ? 1.6 : 0.6) * this.dpr; ctx.stroke();
        }
      }
      if (keepPick) this.drawn = list;
      // etiqueta
      const labelId = [this.hover, this.highlight, this.selected, this.hint].find(id => id && this.labels[id]);
      if (labelId && this.labels[labelId]) {
        const m = this.meshes.find(m => m.id === labelId);
        if (m) {
          const p = proj([m.center[0], m.center[1] + 0.4, m.center[2]]);
          if (p[2] > 0.5) this._label(p[0], p[1], this.labels[labelId]);
        }
      }
      const now = performance.now();
      this.floaters = this.floaters.filter(f => now - f.t0 < 1800);
      for (const f of this.floaters) {
        const m = this.meshes.find(m => m.id === f.id);
        const k = (now - f.t0) / 1800;
        const base = m ? m.center : this.target;
        const o = this.parts[f.id]?.cur || [0, 0, 0];
        const p = proj([base[0] + o[0], base[1] + o[1] + 0.6 + k * 1.2, base[2] + o[2]]);
        if (p[2] < 0.5) continue;
        ctx.globalAlpha = 1 - k;
        ctx.font = `${30 * this.dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.text, p[0], p[1]);
        ctx.globalAlpha = 1;
      }
      for (const [id, txt] of Object.entries(this.tags)) {
        const m = this.meshes.find(m => m.id === id); if (!m) continue;
        const st = this.parts[id]; if (st && st.aCur < 0.2) continue;
        const o = st ? st.cur : [0, 0, 0];
        const p = proj([m.center[0] + o[0], m.center[1] + o[1] + 0.16, m.center[2] + o[2]]);
        if (p[2] < 0.5) continue;
        const s = this.dpr, r = 9 * s;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fillStyle = '#0b2d52'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${11 * s}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, p[0], p[1] + 0.5 * s);
      }
    }
    _label(x, y, text) {
      const ctx = this.ctx, s = this.dpr;
      ctx.font = `${600} ${12 * s}px system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 16 * s, h = 24 * s;
      const lx = x - w / 2, ly = y - h - 16 * s;
      ctx.fillStyle = 'rgba(11,45,82,0.95)';
      ctx.strokeStyle = '#f5821f'; ctx.lineWidth = 1.2 * s;
      roundRect(ctx, lx, ly, w, h, 6 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 16 * s); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x, ly + h / 2);
    }
  }

  function pstOf(scene, id) { const st = scene.parts[id]; return st && (st.a < 1 || st.tint || st.off.some(v => v)); }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------- Modelo paramétrico de autobús (eléctrico o diésel) ---------- */
  function buildBus(mode = 'ev') {
    const M = [];
    const D = (id, pos, size, color, o = {}) => M.push(box({ id, pos, size, color, kind: 'deco', ...o }));
    const T = (id, pos, size, color, o = {}) => M.push(box({ id, pos, size, color, kind: 'trim', ...o }));
    // frente ligeramente inclinado hacia atrás en la zona del parabrisas
    const front = y => 6.0 - 0.22 * Math.min(1, Math.max(0, (y - 1.7) / 1.6));
    // carrocería en tres franjas: inferior blanca, banda de vidrio continua y techo redondeado
    M.push(extrude({ id: 'body', profile: roundedProfile(0.5, 1.72, -1.25, 1.25, 0, 0.1), x0: -6, fx1: front, color: '#f8fafc', kind: 'body', gloss: 0.25, soft: true }));
    M.push(extrude({ id: 'glass', profile: [[1.72, -1.25], [1.72, 1.25], [2.98, 1.21], [2.98, -1.21]], x0: -6, fx1: front, color: '#1b2a3d', kind: 'body', gloss: 0.9, soft: true }));
    M.push(extrude({ id: 'roof', profile: roundedProfile(2.98, 3.3, -1.21, 1.21, 0.3, 0, 5), x0: -5.98, fx1: front, color: '#eef2f6', kind: 'body', gloss: 0.3, soft: true }));
    // librea: faldón azul marino con pasos de rueda, franja naranja y divisiones de ventanas
    const seg = (x0, x1, y, h, z, c, id, o) => D(id, [(x0 + x1) / 2, y, z], [x1 - x0, h, 0.03], c, o);
    [[-6, -4.12], [-2.68, 2.68], [4.12, 6]].forEach(([a, b]) => seg(a, b, 0.72, 0.42, -1.265, '#0b2d52', 'skirt', { gloss: 0.3 }));
    [[-6, -4.12], [-2.68, 0.05], [1.15, 2.68], [5.3, 6]].forEach(([a, b]) => seg(a, b, 0.72, 0.42, 1.265, '#0b2d52', 'skirt', { gloss: 0.3 }));
    [-1.265, 1.265].forEach(z => [-3.4, 3.4].forEach(x => D('arch', [x, 0.72, z], [1.44, 0.42, 0.03], '#0b1220')));
    seg(-5.9, 5.9, 0.99, 0.09, -1.265, '#f5821f', 'stripe', { gloss: 0.4 });
    [[-5.9, 0.05], [1.15, 4.2], [5.3, 5.9]].forEach(([a, b]) => seg(a, b, 0.99, 0.09, 1.265, '#f5821f', 'stripe', { gloss: 0.4 }));
    seg(-5.9, 5.9, 1.62, 0.05, -1.265, '#f5821f', 'stripe2');
    [[-5.9, 0.05], [1.15, 4.2], [5.3, 5.9]].forEach(([a, b]) => seg(a, b, 1.62, 0.05, 1.265, '#f5821f', 'stripe2'));
    [-4.0, -2.05, -0.1, 1.85, 3.8].forEach(x => D('pillar', [x, 2.35, -1.255], [0.07, 1.22, 0.03], '#0b1220'));
    [-4.0, -2.05, -0.95, 3.0].forEach(x => D('pillar', [x, 2.35, 1.255], [0.07, 1.22, 0.03], '#0b1220'));
    // puertas de vidrio (lado derecho) con marco
    [[4.75, 'door'], [0.6, 'door2']].forEach(([x, id]) => {
      D(id, [x, 1.75, 1.266], [1.14, 2.44, 0.03], '#0b1220');
      [-0.27, 0.27].forEach(dx => D(id, [x + dx, 1.8, 1.272], [0.5, 2.22, 0.03], '#2b4462', { gloss: 0.9 }));
      D(id, [x, 1.25, 1.278], [1.0, 0.04, 0.03], '#0b1220');
    });
    // frente: letrero de ruta, faros, parrilla y defensa
    D('sign', [front(3.05) + 0.03, 2.86, 0], [0.03, 0.18, 1.6], '#ffb347', { emit: true });
    [-0.88, 0.88].forEach(z => { D('light', [6.02, 0.98, z], [0.03, 0.15, 0.36], '#fff7d6', { emit: true }); D('drl', [6.02, 1.16, z * 1.02], [0.03, 0.04, 0.4], '#e0f2fe', { emit: true }); });
    D('logo', [6.02, 1.32, 0], [0.03, 0.08, 0.5], '#f5821f');
    // parabrisas en dos partes (poste central inclinado) y limpiadores
    M.push(hexa({ id: 'pillar', b: [5.985, 6.03, -0.04, 0.04, 1.74], t: [5.805, 5.85, -0.04, 0.04, 2.96], color: '#0b1220', kind: 'deco' }));
    [-0.5, 0.5].forEach(z => D('wiper', [6.03, 1.8, z], [0.02, 0.03, 0.75], '#111827'));
    // parrilla con rejillas y placa
    D('grille', [6.02, 0.98, 0], [0.03, 0.26, 1.0], '#111827');
    [0.9, 0.98, 1.06].forEach(y => D('slat', [6.025, y, 0], [0.03, 0.025, 0.94], '#374151'));
    [-0.88, 0.88].forEach(z => D('lamp2', [6.025, 0.98, z + Math.sign(z) * 0.05], [0.03, 0.1, 0.12], '#fde68a', { emit: true }));
    T('plate', [6.135, 0.66, 0], [0.01, 0.13, 0.42], '#f8fafc');
    // luces de gálibo laterales (ámbar)
    [-1.268, 1.268].forEach(z => [-5.2, -1.4, 2.0, 5.6].forEach(x => { if (z > 0 && ((x > 0 && x < 1.2) || (x > 4.1 && x < 5.4))) return; D('marker', [x, 0.66, z], [0.12, 0.06, 0.02], '#f59e0b', { emit: true }); }));
    // escotillas del techo
    (mode === 'ev' ? [3.6] : [1.8, 3.8]).forEach(x => T('hatch', [x, 3.32, 0], [0.75, 0.05, 0.62], '#cbd5e1', { gloss: 0.4 }));
    T('bumper', [6.07, 0.66, 0], [0.12, 0.28, 2.42], '#1f2937', { gloss: 0.3 });
    [-1, 1].forEach(sz => { T('mirrorarm', [6.15, 2.95, sz * 1.1], [0.36, 0.04, 0.04], '#111827'); T('mirror', [6.36, 2.62, sz * 1.18], [0.07, 0.5, 0.16], '#111827', { gloss: 0.5 }); });
    // parte trasera: calaveras y defensa
    [-0.98, 0.98].forEach(z => { D('tail', [-6.02, 1.2, z], [0.03, 0.45, 0.16], '#ef4444', { emit: true }); D('tail', [-6.02, 1.5, z], [0.03, 0.12, 0.16], '#f59e0b', { emit: true }); });
    D('rearsign', [-6.02, 2.98, 0], [0.03, 0.16, 1.2], '#ffb347', { emit: true });
    T('bumper_r', [-6.07, 0.66, 0], [0.12, 0.28, 2.42], '#1f2937', { gloss: 0.3 });
    if (mode !== 'ev') { D('grille', [-6.02, 1.45, 0], [0.03, 0.3, 1.4], '#334155'); M.push(hexa({ id: 'ac_pod', b: [-2.9, -0.3, -0.78, 0.78, 3.28], t: [-2.75, -0.45, -0.66, 0.66, 3.55], color: '#e2e8f0', kind: 'trim', gloss: 0.3 })); }
    // llantas: neumático, rin brillante y tapón
    [[3.4, -1.05], [3.4, 1.05], [-3.4, -1.05], [-3.4, 1.05]].forEach(([x, z]) => {
      const sz = Math.sign(z);
      M.push(cylinder({ id: 'wheel', pos: [x, 0.5, z], radius: 0.5, length: 0.34, axis: 'z', segs: 24, color: '#1b1f27', kind: 'deco', soft: true }));
      M.push(cylinder({ id: 'hub', pos: [x, 0.5, z + sz * 0.18], radius: 0.31, length: 0.03, axis: 'z', segs: 20, color: '#d1d5db', kind: 'deco', gloss: 0.8, soft: true }));
      M.push(cylinder({ id: 'hub', pos: [x, 0.5, z + sz * 0.205], radius: 0.12, length: 0.03, axis: 'z', segs: 12, color: '#6b7280', kind: 'deco', gloss: 0.6 }));
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; M.push(cylinder({ id: 'hub', pos: [x + Math.cos(a) * 0.19, 0.5 + Math.sin(a) * 0.19, z + sz * 0.21], radius: 0.022, length: 0.03, axis: 'z', segs: 6, color: '#94a3b8', kind: 'deco', gloss: 0.8 })); }
      M.push(box({ id: 'flap', pos: [x - 0.72, 0.42, z * 1.12], size: [0.03, 0.3, 0.3], color: '#111827', kind: 'trim' }));
    });
    /* ---------- Componentes detallados (varias piezas comparten el mismo id: se seleccionan juntas) ---------- */
    const P = (id, pos, size, color, o = {}) => M.push(box({ id, pos, size, color, ...o }));
    const PC = (id, pos, radius, length, axis, color, o = {}) => M.push(cylinder({ id, pos, radius, length, axis, color, segs: o.segs || 16, ...o }));
    const fins = (id, x, y, z, n, along, len, h, gap, color) => { for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) * gap; P(id, along === 'z' ? [x, y, z + d] : [x + d, y, z], along === 'z' ? [len, h, 0.025] : [0.025, h, len], color, { gloss: 0.5 }); } };

    // comunes: gateway telemático, baterías de 24 V y red CAN
    P('gateway', [5.2, 2.93, -0.3], [0.5, 0.12, 0.4], '#1f2937', { gloss: 0.5 });
    P('gateway', [5.2, 3.0, -0.3], [0.42, 0.03, 0.32], '#374151');
    PC('gateway', [5.38, 3.14, -0.42], 0.015, 0.3, 'y', '#111827', { segs: 6 });
    P('gateway', [5.0, 2.95, -0.1], [0.04, 0.03, 0.03], '#22c55e', { emit: true });
    [4.43, 4.77].forEach(x => {
      P('bateria_24', [x, 0.95, -0.75], [0.32, 0.42, 0.75], '#111827', { gloss: 0.4 });
      P('bateria_24', [x, 1.0, -0.37], [0.24, 0.12, 0.01], '#f5821f');
      PC('bateria_24', [x, 1.2, -0.95], 0.04, 0.08, 'y', '#dc2626', { segs: 8 });
      PC('bateria_24', [x, 1.2, -0.55], 0.04, 0.08, 'y', '#0b0f17', { segs: 8 });
    });
    PC('can', [0, 2.9, -1.02], 0.022, 10.6, 'x', '#84cc16', { segs: 6 });
    PC('can', [0, 2.9, -0.98], 0.022, 10.6, 'x', '#facc15', { segs: 6 });

    if (mode === 'ev') {
      // paquete de baterías del techo: charola, 3 módulos con nervaduras, conectores AV y etiqueta
      P('bateria_av', [-0.3, 3.36, 0], [5.3, 0.08, 1.8], '#475569', { gloss: 0.3 });
      [-2.0, -0.3, 1.4].forEach(x => {
        P('bateria_av', [x, 3.56, 0], [1.6, 0.32, 1.6], '#1e3a5f', { gloss: 0.55 });
        for (let k = -2; k <= 2; k++) P('bateria_av', [x, 3.73, k * 0.3], [1.5, 0.025, 0.06], '#2c5282');
        P('bateria_av', [x + 0.82, 3.55, 0.55], [0.08, 0.14, 0.2], '#f97316');
      });
      P('bateria_av', [-0.3, 3.56, 0.805], [0.55, 0.13, 0.01], '#facc15');
      // compresor de A/C del techo con ventiladores
      P('compresor_ac', [-4.4, 3.47, 0], [1.4, 0.32, 1.5], '#d1d5db', { gloss: 0.45 });
      [-0.38, 0.38].forEach(z => { PC('compresor_ac', [-4.4, 3.64, z], 0.3, 0.02, 'y', '#1f2937', { segs: 20 }); PC('compresor_ac', [-4.4, 3.66, z], 0.08, 0.02, 'y', '#6b7280', { segs: 10 }); });
      PC('cable_ac', [-3.25, 3.36, 0.78], 0.04, 0.9, 'x', '#f97316', { segs: 10 });
      P('cable_ac', [-2.78, 3.36, 0.78], [0.1, 0.1, 0.1], '#c2410c');
      // batería trasera: carcasa con rejillas, etiqueta y conector
      P('bateria_av2', [-5.0, 1.3, 0], [1.4, 1.2, 2.0], '#334155', { gloss: 0.4 });
      for (let k = 0; k < 5; k++) P('bateria_av2', [-4.29, 1.0 + k * 0.14, 0], [0.01, 0.05, 1.6], '#1f2937');
      P('bateria_av2', [-4.29, 1.72, 0.55], [0.01, 0.16, 0.5], '#facc15');
      P('bateria_av2', [-4.28, 1.62, -0.7], [0.06, 0.14, 0.18], '#f97316');
      // MSD: base gris con manija naranja
      P('msd', [-4.15, 1.0, -0.95], [0.3, 0.22, 0.3], '#374151', { gloss: 0.3 });
      P('msd', [-4.15, 1.17, -0.95], [0.09, 0.14, 0.26], '#f97316', { gloss: 0.5 });
      P('msd', [-3.99, 1.0, -0.95], [0.01, 0.1, 0.18], '#facc15');
      // inversor: carcasa de aluminio con aletas, conectores AV y puertos de refrigerante
      P('inversor', [-3.0, 0.92, 0.3], [1.0, 0.44, 0.9], '#9aa6b5', { gloss: 0.7 });
      fins('inversor', -3.0, 1.18, 0.3, 7, 'z', 0.92, 0.08, 0.12, '#b8c2ce');
      [0.08, 0.3, 0.52].forEach(z => PC('inversor', [-2.46, 0.92, z], 0.055, 0.08, 'x', '#f97316', { segs: 10 }));
      [-3.25, -2.85].forEach(x => PC('inversor', [x, 0.8, 0.77], 0.045, 0.06, 'z', '#111827', { segs: 10 }));
      // motor eléctrico: carcasa con anillos, tapas, flecha y caja de terminales
      PC('motor_e', [-2.0, 0.7, -0.2], 0.36, 1.0, 'x', '#475569', { segs: 22, gloss: 0.55 });
      for (let k = 0; k < 5; k++) PC('motor_e', [-2.38 + k * 0.19, 0.7, -0.2], 0.385, 0.04, 'x', '#334155', { segs: 22 });
      [-2.53, -1.47].forEach(x => PC('motor_e', [x, 0.7, -0.2], 0.3, 0.06, 'x', '#1f2937', { segs: 22 }));
      PC('motor_e', [-1.33, 0.7, -0.2], 0.07, 0.22, 'x', '#cbd5e1', { segs: 10, gloss: 0.8 });
      P('motor_e', [-2.0, 1.1, -0.2], [0.3, 0.12, 0.26], '#f97316');
      // convertidor DC/DC con aletas
      P('dcdc', [-4.2, 2.0, 0.65], [0.6, 0.4, 0.6], '#9aa6b5', { gloss: 0.6 });
      fins('dcdc', -4.2, 2.23, 0.65, 5, 'z', 0.55, 0.06, 0.11, '#b8c2ce');
      PC('dcdc', [-3.89, 2.0, 0.55], 0.04, 0.06, 'x', '#f97316', { segs: 8 });
      PC('dcdc', [-3.89, 2.0, 0.78], 0.035, 0.06, 'x', '#111827', { segs: 8 });
      // puerto de carga: tapa abierta, conector con dos polos y LED
      P('puerto_carga', [3.0, 1.55, 1.27], [0.5, 0.5, 0.03], '#111827', { gloss: 0.4 });
      [2.9, 3.1].forEach(x => PC('puerto_carga', [x, 1.47, 1.29], 0.07, 0.03, 'z', '#374151', { segs: 14 }));
      PC('puerto_carga', [3.0, 1.66, 1.29], 0.11, 0.03, 'z', '#374151', { segs: 16 });
      P('puerto_carga', [3.0, 1.83, 1.29], [0.1, 0.03, 0.02], '#22c55e', { emit: true });
      P('puerto_carga', [3.3, 1.55, 1.42], [0.03, 0.48, 0.28], '#e5e7eb', { gloss: 0.4 });
      // sistema de enfriamiento: radiador con aletas y dos ventiladores
      P('enfriamiento', [-5.82, 2.25, 0], [0.26, 1.0, 1.8], '#64748b', { gloss: 0.3 });
      fins('enfriamiento', -5.96, 2.25, 0, 11, 'z', 0.02, 0.95, 0.16, '#94a3b8');
      [-0.42, 0.42].forEach(z => PC('enfriamiento', [-5.99, 2.25, z], 0.34, 0.03, 'x', '#1f2937', { segs: 20 }));
      // cableado de alto voltaje redondo (naranja)
      PC('cable_av', [-5.55, 2.3, 0.95], 0.045, 2.2, 'y', '#f97316', { segs: 10 });
      PC('cable_av', [-3.9, 0.82, 0.95], 0.045, 3.2, 'x', '#f97316', { segs: 10 });
    } else {
      // motor diésel: bloque, culata, tapa de punterías, cárter, poleas y múltiple de escape
      P('motor_d', [-4.8, 1.15, 0], [1.7, 0.9, 1.4], '#64748b', { gloss: 0.4 });
      P('motor_d', [-4.8, 1.72, 0], [1.6, 0.25, 1.2], '#94a3b8', { gloss: 0.4 });
      P('motor_d', [-4.8, 1.92, 0], [1.5, 0.15, 0.9], '#0b2d52', { gloss: 0.6 });
      P('motor_d', [-4.8, 0.62, 0], [1.5, 0.18, 1.1], '#374151');
      PC('motor_d', [-3.92, 0.98, 0], 0.28, 0.06, 'x', '#111827', { segs: 20 });
      PC('motor_d', [-3.92, 1.45, 0.3], 0.16, 0.06, 'x', '#1f2937', { segs: 16 });
      P('motor_d', [-4.8, 1.42, 0.73], [1.4, 0.14, 0.08], '#9a3412', { gloss: 0.2 });
      // turbo: caracol del compresor (claro) y de la turbina (acero caliente)
      PC('turbo', [-3.85, 2.15, 0.45], 0.24, 0.2, 'z', '#d1d5db', { segs: 20, gloss: 0.7 });
      PC('turbo', [-3.85, 2.15, 0.67], 0.26, 0.2, 'z', '#b45309', { segs: 20, gloss: 0.4 });
      PC('turbo', [-3.85, 2.15, 0.56], 0.11, 0.06, 'z', '#6b7280', { segs: 12 });
      // manguera del intercooler con abrazaderas
      PC('manguera_ic', [-4.75, 2.35, 0.55], 0.09, 1.5, 'x', '#111827', { segs: 14, gloss: 0.3 });
      [-5.42, -4.08].forEach(x => PC('manguera_ic', [x, 2.35, 0.55], 0.105, 0.04, 'x', '#cbd5e1', { segs: 14, gloss: 0.8 }));
      // intercooler / radiador: núcleo con aletas y tanques laterales
      P('intercooler', [-5.82, 2.25, 0], [0.26, 0.9, 1.7], '#475569');
      fins('intercooler', -5.96, 2.25, 0, 12, 'z', 0.02, 0.86, 0.13, '#94a3b8');
      [-0.9, 0.9].forEach(z => P('intercooler', [-5.82, 2.25, z], [0.3, 1.0, 0.1], '#1f2937'));
      // postratamiento DPF + SCR: cuerpo brillante, conos, bandas y tubos
      PC('postrat', [-1.6, 0.78, 0.65], 0.32, 1.3, 'x', '#d1d5db', { segs: 22, gloss: 0.7 });
      [-2.35, -0.85].forEach(x => PC('postrat', [x, 0.78, 0.65], 0.22, 0.2, 'x', '#9ca3af', { segs: 18 }));
      [-2.0, -1.6, -1.2].forEach(x => PC('postrat', [x, 0.78, 0.65], 0.335, 0.05, 'x', '#6b7280', { segs: 22 }));
      [-2.6, -0.6].forEach(x => PC('postrat', [x, 0.78, 0.65], 0.07, 0.3, 'x', '#78716c', { segs: 10 }));
      // tanque de AdBlue (tapa azul) y tanque de combustible con cinchos
      P('tanque_adblue', [0.5, 0.8, 0.85], [0.6, 0.45, 0.45], '#f1f5f9', { gloss: 0.4 });
      PC('tanque_adblue', [0.5, 1.06, 0.85], 0.07, 0.06, 'y', '#2563eb', { segs: 12 });
      P('tanque_comb', [1.6, 0.8, -0.75], [1.7, 0.5, 0.7], '#475569', { gloss: 0.55 });
      [1.1, 2.1].forEach(x => P('tanque_comb', [x, 0.8, -0.75], [0.05, 0.53, 0.73], '#1f2937'));
      PC('tanque_comb', [2.2, 1.08, -0.75], 0.07, 0.06, 'y', '#111827', { segs: 12 });
      // ECU de motor: carcasa de aluminio con aletas y conectores
      P('ecu_motor', [-3.7, 2.4, -0.6], [0.45, 0.12, 0.35], '#9aa6b5', { gloss: 0.6 });
      fins('ecu_motor', -3.7, 2.48, -0.6, 4, 'x', 0.3, 0.04, 0.09, '#b8c2ce');
      [-0.68, -0.52].forEach(z => P('ecu_motor', [-3.45, 2.4, z], [0.06, 0.07, 0.1], '#111827'));
      PC('escape', [-5.7, 3.35, -0.8], 0.1, 0.6, 'y', '#52525b', { segs: 10, kind: 'deco' });
    }
    return M;
  }

  /* ---------- Variantes de modelo: largo, alto, librea y ejes extra ---------- */
  function buildModel(model, modeOverride) {
    const mode = modeOverride || (model.power === 'electrico' ? 'ev' : 'diesel');
    let M = buildBus(mode);
    const k = model.len / 12, ky = model.style === 'coach' ? 1.14 : 1;
    if (model.style === 'coach') M = M.filter(m => m.id !== 'door2');
    if (model.power === 'hibrido' && !modeOverride) M.push(box({ id: 'bateria_av', pos: [1.0, 3.42, 0], size: [2.6, 0.24, 1.4], color: '#1e3a5f', gloss: 0.5 }));
    M = M.map(m => {
      const wheel = m.id === 'wheel' || m.id === 'hub', cx = m.center[0];
      const out = { ...m, verts: m.verts.map(v => wheel ? [v[0] + cx * (k - 1), v[1], v[2]] : [v[0] * k, v[1] * ky, v[2]]) };
      if (model.accent && (m.id === 'stripe' || m.id === 'stripe2' || m.id === 'logo')) out.color = model.accent;
      if (model.skirt && m.id === 'skirt') out.color = model.skirt;
      if (model.body && m.id === 'body') out.color = model.body;
      return finalize(out);
    });
    const wheelSet = x => [-1.05, 1.05].forEach(z => {
      const sz = Math.sign(z);
      M.push(cylinder({ id: 'wheel', pos: [x, 0.5, z], radius: 0.5, length: 0.34, axis: 'z', segs: 24, color: '#1b1f27', kind: 'deco', soft: true }));
      M.push(cylinder({ id: 'hub', pos: [x, 0.5, z + sz * 0.18], radius: 0.31, length: 0.03, axis: 'z', segs: 20, color: '#d1d5db', kind: 'deco', gloss: 0.8, soft: true }));
      M.push(box({ id: 'arch', pos: [x, 0.72 * ky, z * 1.205], size: [1.44, 0.42 * ky, 0.03], color: '#0b1220', kind: 'deco' }));
    });
    if (model.style === 'artic') {
      wheelSet(0.2 * k);                                                   // eje central
      // fuelle de la articulación (acordeón)
      M.push(box({ id: 'bellows', pos: [1.6 * k, 1.9, 0], size: [0.6, 2.8, 2.6], color: '#111827', kind: 'deco', full: true }));
      for (let i = 0; i < 6; i++) M.push(box({ id: 'bellows', pos: [1.6 * k - 0.25 + i * 0.1, 1.9, 0], size: [0.035, 2.84, 2.64], color: '#374151', kind: 'deco', full: true }));
    }
    if (model.tagAxle) wheelSet(-3.4 * k - 1.25);                         // eje de apoyo trasero
    if (model.style === 'coach') {                                         // compuertas de equipaje
      [-1.268, 1.268].forEach(z => { for (let i = 0; i < 4; i++) M.push(box({ id: 'bay', pos: [-2.4 * k + i * 1.35 * k * 0.62 + 0.6, 0.98, z], size: [0.03, 0.55, 0.03], color: '#94a3b8', kind: 'deco' })); });
    }
    const body = { hx: 6 * k, cy: 1.85 * ky, hy: 1.35 * ky, hz: 1.25, top: 3.2 * ky };
    return { meshes: M, body, shadow: [-6.3 * k, 6.3 * k, -1.5, 1.5], dist: 16 + (model.len - 12) * 1.15, mode };
  }

  return { Scene, box, cylinder, hexa, extrude, roundedProfile, buildBus, buildModel };
})();