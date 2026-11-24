import type {
  FeedbackEntry,
  IreBreakdown,
  LexicalLevel,
  ManualExtraction,
  ModuleSection,
  PublishedModule,
  ReviewPoint,
  Specialty,
  Technician,
  VisualQuery,
} from '../types';
import { dayToDate } from '../lib/retention';

const SECTION_TITLES: Record<Specialty, [string, string, string]> = {
  'Alto Voltaje': ['Seguridad AV y LOTO', 'Batería, inversor y HVIL', 'Diagnóstico y rescate AV'],
  'Mecánica Pesada': ['Fundamentos y seguridad', 'Tren motriz y pares de apriete', 'Diagnóstico J1939 avanzado'],
  'Refacciones/SBOM': ['Catálogo y codificación', 'SBOM por módulo y revisiones', 'Kits de rescate y logística'],
};

const sections = (sp: Specialty, p: [number, number, number]): ModuleSection[] =>
  SECTION_TITLES[sp].map((title, i) => {
    const progress = p[i];
    const status = progress >= 100 ? 'aprobada' : progress > 0 ? 'en curso' : 'bloqueada';
    return { id: (i + 1) as 1 | 2 | 3, title, progress: Math.min(100, progress), status };
  });

const ire = (
  loto: [number, number],
  torque: [number, number],
  sbom: [number, number],
  aislamiento: [number, number],
  diagnostico: [number, number],
): IreBreakdown => ({
  loto: { total: loto[0], repeated: loto[1] },
  torque: { total: torque[0], repeated: torque[1] },
  sbom: { total: sbom[0], repeated: sbom[1] },
  aislamiento: { total: aislamiento[0], repeated: aislamiento[1] },
  diagnostico: { total: diagnostico[0], repeated: diagnostico[1] },
});

const rv = (...pts: [number, number, number | null][]): ReviewPoint[] =>
  pts.map(([day, stability, score]) => ({ day, stability, score }));

const log = (techId: string, entries: Omit<FeedbackEntry, 'id' | 'date'>[]): FeedbackEntry[] =>
  entries.map((e) => ({ ...e, id: `${techId}-${e.day}`, date: dayToDate(e.day) })).reverse();

interface Seed {
  id: string;
  name: string;
  depot: string;
  specialty: Specialty;
  lexicalLevel: LexicalLevel;
  progress: [number, number, number];
  delegation: number;
  hv: boolean;
  day: number;
  reviews: ReviewPoint[];
  ire: IreBreakdown;
  log: Omit<FeedbackEntry, 'id' | 'date'>[];
}

