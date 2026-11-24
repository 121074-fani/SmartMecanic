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
