export type ViewId = 'resumen' | 'tecnicos' | 'ingesta' | 'auditoria';

export type Specialty = 'Mecánica Pesada' | 'Alto Voltaje' | 'Refacciones/SBOM';
export type LexicalLevel = 'Operativo' | 'Técnico' | 'Ingeniero';
export type RiskLevel = 'Bajo' | 'Medio' | 'Alto';
export type WorkMode = 'Taller' | 'Rescate en Ruta';
export type SectionStatus = 'aprobada' | 'en curso' | 'bloqueada';

/** Categorías de error que alimentan el Índice de Redundancia de Errores (IRE). */
export type ErrorCategory = 'loto' | 'torque' | 'sbom' | 'aislamiento' | 'diagnostico';

export interface ModuleSection {
  id: 1 | 2 | 3;
  title: string;
  progress: number; // 0-100
  status: SectionStatus;
}

export interface IreBreakdownItem {
  /** errores totales registrados en la categoría */
  total: number;
  /** errores que se repitieron (mismo fallo, ≥2 veces) */
  repeated: number;
}

export type IreBreakdown = Record<ErrorCategory, IreBreakdownItem>;

/** Un repaso / examen que reinicia la curva de olvido con una nueva estabilidad S. */
export interface ReviewPoint {
  day: number;
  stability: number; // S en días
  score: number | null; // null = capacitación inicial (sin examen)
}

export interface FeedbackEntry {
  id: string;
  day: number;
  date: string;
  mode: WorkMode;
  module: string;
  failure: string;
  recommendation: string;
  score: number;
  passed: boolean;
  retentionAtExam: number;
}

export interface Technician {
  id: string;
  name: string;
  initials: string;
  depot: string;
  specialty: Specialty;
  lexicalLevel: LexicalLevel;
  sections: ModuleSection[];
  delegationScore: number;
  hvCertified: boolean;
  currentDay: number;
  reviews: ReviewPoint[];
  ire: IreBreakdown;
  log: FeedbackEntry[];
  /** Examen de refuerzo activado por el administrador solo para este técnico. */
  reinforcement: ReinforcementExam | null;
}

export interface ReinforcementExam {
  category: ErrorCategory;
  activatedDay: number;
  activatedAt: string;
  questions: number;
  reason: string;
}

export interface TorqueSpec {
  component: string;
  spec: string;
  sequence: string;
  tool: string;
  page: number;
}

export interface ExtractedRule {
  id: string;
  rule: string;
  category: 'Seguridad AV' | 'Procedimiento' | 'Diagnóstico' | 'Mecánica';
  page: number;
  confidence: number;
}

export type Criticality = 'Crítica' | 'Alta' | 'Media' | 'Baja';

export interface SbomItem {
  code: string;
  description: string;
  criticality: Criticality;
  workshop: boolean;
  rescueKit: boolean;
  qty: number;
}

export interface ManualExtraction {
  /** presente cuando la extracción proviene del texto real del PDF */
  meta?: ExtractionMeta;
  moduleName: string;
  moduleCode: string;
  vehicle: string;
  pages: number;
  chunks: number;
  rules: ExtractedRule[];
  torques: TorqueSpec[];
  sbom: SbomItem[];
}

export interface PublishedModule {
  code: string;
  name: string;
  date: string;
  targets: string[];
  /** id del `PublishedModulePackage` persistido (si existe) */
  packageId?: string;
}

export interface VisualQuery {
  id: string;
  technicianId: string;
  technician: string;
  unit: string;
  powertrain: 'Diésel' | 'Eléctrico AV';
  device: 'Celular' | 'Visor AR';
  mode: WorkMode;
  minutesAgo: number;
  component: string;
  componentIcon: 'battery' | 'cable' | 'cog' | 'disc' | 'fuel' | 'cpu' | 'fan' | 'gauge';
  confidence: number;
  diagnosis: string;
  sbomCode: string;
  sbomDesc: string;
  hv: boolean;
  needsReinforcement: boolean;
  reinforcementModule?: string;
  bbox: { x: number; y: number; w: number; h: number };
}

/* ═════════════════════════════════════════════════════════════════════
   Contratos compartidos Dashboard ⇄ App del técnico (tecnicos-del-manana)
   Los mismos nombres de campo los consume `tecnicos-del-manana/js/bridge.js`.
   ═════════════════════════════════════════════════════════════════════ */

export type ModuleCategory = 'ev' | 'diesel';
export type AseSpecialty = 'T2' | 'T6' | 'H' | 'L3';

/** Datos adicionales que el extractor real adjunta a `ManualExtraction`. */
export interface ExtractionMeta {
  method: 'pdf-text' | 'plantilla';
  category: ModuleCategory;
  sourceFile: string;
  sourceHash: string | null;
  textChars: number;
  notes: string[];
  /** motor que produjo las entidades: IA en la nube o motor local de reglas */
  engine?: 'ia-cloud' | 'local';
  provider?: string;
  model?: string;
  /** por qué se usó el motor local (sin API key, sin internet…) */
  reason?: string;
  /** contenido didáctico sintetizado por la IA (se suma al generado por reglas) */
  aiLessons?: AiLesson[];
  aiQuestions?: AiQuestion[];
}