const seeds: Seed[] = [
  {
    id: 'T01', name: 'Mariana Robles Ortiz', depot: 'Depósito Norte · Monterrey', specialty: 'Alto Voltaje',
    lexicalLevel: 'Ingeniero', progress: [100, 100, 72], delegation: 94, hv: true, day: 60,
    reviews: rv([0, 22, null], [15, 35, 88], [35, 56, 92]),
    ire: ire([4, 0], [3, 1], [2, 0], [5, 1], [6, 1]),
    log: [
      { day: 15, mode: 'Taller', module: 'Seguridad AV · Examen diferido D+15', failure: 'Aprobó con 88/100. Error residual: no registró la lectura de tensión residual en la bitácora.', recommendation: 'Consolidado. Próximo repaso espaciado en 17 días (S → 35 d).', score: 88, passed: true, retentionAtExam: 51 },
      { day: 35, mode: 'Rescate en Ruta', module: 'Batería e inversor · Examen diferido D+20', failure: 'Aprobó con 92/100. Error residual: secuencia de apriete en barra colectora invertida en 1 de 8 pernos.', recommendation: 'Consolidado. Próximo repaso espaciado en 28 días (S → 56 d).', score: 92, passed: true, retentionAtExam: 56 },
    ],
  },
  {
    id: 'T02', name: 'José Luis Treviño', depot: 'Depósito Centro · CDMX', specialty: 'Mecánica Pesada',
    lexicalLevel: 'Técnico', progress: [100, 64, 0], delegation: 78, hv: false, day: 45,
    reviews: rv([0, 18, null], [20, 22, 74]),
    ire: ire([3, 1], [9, 5], [4, 1], [0, 0], [4, 2]),
    log: [
      { day: 20, mode: 'Taller', module: 'Pares de apriete · Examen diferido D+20', failure: 'Aplicó 180 N·m en tuercas de rueda (especificación 650 N·m ± 30 en estrella).', recommendation: 'Activar overlay AR de secuencia de apriete con valores N·m sobre cada tornillo detectado.', score: 74, passed: true, retentionAtExam: 33 },
    ],
  },
  {
    id: 'T03', name: 'Daniela Cázares Ruiz', depot: 'Depósito Poniente · Guadalajara', specialty: 'Refacciones/SBOM',
    lexicalLevel: 'Técnico', progress: [100, 100, 38], delegation: 88, hv: false, day: 50,
    reviews: rv([0, 20, null], [15, 32, 85], [32, 48, 90]),
    ire: ire([1, 0], [1, 0], [8, 2], [0, 0], [1, 0]),
    log: [
      { day: 15, mode: 'Taller', module: 'Catálogo · Examen diferido D+15', failure: 'Aprobó con 85/100. Error residual: no validó la revisión de pieza (rev. b obsoleta) contra el sbom del módulo.', recommendation: 'Consolidado. Próximo repaso espaciado en 16 días (S → 32 d).', score: 85, passed: true, retentionAtExam: 47 },
      { day: 32, mode: 'Rescate en Ruta', module: 'SBOM por módulo · Examen diferido D+17', failure: 'Aprobó con 90/100. Error residual: kit de rescate sin fusible de 400 A de repuesto.', recommendation: 'Consolidado. Próximo repaso espaciado en 24 días (S → 48 d).', score: 90, passed: true, retentionAtExam: 59 },
    ],
  },
  {
    id: 'T04', name: 'Ricardo Montemayor', depot: 'Depósito Norte · Monterrey', specialty: 'Alto Voltaje',
    lexicalLevel: 'Operativo', progress: [58, 0, 0], delegation: 52, hv: false, day: 40,
    reviews: rv([0, 12, null], [18, 10, 61]),
    ire: ire([8, 5], [3, 1], [2, 1], [5, 3], [3, 2]),
    log: [
      { day: 18, mode: 'Rescate en Ruta', module: 'Protocolo LOTO · Examen diferido D+18', failure: 'Omitió verificación de ausencia de tensión (< 60 V CC) tras el bloqueo del MSD.', recommendation: 'Reforzar Sección 1 · Micro-cápsula "Verificación de 3 puntos" en Visor AR antes de cualquier intervención HV.', score: 61, passed: false, retentionAtExam: 22 },
    ],
  },
  {
    id: 'T05', name: 'Ana Sofía Villarreal', depot: 'Depósito Sur · Puebla', specialty: 'Alto Voltaje',
    lexicalLevel: 'Técnico', progress: [100, 82, 0], delegation: 81, hv: true, day: 55,
    reviews: rv([0, 16, null], [15, 26, 79], [35, 40, 83]),
    ire: ire([3, 0], [4, 1], [1, 0], [6, 2], [4, 1]),
    log: [
      { day: 15, mode: 'Taller', module: 'Seguridad AV · Examen diferido D+15', failure: 'Aprobó con 79/100. Error residual: no esperó el tiempo de descarga de condensadores del inversor (5 min).', recommendation: 'Consolidado. Próximo repaso espaciado en 13 días (S → 26 d).', score: 79, passed: true, retentionAtExam: 39 },
      { day: 35, mode: 'Taller', module: 'Aislamiento AV · Examen diferido D+20', failure: 'Aprobó con 83/100. Error residual: aceptó lectura límite sin repetir medición.', recommendation: 'Consolidado. Próximo repaso espaciado en 20 días (S → 40 d).', score: 83, passed: true, retentionAtExam: 46 },
    ],
  },
  {
    id: 'T06', name: 'Héctor Garza Leal', depot: 'Depósito Centro · CDMX', specialty: 'Mecánica Pesada',
    lexicalLevel: 'Operativo', progress: [76, 0, 0], delegation: 46, hv: false, day: 38,
    reviews: rv([0, 10, null], [16, 9, 55]),
    ire: ire([5, 3], [10, 7], [6, 3], [0, 0], [3, 2]),
    log: [
      { day: 16, mode: 'Rescate en Ruta', module: 'Pares de apriete · Examen diferido D+16', failure: 'Secuencia de apriete incorrecta en culata (no siguió patrón espiral desde el centro).', recommendation: 'Repetir práctica de Sección 2 con llave dinamométrica Bluetooth y validación automática.', score: 55, passed: false, retentionAtExam: 20 },
    ],
  },
  {
    id: 'T07', name: 'Fernanda Ibarra Solís', depot: 'Depósito Poniente · Guadalajara', specialty: 'Alto Voltaje',
    lexicalLevel: 'Ingeniero', progress: [100, 100, 100], delegation: 97, hv: true, day: 75,
    reviews: rv([0, 25, null], [15, 40, 93], [40, 64, 95], [62, 100, 97]),
    ire: ire([2, 0], [2, 0], [1, 0], [3, 0], [5, 1]),
    log: [
      { day: 40, mode: 'Taller', module: 'HVIL · Examen diferido D+25', failure: 'Aprobó con 95/100. Error residual: documentó DTC sin captura de freeze-frame.', recommendation: 'Consolidado. Próximo repaso espaciado en 32 días (S → 64 d).', score: 95, passed: true, retentionAtExam: 53 },
      { day: 62, mode: 'Rescate en Ruta', module: 'Rescate AV · Examen diferido D+22', failure: 'Aprobó con 97/100. Sin errores críticos.', recommendation: 'Candidata a instructora par. Delegar casos HVIL complejos.', score: 97, passed: true, retentionAtExam: 71 },
    ],
  },
  {
    id: 'T08', name: 'Omar Delgado Peña', depot: 'Depósito Sur · Puebla', specialty: 'Refacciones/SBOM',
    lexicalLevel: 'Operativo', progress: [90, 0, 0], delegation: 63, hv: false, day: 42,
    reviews: rv([0, 13, null], [24, 24, 71]),
    ire: ire([1, 0], [0, 0], [11, 4], [0, 0], [1, 0]),
    log: [
      { day: 24, mode: 'Taller', module: 'Selección SBOM · Examen diferido D+24', failure: 'Seleccionó filtro de combustible primario en lugar del separador de agua (código cruzado).', recommendation: 'Habilitar escaneo obligatorio de código de pieza contra SBOM antes de cerrar la orden.', score: 71, passed: true, retentionAtExam: 16 },
    ],
  },
  {
    id: 'T09', name: 'Luis Ángel Benavides', depot: 'Depósito Norte · Monterrey', specialty: 'Mecánica Pesada',
    lexicalLevel: 'Ingeniero', progress: [100, 100, 55], delegation: 90, hv: false, day: 58,
    reviews: rv([0, 20, null], [15, 32, 86], [38, 50, 89]),
    ire: ire([2, 0], [5, 1], [2, 0], [0, 0], [7, 2]),
    log: [
      { day: 38, mode: 'Rescate en Ruta', module: 'Diagnóstico J1939 · Examen diferido D+23', failure: 'Aprobó con 89/100. Error residual: no consultó el bus can j1939 antes de sustituir el módulo ecu.', recommendation: 'Consolidado. Próximo repaso espaciado en 25 días (S → 50 d).', score: 89, passed: true, retentionAtExam: 49 },
    ],
  },
  {
    id: 'T10', name: 'Karla Elizondo Ramos', depot: 'Depósito Centro · CDMX', specialty: 'Alto Voltaje',
    lexicalLevel: 'Técnico', progress: [100, 30, 0], delegation: 69, hv: false, day: 33,
    reviews: rv([0, 14, null], [15, 17, 72]),
    ire: ire([4, 1], [3, 1], [2, 1], [4, 1], [2, 1]),
    log: [
      { day: 15, mode: 'Taller', module: 'Seguridad AV · Examen diferido D+15', failure: 'Colocó candado LOTO sin tarjeta de identificación personal en el seccionador.', recommendation: 'Asignar simulación guiada LOTO con checklist bloqueante en la app móvil (5 min diarios × 3 días).', score: 72, passed: true, retentionAtExam: 34 },
    ],
  },
  {
    id: 'T11', name: 'Raúl Cantú Moreno', depot: 'Depósito Sur · Puebla', specialty: 'Mecánica Pesada',
    lexicalLevel: 'Técnico', progress: [100, 100, 12], delegation: 84, hv: false, day: 52,
    reviews: rv([0, 18, null], [16, 28, 82], [36, 42, 84]),
    ire: ire([2, 0], [6, 2], [3, 1], [0, 0], [3, 1]),
    log: [
      { day: 36, mode: 'Taller', module: 'Tren motriz · Examen diferido D+20', failure: 'Aprobó con 84/100. Error residual: torque sin llave calibrada en soporte de motor.', recommendation: 'Consolidado. Próximo repaso espaciado en 21 días (S → 42 d).', score: 84, passed: true, retentionAtExam: 49 },
    ],
  },
  {
    id: 'T12', name: 'Paola Quintanilla Vega', depot: 'Depósito Poniente · Guadalajara', specialty: 'Refacciones/SBOM',
    lexicalLevel: 'Ingeniero', progress: [100, 100, 100], delegation: 92, hv: false, day: 70,
    reviews: rv([0, 24, null], [15, 38, 90], [40, 60, 94]),
    ire: ire([0, 0], [1, 0], [7, 1], [0, 0], [2, 0]),
    log: [
      { day: 40, mode: 'Rescate en Ruta', module: 'Kits de rescate · Examen diferido D+25', failure: 'Aprobó con 94/100. Error residual: kit sin guantes clase 0 de talla alterna.', recommendation: 'Consolidado. Próximo repaso espaciado en 30 días (S → 60 d).', score: 94, passed: true, retentionAtExam: 52 },
    ],
  },
];

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const INITIAL_TECHNICIANS: Technician[] = seeds.map((s) => ({
  id: s.id,
  name: s.name,
  initials: initials(s.name),
  depot: s.depot,
  specialty: s.specialty,
  lexicalLevel: s.lexicalLevel,
  sections: sections(s.specialty, s.progress),
  delegationScore: s.delegation,
  hvCertified: s.hv,
  currentDay: s.day,
  reviews: s.reviews,
  ire: s.ire,
  log: log(s.id, s.log),
}));

