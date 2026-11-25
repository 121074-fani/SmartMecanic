/* Gráficas SVG ligeras (sin librerías) */
const Charts = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Radar: labels[], series [{name, values[0-100], color}] */
  function radar({ labels, series, size = 320 }) {
    const pad = 96, W = size + pad * 2, c = W / 2, r = size / 2, n = labels.length;
    const pt = (i, v) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [c + Math.cos(a) * r * v / 100, c + Math.sin(a) * r * v / 100];
    };
    let s = `<svg viewBox="0 0 ${W} ${W}" class="chart radar" role="img" aria-label="Mapa de competencias">`;
    [25, 50, 75, 100].forEach(v => {
      s += `<polygon points="${labels.map((_, i) => pt(i, v).join(',')).join(' ')}" class="gl"/>`;
    });
    labels.forEach((l, i) => {
      const [x, y] = pt(i, 100), [lx, ly] = pt(i, 122);
      s += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="gl"/>`;
      const anchor = Math.abs(lx - c) < 8 ? 'middle' : lx > c ? 'start' : 'end';
      s += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" class="lbl">${esc(l)}</text>`;
    });
    series.forEach(se => {
      const p = se.values.map((v, i) => pt(i, Math.max(2, v)).join(',')).join(' ');
      s += `<polygon points="${p}" fill="${se.color}" fill-opacity="${se.dash ? 0 : 0.18}" stroke="${se.color}" stroke-width="2.5" ${se.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
      if (!se.dash) se.values.forEach((v, i) => { const [x, y] = pt(i, Math.max(2, v)); s += `<circle cx="${x}" cy="${y}" r="3.5" fill="${se.color}"><title>${esc(labels[i])}: ${v}</title></circle>`; });
    });
    s += '</svg>';
    s += `<div class="legend">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
    return s;
  }

  /** Barras agrupadas: groups[] (etiquetas), series [{name, values[], color}] */
  function bars({ groups, series, height = 230, max = 100 }) {
    const W = 640, H = height, l = 34, b = 46, t = 12, gw = (W - l - 8) / groups.length;
    const bw = Math.min(22, (gw - 10) / series.length);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart bars" role="img">`;
    [0, 25, 50, 75, 100].forEach(v => {
      const y = H - b - (H - b - t) * v / max;
      s += `<line x1="${l}" x2="${W}" y1="${y}" y2="${y}" class="gl"/><text x="${l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" class="ax">${v}</text>`;
    });
    groups.forEach((g, gi) => {
      const x0 = l + gi * gw + (gw - bw * series.length) / 2;
      series.forEach((se, si) => {
        const v = se.values[gi];
        if (v == null) return;
        const h = (H - b - t) * v / max;
        s += `<rect x="${x0 + si * bw}" y="${H - b - h}" width="${bw - 3}" height="${h}" rx="3" fill="${se.color}"><title>${esc(se.name)} · ${esc(g)}: ${v}</title></rect>`;
      });
      s += `<text x="${l + gi * gw + gw / 2}" y="${H - b + 16}" text-anchor="middle" class="ax">${esc(g)}</text>`;
    });
    s += '</svg>';
    s += `<div class="legend">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
    return s;
  }

  /** Líneas: xs[], series [{name, values[], color, dash}] */
  function line({ xs, series, height = 220, max = 100, xLabel = '', markers = [] }) {
    const W = 640, H = height, l = 34, b = 40, t = 12, r = 12;
    const X = i => l + (W - l - r) * i / (xs.length - 1);
    const Y = v => H - b - (H - b - t) * v / max;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart line" role="img">`;
    [0, 25, 50, 75, 100].forEach(v => {
      s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${l - 6}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle" class="ax">${v}</text>`;
    });
    const step = Math.ceil(xs.length / 8);
    xs.forEach((x, i) => { if (i % step === 0 || i === xs.length - 1) s += `<text x="${X(i)}" y="${H - b + 16}" text-anchor="middle" class="ax">${esc(x)}</text>`; });
    markers.forEach(m => { s += `<line x1="${X(m.i)}" x2="${X(m.i)}" y1="${t}" y2="${H - b}" stroke="${m.color || '#94a3b8'}" stroke-dasharray="3 4"/><text x="${X(m.i) + 4}" y="${t + 10}" class="ax" fill="${m.color || '#94a3b8'}">${esc(m.label)}</text>`; });
    series.forEach(se => {
      const d = se.values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.5" ${se.dash ? 'stroke-dasharray="6 5"' : ''}/>`;
    });
    if (xLabel) s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="ax">${esc(xLabel)}</text>`;
    s += '</svg>';
    s += `<div class="legend">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
    return s;
  }

  return { radar, bars, line };
})();
