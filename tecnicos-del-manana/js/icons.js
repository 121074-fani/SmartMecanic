/* =========================================================
   Íconos de línea (SVG propio, sin dependencias ni internet)
   En el texto de la app se escriben como marcadores {{i:nombre}}
   y se convierten en SVG al insertarse en la página.
   ========================================================= */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>',
  practice: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 12l2 2 4-4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.5 3 14.5 0 18c-3-3.5-3-14.5 0-18z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="M6 10v4M10 10v4"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M7 7h4"/>',
  plug: '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  signal: '<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  engine: '<rect x="4" y="8" width="13" height="9" rx="1"/><path d="M8 8V5h5v3"/><path d="M17 11h3v3h-3"/><path d="M4 12H2"/>',
  brake: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2"/>',
  steering: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 14v7M10 12H3M14 12h7"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 7v-4M12 21v-4M7 12H3M21 12h-4"/>',
  seat: '<path d="M7 3h6a1 1 0 0 1 1 1v10H7z"/><path d="M5 14h13v3H5z"/><path d="M7 17v4M16 17v4"/>',
  toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5h8v3"/><path d="M3 13h18M10 13v2h4v-2"/>',
  pointer: '<path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 9.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.5-1.6L9 15"/>',
  star: '<path d="M12 3l2.8 5.6 6.2.9-4.5 4.4 1 6.1L12 17.1 6.5 20l1-6.1L3 9.5l6.2-.9z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  alert: '<path d="M12 3L2 20h20z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  bus: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M7 17v3M17 17v3"/><path d="M7.5 14h.01M16.5 14h.01"/>',
  cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M3 7l9 5 9-5"/>',
  repeat: '<path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5.5 15A7.5 7.5 0 0 0 19 16M18.5 9A7.5 7.5 0 0 0 5 8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  file: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h7M9 17h5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  forward: '<path d="M4 5l8 7-8 7z"/><path d="M12 5l8 7-8 7z"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a7 7 0 0 1 4 6.5"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  factory: '<path d="M3 21V10l6 4v-4l6 4V6l6 3v12z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  trendDown: '<path d="M3 7l6 6 4-4 8 8"/><path d="M21 11v6h-6"/>',
  trendUp: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v6h-6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v15h-7"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8 3l4 6 4-6"/><path d="M12 12.5v5"/>',
  flame: '<path d="M12 2c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-4"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 4"/><path d="M20 20v-4h-4"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  heartf: '<path fill="currentColor" d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  glove: '<path d="M7 21v-6L4.5 11a1.6 1.6 0 0 1 2.6-1.8L9 11.5V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v10l-1.5 6z"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 19h20"/><path d="M8 12l2-2 2 2 3-3"/>',
  meter: '<rect x="6" y="2" width="12" height="20" rx="2"/><rect x="8.5" y="5" width="7" height="4" rx=".5"/><circle cx="12" cy="15" r="2.5"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/><path d="M4 18h16"/>',
  screwdriver: '<path d="M15 3l6 6"/><path d="M13 5l6 6-3 3-6-6z"/><path d="M10 8l-7 7v2l2 2h2l7-7"/>',
  torque: '<circle cx="17" cy="7" r="4"/><path d="M14.2 9.8L3 21"/><path d="M17 5v2l1.5 1"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  flashlight: '<path d="M8 2h8v4l-2 4v12h-4V10L8 6z"/><path d="M12 14v2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  hand: '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5.5a1.5 1.5 0 0 1 3 0V11V8a1.5 1.5 0 0 1 3 0v6a8 8 0 0 1-8 8 7 7 0 0 1-6-3.5L3.5 14a1.5 1.5 0 0 1 2.5-1.6L7 14"/>',
  tape: '<circle cx="9" cy="12" r="6"/><circle cx="9" cy="12" r="2"/><path d="M15 12h7"/>',
  nut: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><circle cx="12" cy="12" r="3"/>',
  vr: '<rect x="2" y="7" width="20" height="10" rx="3"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><path d="M10 12h4"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
};
function ico(name, cls = '') {
  const p = ICONS[name];
  return p ? `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>` : '';
}
const ICON_RE = /\{\{i:([A-Za-z]+)\}\}/g;
const iconize = html => html.indexOf('{{i:') < 0 ? html : html.replace(ICON_RE, (_, n) => ico(n));
/* Toda inserción de HTML pasa por aquí: los marcadores se vuelven íconos SVG */
(() => {
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); },
    set(v) { d.set.call(this, typeof v === 'string' ? iconize(v) : v); },
  });
})();