/* ───────────── Vista 1: curvas agregadas y errores ───────────── */

export const RETENTION_COHORTS = [
  { key: 'aprobados', label: 'Módulos aprobados (S = 48 d)', S: 48 },
  { key: 'refuerzo', label: 'En refuerzo modular (S = 22 d)', S: 22 },
  { key: 'sinAprobar', label: 'Sin aprobar (S = 9 d)', S: 9 },
] as const;

/** Promedio observado en exámenes diferidos (marcadores). */
export const OBSERVED_EXAMS: Record<number, { aprobados: number; refuerzo: number; sinAprobar: number }> = {
  15: { aprobados: 76, refuerzo: 52, sinAprobar: 21 },
  30: { aprobados: 55, refuerzo: 27, sinAprobar: 4 },
  45: { aprobados: 40, refuerzo: 14, sinAprobar: 1 },
  60: { aprobados: 30, refuerzo: 7, sinAprobar: 0 },
};

export type ErrorPeriod = '30d' | '90d';

export const ERROR_RECURRENCE: Record<ErrorPeriod, { category: string; Taller: number; 'Rescate en Ruta': number }[]> = {
  '30d': [
    { category: 'Protocolo LOTO', Taller: 9, 'Rescate en Ruta': 17 },
    { category: 'Pares de apriete', Taller: 21, 'Rescate en Ruta': 11 },
    { category: 'Selección SBOM', Taller: 14, 'Rescate en Ruta': 19 },
    { category: 'Aislamiento AV', Taller: 6, 'Rescate en Ruta': 10 },
    { category: 'Diagnóstico CAN', Taller: 12, 'Rescate en Ruta': 7 },
  ],
  '90d': [
    { category: 'Protocolo LOTO', Taller: 31, 'Rescate en Ruta': 46 },
    { category: 'Pares de apriete', Taller: 58, 'Rescate en Ruta': 33 },
    { category: 'Selección SBOM', Taller: 37, 'Rescate en Ruta': 52 },
    { category: 'Aislamiento AV', Taller: 19, 'Rescate en Ruta': 28 },
    { category: 'Diagnóstico CAN', Taller: 35, 'Rescate en Ruta': 22 },
  ],
};