export interface AiLesson {
  comp: string;
  level: number;
  title: string;
  cards: { t: string; b: string }[];
  key: string;
  checkQuestion: string;
  checkOptions: string[];
  checkCorrectIndex: number;
}
export interface AiQuestion {
  comp: string;
  level: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type SafetyRuleType = 'epp' | 'loto' | 'verificacion-0v' | 'descarga' | 'rescate' | 'general';

export interface SafetyRule {
  id: string;
  /** posición dentro de la secuencia obligatoria (1 = primero) */
  orden: number;
  texto: string;
  tipo: SafetyRuleType;
  norma: string;
  obligatoria: boolean;
  pagina: number;
}

export interface TorquePair {
  componente: string;
  valorNm: number;
  toleranciaNm: number;
  /** texto original, p. ej. "32 N·m + 90°" */
  especificacion: string;
  secuencia: string;
  herramienta: string;
  pagina: number;
  /** pieza del modelo 3D de la app del técnico a la que se vincula */
  parteId: string;
}

export interface SbomPart {
  codigo: string;
  nombre: string;
  grupoFuncion: string;
  criticidad: Criticality;
  taller: boolean;
  kitRescate: boolean;
  cantidad: number;
  parteId: string;
}

/* Formas compatibles con los arreglos globales de tecnicos-del-manana/js/data*.js */
export interface TdmQuestion {
  id: string;
  c: string;
  lvl: 1 | 2 | 3;
  q: string;
  o: string[];
  a: number;
  exp: string;
  moduloId: string;
  /** reservada para exámenes diferidos / post-test */
  diferida: boolean;
}
export interface TdmLesson {
  id: string;
  comp: string;
  level: 1 | 2;
  min: number;
  title: string;
  ref: string;
  cards: { t: string; b: string }[];
  key: string;
  check: { q: string; o: string[]; a: number };
  moduloId: string;
}
export interface TdmProcedureStep {
  title: string;
  tool: string | null;
  part: string | null;
  instr: string;
  why: string;
  ppe?: boolean;
  setsSafe?: boolean;
  anim?: { id: string; type: 'remove' | 'install' | 'repair' };
  check?: { q: string; o: string[]; a: number; fb: string };
  input?: { label: string; unit: string; value: number; tol: number };
  wait?: { secs: number; label: string };
  reading?: { text: string; status: 'ok' | 'bad' | 'info' };
}
export interface TdmProcedure {
  id: string;
  title: string;
  mode: ModuleCategory;
  comps: string[];
  level: 'Básico' | 'Intermedio' | 'Avanzado';
  min: number;
  hv?: boolean;
  intro: string;
  initial?: { id: string; type: 'remove' | 'install' }[];
  steps: TdmProcedureStep[];
  moduloId: string;
}
export interface TdmPartInfoPatch {
  specs: string[];
  procs: string[];
  tools: string[];
}
export interface TdmDoc {
  id: string;
  title: string;
  text: string;
}

export interface TrainingContent {
  lecciones: TdmLesson[];
  preguntas: TdmQuestion[];
  procedimientos: TdmProcedure[];
  /** se AGREGA a PART_INFO[parteId] (no reemplaza los datos base) */
  partInfo: Record<string, TdmPartInfoPatch>;
  /** se AGREGA a PART_TASKS[parteId]: [herramienta, tarea] */
  tareasPiezas: Record<string, [string, string][]>;
  /** fragmentos para el asistente RAG local (DOCS) */
  docs: TdmDoc[];
}

export interface PublishedModulePackage {
  schema: 'fa.module/v1';
  /** `${codigo}@${version}` */
  id: string;
  codigo: string;
  nombre: string;
  categoria: ModuleCategory;
  vehiculo: string;
  fechaPublicacion: string; // ISO-8601
  version: number;
  destinos: string[];
  publicadoPor: string;
  fuente: {
    archivo: string;
    paginas: number;
    metodo: ExtractionMeta['method'];
    hash: string | null;
    /** 'ia-cloud' (Claude / OpenAI / Gemini) o 'local' (motor de reglas offline) */
    motor?: 'ia-cloud' | 'local';
    proveedor?: string;
  };
  reglasSeguridad: SafetyRule[];
  paresApriete: TorquePair[];
  piezasSBOM: SbomPart[];
  entrenamiento: TrainingContent;
}

export type TelemetryType =
  | 'sesion.inicio'
  | 'diagnostico.completado'
  | 'leccion.completada'
  | 'practica.completada'
  | 'seguridad.error_critico'
  | 'error.registrado'
  | 'error.repetido'
  | 'examen.post'
  | 'examen.diferido'
  | 'repaso.completado'
  | 'delegacion.solicitada';

export interface TelemetryEvent {
  schema: 'fa.telemetry/v1';
  eventId: string;
  tecnicoId: string;
  moduloId: string | null;
  timestamp: number;
  tipo: TelemetryType;
  modo: WorkMode | 'Teoría';
  /** día del reloj simulado de la app del técnico */
  diaSimulado: number;
  tecnico: { nombre: string; especialidadASE: AseSpecialty; nivelLexico: LexicalLevel };
  payload: {
    score?: number;
    passed?: boolean;
    categoria?: ErrorCategory;
    tag?: string;
    etiqueta?: string;
    componente?: string;
    severidad?: 'critica' | 'alta' | 'media';
    actividad?: string;
    titulo?: string;
    nivelDetectado?: string;
    scores?: Record<string, number>;
    retencion?: number | null;
    repeticiones?: number;
    especialidadDestino?: AseSpecialty;
    motivo?: string;
  };
}

export interface SupervisorAlert {
  id: string;
  tecnicoId: string;
  tecnico: string;
  nivel: 'critica' | 'alta' | 'media';
  mensaje: string;
  timestamp: number;
}
