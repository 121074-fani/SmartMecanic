/* =========================================================
   Garage de modelos y grupos de función (módulos)
   Modelos de REFERENCIA para el prototipo: formas y datos
   simplificados; no son especificaciones oficiales.
   ========================================================= */

/* power: electrico | hibrido | diesel · style: city | artic | coach */
const BUS_MODELS = [
  { id: '7900e', name: 'Volvo 7900 Electric', tipo: 'Urbano', power: 'electrico', len: 12, style: 'city', accent: '#16a34a',
    desc: 'Autobús urbano 100 % eléctrico, con baterías de alto voltaje en el techo y motor eléctrico de tracción.' },
  { id: '7900ea', name: 'Volvo 7900 Electric Articulated', tipo: 'Urbano articulado', power: 'electrico', len: 18, style: 'artic', accent: '#16a34a',
    desc: 'Versión articulada de gran capacidad para corredores de alta demanda. Tres ejes y fuelle central.' },
  { id: '7900h', name: 'Volvo 7900 Hybrid', tipo: 'Urbano', power: 'hibrido', len: 12, style: 'city', accent: '#0ea5e9',
    desc: 'Combina un motor diésel con un motor eléctrico y baterías que se recargan al frenar.' },
  { id: '8900', name: 'Volvo 8900', tipo: 'Interurbano', power: 'diesel', len: 12.5, style: 'city', accent: '#f5821f',
    desc: 'Autobús para rutas entre ciudades y periferia, con motor diésel y postratamiento de gases.' },
  { id: '9700', name: 'Volvo 9700', tipo: 'Autocar foráneo', power: 'diesel', len: 13.5, style: 'coach', accent: '#dc2626', skirt: '#1f2937',
    desc: 'Autocar de piso alto para viajes largos, con compartimentos de equipaje bajo el piso.' },
  { id: '9800', name: 'Volvo 9800', tipo: 'Autocar de doble eje trasero', power: 'diesel', len: 14, style: 'coach', tagAxle: true, accent: '#7c3aed', skirt: '#1f2937',
    desc: 'Autocar de gran capacidad con eje de apoyo trasero, para rutas foráneas de larga distancia.' },
];
const POWER_LABEL = { electrico: '🔋 Eléctrico', hibrido: '🔋⛽ Híbrido', diesel: '⛽ Diésel' };

/* Grupos de función de la información de servicio (2–9). Solo 2 y 3 tienen simulaciones hoy. */
const FUNCTION_GROUPS = [
  { n: 2, name: 'Motor', icon: '🔧', available: true,
    sub: { electrico: 'Motor eléctrico de tracción e inversor', hibrido: 'Motor diésel, motor eléctrico e inversor', diesel: 'Admisión, encendido, enfriamiento y postratamiento' } },
  { n: 3, name: 'Sistema eléctrico', icon: '⚡', available: true,
    sub: { electrico: 'Baterías de 24 V y de alto voltaje, cableado y redes', hibrido: 'Baterías, cableado de alto voltaje y redes', diesel: 'Baterías de 24 V, cableado, instrumentos y redes' } },
  { n: 4, name: 'Transmisión', icon: '⚙️', sub: 'Embrague, caja de cambios, flechas y diferencial' },
  { n: 5, name: 'Frenos', icon: '🛑', sub: 'Frenos de servicio, de estacionamiento y ABS' },
  { n: 6, name: 'Dirección y suspensión delantera', icon: '🎯', sub: 'Volante, columna, caja de dirección y eje delantero' },
  { n: 7, name: 'Bastidor, suspensión y ruedas', icon: '🛞', sub: 'Chasis, bolsas de aire, amortiguadores y rines' },
  { n: 8, name: 'Carrocería e interior', icon: '💺', sub: 'Carrocería, asientos, puertas y climatización' },
  { n: 9, name: 'Equipo adicional', icon: '🧰', sub: 'Accesorios y equipo especial' },
];

/* Qué práctica pertenece a qué grupo.
   power: all = todos · ev = eléctrico e híbrido · combustion = diésel e híbrido */
const PRACTICE_CATALOG = [
  { type: 'senala', id: 'bujias', group: 2, power: 'all', note: 'Motor a gas natural de ejemplo (encendido por chispa)' },
  { type: 'aprende', id: 'inversor', group: 2, power: 'ev' },
  { type: 'aprende', id: 'intercooler', group: 2, power: 'combustion' },
  { type: 'taller', id: 'manguera_ic', group: 2, power: 'combustion' },
  { type: 'taller', id: 'dpf_regen', group: 2, power: 'combustion' },
  { type: 'fallas', id: 'diesel_potencia', group: 2, power: 'combustion' },
  { type: 'senala', id: 'bateria24', group: 3, power: 'all' },
  { type: 'aprende', id: 'baterias', group: 3, power: 'all' },
  { type: 'taller', id: 'loto_av', group: 3, power: 'ev' },
  { type: 'taller', id: 'arnes_ac', group: 3, power: 'ev' },
  { type: 'taller', id: 'can_red', group: 3, power: 'all' },
  { type: 'fallas', id: 'ev_aislamiento', group: 3, power: 'ev' },
  { type: 'fallas', id: 'can_comunicacion', group: 3, power: 'all' },
];
const PRACTICE_TYPES = {
  senala: { icon: '👆', name: 'Señala la pieza', order: 1 },
  aprende: { icon: '⭐', name: 'Aprende haciendo', order: 2 },
  taller: { icon: '🔧', name: 'Taller virtual', order: 3 },
  fallas: { icon: '🛠️', name: 'Simulador de fallas', order: 4 },
};