/* ───────────── Vista 3: módulos y manuales ───────────── */

export const INITIAL_PUBLISHED: PublishedModule[] = [
  { code: 'MOD-AV-101', name: 'Seguridad AV y Protocolo LOTO', date: '04 nov 2026', targets: ['App Móvil', 'Visor AR'] },
  { code: 'MOD-MP-210', name: 'Pares de apriete · Tren motriz diésel', date: '28 oct 2026', targets: ['App Móvil', 'Visor AR'] },
  { code: 'MOD-SB-120', name: 'SBOM · Sistema de frenos neumáticos', date: '19 oct 2026', targets: ['App Móvil'] },
  { code: 'MOD-AV-140', name: 'Batería de tracción 650 V · Módulos y BMS', date: '07 oct 2026', targets: ['App Móvil', 'Visor AR'] },
];
export const BASE_ACTIVE_MODULES = 23;

export const SAMPLE_MANUAL = 'Manual_Inversor_Bus_Electrico_2026.pdf';

export const EXTRACTION_EV: ManualExtraction = {
  moduleName: 'Inversor de tracción y control de motor · Bus eléctrico 12 m',
  moduleCode: 'MOD-AV-215',
  vehicle: 'Autobús urbano eléctrico 12 m · 650 V CC',
  pages: 148,
  chunks: 1_284,
  rules: [
    { id: 'R1', rule: 'Antes de abrir la carcasa del inversor: retirar MSD, aplicar LOTO y esperar ≥ 5 min para descarga del enlace CC.', category: 'Seguridad AV', page: 12, confidence: 0.98 },
    { id: 'R2', rule: 'Verificar ausencia de tensión en 3 puntos (HV+ / HV− / chasis) con multímetro CAT III 1000 V; valor aceptable < 60 V CC.', category: 'Seguridad AV', page: 14, confidence: 0.97 },
    { id: 'R3', rule: 'Resistencia de aislamiento mínima: 500 Ω/V sobre tensión nominal (≥ 325 kΩ a 650 V), medida con megóhmetro a 1000 V.', category: 'Diagnóstico', page: 37, confidence: 0.95 },
    { id: 'R4', rule: 'Sustituir pasta térmica del módulo IGBT en cada apertura; espesor 0.1 mm, cobertura ≥ 95 %.', category: 'Procedimiento', page: 58, confidence: 0.91 },
    { id: 'R5', rule: 'DTC P0A0F / U0293: inspeccionar continuidad del lazo HVIL antes de reemplazar el inversor.', category: 'Diagnóstico', page: 92, confidence: 0.93 },
    { id: 'R6', rule: 'En rescate en ruta: no intentar reinicio del inversor si existe olor a quemado o fuga de refrigerante; solicitar grúa con aislamiento.', category: 'Seguridad AV', page: 121, confidence: 0.96 },
  ],
  torques: [
    { component: 'Terminales HV de entrada (DC+ / DC−)', spec: '9 N·m ± 1', sequence: 'DC− → DC+', tool: 'Llave dinamométrica aislada 1000 V', page: 44 },
    { component: 'Barras de fase U / V / W al motor', spec: '22 N·m ± 2', sequence: 'U → V → W, repaso cruzado', tool: 'Llave dinamométrica aislada', page: 46 },
    { component: 'Tornillos módulo IGBT a disipador', spec: '5 N·m ± 0.5', sequence: 'Patrón cruzado, 2 pasadas (50 % / 100 %)', tool: 'Destornillador dinamométrico', page: 59 },
    { component: 'Carcasa del inversor (M8)', spec: '24 N·m ± 2', sequence: 'Estrella, desde el centro', tool: 'Llave dinamométrica ½"', page: 63 },
    { component: 'Racores de refrigerante', spec: '30 N·m ± 3', sequence: 'Entrada → salida', tool: 'Llave de pata de gallo', page: 71 },
  ],
  sbom: [
    { code: 'INV-650-IGBT-03', description: 'Módulo de potencia IGBT 1200 V / 600 A', criticality: 'Crítica', workshop: true, rescueKit: false, qty: 1 },
    { code: 'HV-MSD-400A', description: 'Desconectador manual de servicio (MSD) 400 A', criticality: 'Crítica', workshop: true, rescueKit: true, qty: 1 },
    { code: 'HV-CON-3P-IL', description: 'Conector HV 3 pines con interlock HVIL', criticality: 'Alta', workshop: true, rescueKit: true, qty: 2 },
    { code: 'TH-PASTE-01', description: 'Pasta térmica conductiva 3.5 W/m·K (50 g)', criticality: 'Media', workshop: true, rescueKit: false, qty: 1 },
    { code: 'CL-GLYCOL-50', description: 'Refrigerante glicol 50/50 baja conductividad (5 L)', criticality: 'Media', workshop: true, rescueKit: true, qty: 1 },
    { code: 'FUS-HV-400', description: 'Fusible HV 400 A / 1000 V CC', criticality: 'Alta', workshop: true, rescueKit: true, qty: 2 },
    { code: 'SEAL-INV-GK', description: 'Junta de carcasa del inversor (IP67)', criticality: 'Baja', workshop: true, rescueKit: false, qty: 1 },
    { code: 'PPE-GLV-C0', description: 'Guantes dieléctricos clase 0 (1000 V)', criticality: 'Crítica', workshop: true, rescueKit: true, qty: 1 },
  ],
};

export const EXTRACTION_DIESEL: ManualExtraction = {
  moduleName: 'Sistema de inyección common-rail · Motor diésel 9 L',
  moduleCode: 'MOD-MP-230',
  vehicle: 'Autobús / combi diésel Euro VI',
  pages: 112,
  chunks: 936,
  rules: [
    { id: 'R1', rule: 'Despresurizar el riel antes de aflojar líneas: esperar ≥ 60 s con motor apagado y verificar < 10 bar por diagnóstico.', category: 'Procedimiento', page: 9, confidence: 0.96 },
    { id: 'R2', rule: 'Nunca reutilizar tubos de alta presión ni arandelas de cobre del inyector.', category: 'Mecánica', page: 22, confidence: 0.94 },
    { id: 'R3', rule: 'Purgar el sistema con bomba manual tras cambio de filtro; no arrancar en seco más de 15 s.', category: 'Procedimiento', page: 31, confidence: 0.92 },
    { id: 'R4', rule: 'DTC SPN 157 FMI 18: verificar sensor de presión de riel antes de sustituir la bomba de alta.', category: 'Diagnóstico', page: 77, confidence: 0.9 },
  ],
  torques: [
    { component: 'Brida de inyector', spec: '32 N·m + 90°', sequence: 'Cilindro 1 → 6', tool: 'Llave dinamométrica + goniómetro', page: 25 },
    { component: 'Tuercas de tubo de alta presión', spec: '28 N·m ± 2', sequence: 'Riel → inyector', tool: 'Llave de pata de gallo', page: 27 },
    { component: 'Tuercas de rueda (M22)', spec: '650 N·m ± 30', sequence: 'Estrella, 2 pasadas', tool: 'Multiplicador de torque', page: 98 },
  ],
  sbom: [
    { code: 'FUEL-INJ-9L-06', description: 'Inyector common-rail 2500 bar', criticality: 'Crítica', workshop: true, rescueKit: false, qty: 6 },
    { code: 'FUEL-FLT-SEP', description: 'Filtro separador de agua primario', criticality: 'Alta', workshop: true, rescueKit: true, qty: 1 },
    { code: 'FUEL-HP-PIPE', description: 'Tubo de alta presión (juego de 6)', criticality: 'Alta', workshop: true, rescueKit: false, qty: 1 },
    { code: 'SEAL-CU-INJ', description: 'Arandela de cobre de inyector', criticality: 'Media', workshop: true, rescueKit: true, qty: 6 },
    { code: 'FUEL-PRIME-HP', description: 'Bomba manual de cebado', criticality: 'Media', workshop: false, rescueKit: true, qty: 1 },
  ],
};

export const PROCESS_STEPS = [
  { label: 'Carga y OCR del documento', detail: 'Reconocimiento de texto, tablas y diagramas' },
  { label: 'Segmentación semántica', detail: 'Fragmentación por sección, procedimiento y advertencia' },
  { label: 'Embeddings e indexado vectorial (RAG)', detail: 'Indexado en base vectorial del módulo' },
  { label: 'Extracción de reglas y pares de apriete', detail: 'Normalización de unidades N·m, V, Ω' },
  { label: 'Construcción del SBOM vinculado', detail: 'Cruce con catálogo maestro de refacciones' },
  { label: 'Validación cruzada de seguridad', detail: 'ISO 6469-3 · NOM-001-SEDE · procedimientos LOTO' },
];

/* ───────────── Vista 4: diagnóstico visual ───────────── */

export const VISUAL_QUERIES: VisualQuery[] = [
  {
    id: 'Q-4821', technicianId: 'T04', technician: 'Ricardo Montemayor', unit: 'Bus E-12 #0412', powertrain: 'Eléctrico AV',
    device: 'Visor AR', mode: 'Rescate en Ruta', minutesAgo: 6, component: 'Conector HV de batería (pack 2)', componentIcon: 'cable',
    confidence: 0.94, diagnosis: 'Pin de interlock HVIL con corrosión; lazo abierto genera DTC P0A0F y bloqueo de tracción.',
    sbomCode: 'HV-CON-3P-IL', sbomDesc: 'Conector HV 3 pines con interlock', hv: true, needsReinforcement: true, reinforcementModule: 'Sección 1 · Protocolo LOTO',
    bbox: { x: 28, y: 30, w: 40, h: 36 },
  },
  {
    id: 'Q-4820', technicianId: 'T02', technician: 'José Luis Treviño', unit: 'Combi D-07 #1190', powertrain: 'Diésel',
    device: 'Celular', mode: 'Taller', minutesAgo: 18, component: 'Disco de freno delantero', componentIcon: 'disc',
    confidence: 0.89, diagnosis: 'Desgaste irregular por apriete desigual de tuercas de rueda; espesor 3 mm bajo mínimo.',
    sbomCode: 'BRK-DSC-F22', sbomDesc: 'Disco de freno ventilado Ø 430 mm', hv: false, needsReinforcement: true, reinforcementModule: 'Sección 2 · Pares de apriete',
    bbox: { x: 22, y: 18, w: 54, h: 58 },
  },
  {
    id: 'Q-4819', technicianId: 'T07', technician: 'Fernanda Ibarra Solís', unit: 'Bus E-12 #0388', powertrain: 'Eléctrico AV',
    device: 'Visor AR', mode: 'Taller', minutesAgo: 34, component: 'Módulo IGBT del inversor', componentIcon: 'cpu',
    confidence: 0.97, diagnosis: 'Sobretemperatura por pasta térmica degradada; ΔT 18 °C entre fases.',
    sbomCode: 'TH-PASTE-01', sbomDesc: 'Pasta térmica conductiva 3.5 W/m·K', hv: true, needsReinforcement: false,
    bbox: { x: 30, y: 26, w: 38, h: 40 },
  },
  {
    id: 'Q-4818', technicianId: 'T08', technician: 'Omar Delgado Peña', unit: 'Bus D-15 #0907', powertrain: 'Diésel',
    device: 'Celular', mode: 'Rescate en Ruta', minutesAgo: 52, component: 'Filtro separador de agua', componentIcon: 'fuel',
    confidence: 0.86, diagnosis: 'Contaminación por agua en combustible; el técnico solicitó filtro primario (código cruzado).',
    sbomCode: 'FUEL-FLT-SEP', sbomDesc: 'Filtro separador de agua primario', hv: false, needsReinforcement: true, reinforcementModule: 'Sección 1 · Selección SBOM',
    bbox: { x: 34, y: 14, w: 30, h: 64 },
  },
  {
    id: 'Q-4817', technicianId: 'T05', technician: 'Ana Sofía Villarreal', unit: 'Bus E-09 #0221', powertrain: 'Eléctrico AV',
    device: 'Visor AR', mode: 'Taller', minutesAgo: 75, component: 'Celdas de batería de tracción', componentIcon: 'battery',
    confidence: 0.91, diagnosis: 'Desbalance de 120 mV en módulo 7; BMS reporta resistencia interna elevada.',
    sbomCode: 'BAT-MOD-LFP-07', sbomDesc: 'Módulo de batería LFP 48 V', hv: true, needsReinforcement: false,
    bbox: { x: 18, y: 28, w: 62, h: 42 },
  },
  {
    id: 'Q-4816', technicianId: 'T06', technician: 'Héctor Garza Leal', unit: 'Combi D-03 #1302', powertrain: 'Diésel',
    device: 'Celular', mode: 'Rescate en Ruta', minutesAgo: 96, component: 'Ventilador del radiador', componentIcon: 'fan',
    confidence: 0.82, diagnosis: 'Embrague viscoso del ventilador patinando; sobrecalentamiento a 104 °C en pendiente.',
    sbomCode: 'COOL-FAN-VC', sbomDesc: 'Embrague viscoso de ventilador', hv: false, needsReinforcement: true, reinforcementModule: 'Sección 2 · Tren motriz',
    bbox: { x: 24, y: 20, w: 50, h: 54 },
  },
  {
    id: 'Q-4815', technicianId: 'T09', technician: 'Luis Ángel Benavides', unit: 'Bus D-18 #0750', powertrain: 'Diésel',
    device: 'Celular', mode: 'Taller', minutesAgo: 140, component: 'Sensor de presión de riel', componentIcon: 'gauge',
    confidence: 0.93, diagnosis: 'Señal intermitente (SPN 157 FMI 18) por conector flojo; bomba de alta en buen estado.',
    sbomCode: 'SNS-RAIL-P', sbomDesc: 'Sensor de presión de riel 0–2500 bar', hv: false, needsReinforcement: false,
    bbox: { x: 38, y: 32, w: 26, h: 30 },
  },
  {
    id: 'Q-4814', technicianId: 'T10', technician: 'Karla Elizondo Ramos', unit: 'Bus E-12 #0455', powertrain: 'Eléctrico AV',
    device: 'Visor AR', mode: 'Rescate en Ruta', minutesAgo: 188, component: 'Desconectador MSD', componentIcon: 'cog',
    confidence: 0.88, diagnosis: 'MSD no asentado completamente; candado LOTO colocado sin tarjeta personal.',
    sbomCode: 'HV-MSD-400A', sbomDesc: 'Desconectador manual de servicio 400 A', hv: true, needsReinforcement: true, reinforcementModule: 'Sección 1 · Seguridad AV y LOTO',
    bbox: { x: 30, y: 24, w: 40, h: 46 },
  },
];
