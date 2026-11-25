/**
 * Ingesta real de manuales: PDF → texto → entidades (reglas, pares de apriete, SBOM)
 * → `PublishedModulePackage` con contenido jugable para `tecnicos-del-manana`.
 *
 * Pipeline:
 *  1. `readPdf`        lectura real del texto por página con pdf.js (en el navegador, sin subir el archivo).
 *  2. `analyzeText`    extracción heurística sobre el TEXTO del documento (regex + léxico técnico ES/EN).
 *                      Si el PDF no tiene capa de texto (escaneado) se usa una plantilla y se informa en `meta.notes`.
 *  3. `buildPackage`   normaliza la selección del supervisor y genera lecciones / preguntas / procedimientos
 *                      compatibles con LESSONS, QUESTIONS, PROCEDURES, PART_INFO y PART_TASKS.
 */
import { EXTRACTION_DIESEL, EXTRACTION_EV } from '../data/mock';
import { nextVersion, publishModule } from './moduleStore';
import { api } from './hubClient';
import type {
  Criticality,
  ExtractedRule,
  ExtractionMeta,
  ManualExtraction,
  ModuleCategory,
  PublishedModulePackage,
  SafetyRule,
  SafetyRuleType,
  SbomItem,
  SbomPart,
  TdmDoc,
  TdmLesson,
  TdmProcedure,
  TdmProcedureStep,
  TdmQuestion,
  TorquePair,
  TorqueSpec,
  TrainingContent,
} from '../types';

/* ═════════════════════ 1. Lectura del PDF ═════════════════════ */

export interface PdfText {
  pages: string[];
  title: string | null;
  numPages: number;
}

const MAX_PAGES = 400;

export async function readPdf(file: File): Promise<PdfText> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  let title: string | null = null;
  try {
    const meta = await doc.getMetadata();
    const t = (meta.info as { Title?: string } | undefined)?.Title;
    title = t && t.trim().length > 3 ? t.trim() : null;
  } catch {
    /* sin metadatos */
  }
  const pages: string[] = [];
  const n = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let s = '';
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      s += it.str + (it.hasEOL ? '\n' : ' ');
    }
    pages.push(s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n'));
    page.cleanup();
  }
  const numPages = doc.numPages;
  await doc.destroy();
  return { pages, title, numPages };
}

export async function sha256(file: File): Promise<string | null> {
  try {
    const d = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/* ═════════════════════ 2. Extracción sobre el texto ═════════════════════ */

const EV_RX = /alto voltaje|alta tensi[oó]n|\bHV\b|\bAV\b|inversor|bater[ií]a de tracci[oó]n|\bMSD\b|HVIL|\bkWh\b|el[eé]ctric|\bBMS\b|IGBT|cargador|high voltage|inverter|traction battery/gi;
const DIESEL_RX = /di[eé]sel|inyector|common.?rail|turbo|\bDPF\b|\bSCR\b|AdBlue|\bDEF\b|combustible|c[aá]rter|aceite de motor|fuel|injector|cilindro/gi;

const SAFETY_RX =
  /peligro|advertencia|precauci[oó]n|warning|danger|caution|obligatori|\bsiempre\b|\bnunca\b|no (?:toque|abra|intente|desconecte|reutilice|arranque)|\bEPP\b|\bPPE\b|\bLOTO\b|bloqueo|etiquetad|lockout|tagout|candado|\bMSD\b|desenergiz|ausencia de tensi[oó]n|\b0 ?V\b|guantes?|diel[eé]ctric|careta|arco el[eé]ctrico|NFPA|OSHA|despresuriz|descarga/i;
const DIAG_RX = /\bDTC\b|\bSPN\b|\bFMI\b|c[oó]digo de falla|\b[PUBC]0[0-9A-F]{3}\b|diagn[oó]stic|J1939|\bCAN\b/i;
const PROC_RX = /reemplaz|sustitu|instal|retir|purg|cambi|verific|inspeccion|medir|mida|limpi|apriet|reutiliz/i;

const TYPE_TESTS: [SafetyRuleType, RegExp][] = [
  ['verificacion-0v', /ausencia de tensi[oó]n|\b0(?:[.,]0)? ?V\b|< ?60 ?V|viva.?muerta|verificar? (?:la )?tensi[oó]n|absence of voltage|mult[ií]metro/i],
  ['descarga', /descarga|capacitor|condensador|esperar?\b.*min|despresuriz/i],
  ['loto', /\bLOTO\b|bloqueo|etiquet|lockout|tagout|candado|\bMSD\b|desconect|seccionador/i],
  ['epp', /\bEPP\b|\bPPE\b|guantes?|careta|diel[eé]ctric|protecci[oó]n personal|arco/i],
  ['rescate', /rescate|en ruta|gr[uú]a|emergencia/i],
];
/** Secuencia canónica OSHA 1910.147 / NFPA 70E: EPP → aislamiento/LOTO → descarga → verificación 0 V. */
const TYPE_ORDER: Record<SafetyRuleType, number> = { epp: 1, loto: 2, descarga: 3, 'verificacion-0v': 4, general: 5, rescate: 6 };
const TYPE_NORM: Record<SafetyRuleType, string> = {
  epp: 'NFPA 70E §130.7 (EPP)',
  loto: 'OSHA 29 CFR 1910.147 (LOTO)',
  descarga: 'NFPA 70E §120.5(7)',
  'verificacion-0v': 'NFPA 70E §120.5(7) · verificación 0 V',
  rescate: 'Procedimiento OEM de rescate',
  general: 'Manual del fabricante',
};
export const SAFETY_TYPE_LABEL: Record<SafetyRuleType, string> = {
  epp: 'EPP dieléctrico',
  loto: 'Aislamiento y bloqueo (LOTO)',
  descarga: 'Descarga / despresurización',
  'verificacion-0v': 'Verificación de ausencia de tensión',
  rescate: 'Rescate en ruta',
  general: 'Regla del manual',
};

export const classifySafety = (text: string): SafetyRuleType => TYPE_TESTS.find(([, rx]) => rx.test(text))?.[0] ?? 'general';
const normOf = (text: string, tipo: SafetyRuleType) => {
  const m = text.match(/(NFPA ?70E[^,;.)]*|OSHA[^,;.)]*|ISO ?6469[^,;.)]*|NOM-[0-9A-Z-]+)/i);
  return m ? m[1].trim() : TYPE_NORM[tipo];
};

const count = (s: string, rx: RegExp) => (s.match(rx) ?? []).length;

const detectCategory = (text: string, fileName: string): ModuleCategory => {
  const ev = count(text, EV_RX) + (/inversor|electric|eléctric|bev|hv|bater/i.test(fileName) ? 15 : 0);
  const di = count(text, DIESEL_RX) + (/diesel|diésel|inyec|motor/i.test(fileName) ? 15 : 0);
  return ev >= di ? 'ev' : 'diesel';
};

/** Frases candidatas por página (línea o sentencia, 25–320 caracteres). */
const sentencesOf = (page: string) =>
  page
    .split(/\n+|(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ0-9•\-–])/)
    .map((s) => s.replace(/^[\s•\-–·*\d.)]+(?=[A-Za-zÁÉÍÓÚÑ])/, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 25 && s.length <= 320 && /[a-záéíóúñ]{3}/i.test(s));

const confidenceOf = (s: string) => {
  let c = 0.8;
  c += Math.min(0.12, count(s, new RegExp(SAFETY_RX.source, 'gi')) * 0.04);
  if (/\d/.test(s) && /(V|N·?m|Nm|min(?:utos?)?|bar|Ω|kΩ|MΩ|°C|A)\b/.test(s)) c += 0.05;
  if (classifySafety(s) !== 'general') c += 0.06; // regla de seguridad tipificada (EPP / LOTO / descarga / 0 V)
  if (s.length > 220) c -= 0.06;
  return Math.max(0.6, Math.min(0.99, Math.round(c * 100) / 100));
};

const UNIT_RX =
  /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:(?:±|\+\/-|\+-)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*)?(N\s?[·.\-]?\s?m\b|Nm\b|lb[\s.-]?ft\b|lbf[\s.-]?ft\b)(?:\s*(?:±|\+\/-|\+-)\s*(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*N\s?[·.]?\s?m)?)?(?:\s*\+\s*(\d{1,3})\s*°)?/gi;

const num = (s: string) => parseFloat(s.replace(',', '.'));
const cleanComponent = (s: string) =>
  s
    .replace(/\b(par|torque|apriete|apretar|aprieta|apriételos?|ajustar?|a|al|de|con|en|del|los|las|el|la|valor|especificaci[oó]n|to|at|tighten)\s*$/gi, '')
    .replace(/[:=\-–—,(]+\s*$/g, '')
    .replace(/^[\s:=\-–—,.)]+/, '')
    .trim();

function extractTorques(pages: string[], category: ModuleCategory): TorqueSpec[] {
  const out: TorqueSpec[] = [];
  pages.forEach((page, pi) => {
    const lines = page.split('\n');
    lines.forEach((line, li) => {
      for (const m of line.matchAll(UNIT_RX)) {
        let v = num(m[1]);
        const isLb = /lb/i.test(m[3]);
        let tol = m[2] ? num(m[2]) : m[4] ? num(m[4]) : NaN;
        if (isLb) {
          v = Math.round(v * 1.3558 * 10) / 10;
          if (!Number.isNaN(tol)) tol = Math.round(tol * 1.3558 * 10) / 10;
        }
        if (!(v >= 0.5 && v <= 3000)) continue;
        let comp = cleanComponent(line.slice(0, m.index).split(/[.;]/).pop() ?? '');
        comp = comp.split(/\s+/).slice(-9).join(' ');
        if (comp.replace(/[^a-záéíóúñ]/gi, '').length < 4) comp = cleanComponent(lines[li - 1] ?? '').split(/\s+/).slice(-9).join(' ');
        if (comp.replace(/[^a-záéíóúñ]/gi, '').length < 4) continue;
        comp = comp.charAt(0).toUpperCase() + comp.slice(1);
        const ctx = `${lines[li - 1] ?? ''} ${line} ${lines[li + 1] ?? ''}`;
        const seq = ctx.match(/(estrella|patr[oó]n cruzado|cruzad[oa]|en cruz|espiral[^.;]*|desde el centro|secuencia[^.;]{0,40}|[A-Z0-9]+ ?(?:→|->) ?[A-Z0-9]+(?: ?(?:→|->) ?[A-Z0-9]+)*|\d pasadas[^.;]*)/i)?.[1];
        const toolHit = ctx.match(/(llave dinamom[eé]trica[^.;,]{0,25}|torqu[ií]metro[^.;,]{0,20}|gonióm|multiplicador de torque|destornillador dinamom[eé]trico)/i)?.[1];
        const hv = category === 'ev' && /HV|AV|alto voltaje|alta tensi[oó]n|bater|inversor|fase|terminal/i.test(ctx);
        const angle = m[5] ? ` + ${m[5]}°` : '';
        const spec = `${v} N·m${Number.isNaN(tol) ? '' : ` ± ${tol}`}${angle}`;
        if (out.some((t) => t.component.toLowerCase() === comp.toLowerCase() && t.spec === spec)) continue;
        out.push({
          component: comp,
          spec,
          sequence: seq ? seq.trim() : 'Según manual',
          tool: toolHit ? toolHit.trim() : hv ? 'Llave dinamométrica aislada 1000 V' : 'Llave dinamométrica calibrada',
          page: pi + 1,
        });
      }
    });
  });
  return out.slice(0, 12);
}

const CODE_RX = /\b(?=[A-Z0-9.-]*\d)(?=[A-Z0-9.-]*[A-Z])[A-Z0-9]{2,10}(?:-[A-Z0-9]{1,8}){1,4}\b/g;
const PN_RX = /(?:n[uú]m(?:ero)?\.?\s*de\s*parte|no\.?\s*de\s*parte|p\/n|part\s*(?:no\.?|number)|ref(?:erencia)?\.)\s*:?\s*([A-Z0-9][A-Z0-9.-]{4,})/gi;
const NOT_PART = /^(ISO|IEC|NFPA|SAE|NOM|OSHA|CAT|DOC|MOD|EN|UL|IP\d|J\d|ASE|DTC|SPN|FMI|ECE|EURO|PAG|FIG|TAB|REV)[-\d]|^\d{1,4}-\d{1,2}(-\d{1,4})?$/i;

const critOf = (d: string): Criticality =>
  /HV|AV\b|alto voltaje|MSD|fusible|IGBT|inyector|freno|guantes? diel|bater[ií]a|contactor|interlock/i.test(d)
    ? 'Crítica'
    : /conector|filtro|bomba|sensor|tubo|cable|arn[eé]s|m[oó]dulo/i.test(d)
      ? 'Alta'
      : /junta|sello|arandela|tornillo|abrazadera|o-?ring|etiqueta/i.test(d)
        ? 'Baja'
        : 'Media';

function extractSbom(pages: string[]): SbomItem[] {
  const out: SbomItem[] = [];
  const add = (code: string, description: string, ctx: string) => {
    code = code.replace(/[.-]+$/, '');
    if (NOT_PART.test(code) || out.some((p) => p.code === code) || code.length < 5) return;
    const desc = description.replace(/^[\s:|\-–—]+/, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Pieza referida en el manual';
    if (!/[a-záéíóúñ]{3}/i.test(desc)) return;
    const qty = ctx.match(/(?:cant(?:idad)?\.?|qty|pzas?\.?)\s*:?\s*(\d{1,3})|\b(\d{1,2})\s*(?:pzas?|piezas|uds?\.?|x)\b/i);
    out.push({
      code,
      description: desc.charAt(0).toUpperCase() + desc.slice(1),
      criticality: critOf(desc),
      workshop: true,
      rescueKit: /fusible|conector|guantes?|filtro|kit|refrigerante|arandela|rescate|cebado|eslinga|extintor/i.test(desc),
      qty: qty ? Math.max(1, +(qty[1] ?? qty[2])) : 1,
    });
  };
  pages.forEach((page) =>
    page.split('\n').forEach((line) => {
      for (const m of line.matchAll(PN_RX)) add(m[1].toUpperCase(), line.replace(m[0], ''), line);
      for (const m of line.matchAll(CODE_RX)) {
        const after = line.slice((m.index ?? 0) + m[0].length);
        const before = line.slice(0, m.index);
        add(m[0], after.replace(/^[^A-Za-zÁÉÍÓÚÑ]+/, '').length > 6 ? after.replace(/^[^A-Za-zÁÉÍÓÚÑ]+/, '') : before, line);
      }
    }),
  );
  return out.slice(0, 16);
}

function extractRules(pages: string[], category: ModuleCategory): ExtractedRule[] {
  type Cand = ExtractedRule & { score: number };
  const cands: Cand[] = [];
  pages.forEach((page, pi) =>
    sentencesOf(page).forEach((s) => {
      const safety = SAFETY_RX.test(s);
      const diag = DIAG_RX.test(s);
      const proc = PROC_RX.test(s) && /\b(debe|deber[aá]|antes|despu[eé]s|nunca|siempre|no\s+\w+|obligatori|requiere|verifique|verificar|must|always|never)\b/i.test(s);
      if (!safety && !diag && !proc) return;
      const category_: ExtractedRule['category'] = safety
        ? category === 'ev'
          ? 'Seguridad AV'
          : 'Procedimiento'
        : diag
          ? 'Diagnóstico'
          : /apriet|torque|reutiliz|junta|tornillo|arandela/i.test(s)
            ? 'Mecánica'
            : 'Procedimiento';
      const confidence = confidenceOf(s);
      const score = confidence + (safety ? 0.3 : 0) + (classifySafety(s) !== 'general' ? 0.2 : 0);
      if (cands.some((c) => c.rule.slice(0, 60) === s.slice(0, 60))) return;
      cands.push({ id: '', rule: s, category: category_, page: pi + 1, confidence, score });
    }),
  );
  return cands
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .sort((a, b) => a.page - b.page)
    .map(({ score: _s, ...r }, i) => ({ ...r, id: `R${i + 1}` }));
}

const prettyName = (fileName: string) =>
  fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const codeFromHash = (category: ModuleCategory, seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `MOD-${category === 'ev' ? 'AV' : 'MP'}-${300 + (h % 600)}`;
};

const template = (category: ModuleCategory) => (category === 'ev' ? EXTRACTION_EV : EXTRACTION_DIESEL);

export function analyzeText(pdf: PdfText, fileName: string, hash: string | null): ManualExtraction {
  const text = pdf.pages.join('\n');
  const category = detectCategory(text, fileName);
  const words = text.split(/\s+/).filter(Boolean).length;
  const notes: string[] = [];

  const baseMeta = (method: ExtractionMeta['method']): ExtractionMeta => ({
    method,
    category,
    sourceFile: fileName,
    sourceHash: hash,
    textChars: text.length,
    notes,
  });

  if (text.replace(/\s/g, '').length < 200) {
    notes.push('El PDF no tiene capa de texto (posible escaneo). Se aplicó la plantilla del dominio detectado; requiere OCR para extracción real.');
    const t = template(category);
    return { ...t, pages: pdf.numPages || t.pages, meta: baseMeta('plantilla') };
  }

  const rules = extractRules(pdf.pages, category);
  const torques = extractTorques(pdf.pages, category);
  const sbom = extractSbom(pdf.pages);

  if (!rules.length && !torques.length && !sbom.length) {
    notes.push('No se detectaron reglas, pares de apriete ni códigos de pieza en el texto. Se aplicó la plantilla del dominio detectado.');
    const t = template(category);
    return { ...t, pages: pdf.numPages, chunks: Math.max(1, Math.ceil(words / 380)), meta: baseMeta('plantilla') };
  }
  if (!torques.length) notes.push('Sin pares de apriete (N·m / lb·ft) en el texto.');
  if (!sbom.length) notes.push('Sin códigos de pieza identificables para el SBOM.');

  const firstLines = (pdf.pages[0] ?? '').split('\n').map((l) => l.trim()).filter((l) => l.length > 8 && l.length < 90 && /[a-záéíóúñ]{4}/i.test(l));
  // título: metadatos del PDF, o la primera línea "de encabezado" (no es oración, advertencia ni DTC)
  const heading = firstLines.slice(0, 6).find((l) => !/[.:;]$/.test(l) && !SAFETY_RX.test(l) && !DIAG_RX.test(l) && l.split(/\s+/).length <= 12);
  const moduleName = pdf.title ?? heading ?? prettyName(fileName);
  const moduleCode = text.match(/\bMOD-[A-Z]{2}-\d{3}\b/)?.[0] ?? codeFromHash(category, hash ?? fileName);
  const vehicle =
    text.match(/((?:autob[uú]s|bus|cami[oó]n|tractocami[oó]n|combi|unidad)[^.\n]{3,60})/i)?.[1]?.trim() ??
    (category === 'ev' ? 'Unidad eléctrica (AV)' : 'Unidad diésel');

  return {
    moduleName: moduleName.slice(0, 90),
    moduleCode,
    vehicle,
    pages: pdf.numPages,
    chunks: Math.max(1, Math.ceil(words / 380)),
    rules,
    torques,
    sbom,
    meta: baseMeta('pdf-text'),
  };
}

/* ───── Extracción con IA (servidor) ───── */

/** Respuesta de `POST /api/ingest/extract` (ver server/aiExtract.ts). */
type AiResponse =
  | {
      mode: 'ai';
      provider: string;
      model: string;
      extraction: {
        moduleName: string;
        moduleCode: string | null;
        vehicle: string;
        category: ModuleCategory;
        rules: { rule: string; category: ExtractedRule['category']; page: number; confidence: number }[];
        torques: { component: string; valueNm: number; toleranceNm: number | null; angleDeg: number | null; sequence: string; tool: string; page: number }[];
        sbom: SbomItem[];
        lessons: NonNullable<ExtractionMeta['aiLessons']>;
        questions: NonNullable<ExtractionMeta['aiQuestions']>;
      };
    }
  | { mode: 'local'; reason: string };

/** Convierte la respuesta de la IA al mismo `ManualExtraction` que produce el motor local. */
function fromAi(ai: Extract<AiResponse, { mode: 'ai' }>, local: ManualExtraction): ManualExtraction {
  const x = ai.extraction;
  const torques: TorqueSpec[] = x.torques
    .filter((t) => t.valueNm > 0 && t.component.trim())
    .map((t) => ({
      component: t.component.trim(),
      spec: `${Math.round(t.valueNm * 10) / 10} N·m${t.toleranceNm != null ? ` ± ${t.toleranceNm}` : ''}${t.angleDeg != null ? ` + ${t.angleDeg}°` : ''}`,
      sequence: t.sequence || 'Según manual',
      tool: t.tool || 'Llave dinamométrica calibrada',
      page: t.page || 1,
    }))
    .filter((t, i, arr) => arr.findIndex((o) => o.component === t.component) === i);
  const sbom = x.sbom.filter((p, i, arr) => p.code.trim() && arr.findIndex((o) => o.code === p.code) === i);
  const meta: ExtractionMeta = {
    ...(local.meta as ExtractionMeta),
    category: x.category,
    engine: 'ia-cloud',
    provider: ai.provider,
    model: ai.model,
    aiLessons: x.lessons,
    aiQuestions: x.questions,
  };
  return {
    moduleName: x.moduleName || local.moduleName,
    moduleCode: x.moduleCode && /^MOD-[A-Z]{2}-\d{3}$/.test(x.moduleCode) ? x.moduleCode : local.moduleCode,
    vehicle: x.vehicle || local.vehicle,
    pages: local.pages,
    chunks: local.chunks,
    rules: x.rules.map((r, i) => ({ id: `R${i + 1}`, rule: r.rule, category: r.category, page: r.page || 1, confidence: Math.max(0, Math.min(1, r.confidence)) })),
    torques,
    sbom,
    meta,
  };
}

/** Extracción completa de un archivo PDF real: IA Cloud si el servidor la tiene configurada, si no el motor local. */
export async function extractFromFile(file: File): Promise<ManualExtraction> {
  const [pdf, hash] = await Promise.all([
    readPdf(file).catch((): PdfText => ({ pages: [], title: null, numPages: 0 })),
    sha256(file),
  ]);
  const local = analyzeText(pdf, file.name, hash);
  if (!pdf.numPages) local.meta?.notes.unshift('No se pudo leer el PDF (dañado o cifrado).');
  const asLocal = (reason: string): ManualExtraction => ({ ...local, meta: local.meta && { ...local.meta, engine: 'local', reason } });
  if (local.meta?.method !== 'pdf-text') return asLocal('el PDF no tiene texto extraíble');

  const ai = await api<AiResponse>('/ingest/extract', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, pages: pdf.pages }),
    timeoutMs: 200_000,
  });
  if (!ai) return asLocal('API local / internet no disponible');
  if (ai.mode !== 'ai') return asLocal(ai.reason);
  const ex = fromAi(ai, local);
  // si la IA no devolvió entidades accionables, se conserva lo que encontró el motor local
  if (!ex.rules.length && !ex.torques.length && !ex.sbom.length) {
    return { ...local, meta: { ...(local.meta as ExtractionMeta), engine: 'ia-cloud', provider: ai.provider, model: ai.model, aiLessons: ex.meta?.aiLessons, aiQuestions: ex.meta?.aiQuestions } };
  }
  return ex;
}

/** Motor de extracción disponible en el servidor (para el log del pipeline). */
export const ingestEngineStatus = () => api<{ engine: 'ia-cloud' | 'local'; provider: string | null }>('/ingest/status');

/** Manual de ejemplo (sin archivo): se usa la plantilla EV etiquetada como tal. */
export const sampleExtraction = (fileName: string): ManualExtraction => ({
  ...EXTRACTION_EV,
  meta: { method: 'plantilla', category: 'ev', sourceFile: fileName, sourceHash: null, textChars: 0, notes: ['Manual de ejemplo precargado.'], engine: 'local', reason: 'manual de ejemplo (sin archivo)' },
});

/* ═════════════════════ 3. Paquete + contenido jugable ═════════════════════ */

const EV_PARTS = ['bateria_av', 'bateria_av2', 'msd', 'inversor', 'motor_e', 'dcdc', 'compresor_ac', 'cable_ac', 'cable_av', 'puerto_carga', 'enfriamiento'];
const DIESEL_PARTS = ['motor_d', 'turbo', 'manguera_ic', 'intercooler', 'postrat', 'tanque_adblue', 'tanque_comb', 'ecu_motor'];
const PART_RULES: [RegExp, string][] = [
  [/\bMSD\b|desconect(?:ador|or) manual|service disconnect|fusible/i, 'msd'],
  [/inversor|IGBT|inverter|enlace CC|fase|U ?\/ ?V ?\/ ?W/i, 'inversor'],
  [/bater[ií]a de tracci|pack|celda|m[oó]dulo de bater|\bBMS\b|barra colectora/i, 'bateria_av'],
  [/DC ?\/ ?DC|convertidor/i, 'dcdc'],
  [/compresor/i, 'compresor_ac'],
  [/puerto de carga|conector de carga|CCS/i, 'puerto_carga'],
  [/refrigerante|enfriamiento|radiador|glicol|racor/i, 'enfriamiento'],
  [/conector HV|cable HV|arn[eé]s|HVIL|terminal(?:es)? HV|conductor/i, 'cable_av'],
  [/motor (?:el[eé]ctrico|de tracci)/i, 'motor_e'],
  [/turbo/i, 'turbo'],
  [/manguera|intercooler/i, 'manguera_ic'],
  [/DPF|SCR|escape|postratamiento/i, 'postrat'],
  [/AdBlue|DEF|urea/i, 'tanque_adblue'],
  [/tanque|separador de agua|filtro (?:de )?combustible|cebado/i, 'tanque_comb'],
  [/ECU|sensor|m[oó]dulo de control/i, 'ecu_motor'],
  [/inyector|riel|common.?rail|culata|cilindro|bomba de alta|rueda|tren motriz|motor/i, 'motor_d'],
  [/bater[ií]a(?:s)? (?:de )?24|borne/i, 'bateria_24'],
  [/\bCAN\b|J1939/i, 'can'],
];
export const partFor = (text: string, category: ModuleCategory): string => {
  const valid = new Set([...(category === 'ev' ? EV_PARTS : DIESEL_PARTS), 'bateria_24', 'can', 'gateway']);
  const hit = PART_RULES.find(([rx, id]) => rx.test(text) && valid.has(id))?.[1];
  return hit ?? (category === 'ev' ? 'inversor' : 'motor_d');
};

const groupOf = (d: string) =>
  /IGBT|inversor|m[oó]dulo de potencia|contactor/i.test(d)
    ? 'Electrónica de potencia AV'
    : /MSD|fusible|interlock|HVIL|conector HV|cable HV/i.test(d)
      ? 'Protección y conexión AV'
      : /guantes|careta|EPP/i.test(d)
        ? 'EPP / seguridad'
        : /refrigerante|pasta t[eé]rmica|glicol|radiador/i.test(d)
          ? 'Gestión térmica'
          : /inyector|combustible|filtro|bomba|tubo de alta|cebado/i.test(d)
            ? 'Sistema de combustible'
            : /junta|sello|arandela|o-?ring/i.test(d)
              ? 'Sellado'
              : /tornillo|tuerca|abrazadera|perno/i.test(d)
                ? 'Fijación'
                : 'General';

export function parseTorque(t: TorqueSpec, category: ModuleCategory): TorquePair {
  const m = t.spec.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*N·?m(?:\s*±\s*(\d+(?:\.\d+)?))?/i);
  const valorNm = m ? +m[1] : 0;
  const toleranciaNm = m?.[2] ? +m[2] : Math.max(0.5, Math.round(valorNm * 0.05 * 10) / 10);
  return {
    componente: t.component,
    valorNm,
    toleranciaNm,
    especificacion: t.spec,
    secuencia: t.sequence,
    herramienta: t.tool,
    pagina: t.page,
    parteId: partFor(t.component, category),
  };
}

const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DISTRACTORS: Record<SafetyRuleType, string[]> = {
  epp: ['Usar guantes de nitrilo del taller si no hay dieléctricos a la mano', 'Retirar el EPP al abrir el MSD para trabajar con más precisión', 'El EPP solo es obligatorio en rescate en ruta'],
  loto: ['Dejar la llave del candado en el tablero para el siguiente turno', 'Usar el candado de un compañero si el tuyo no está', 'Omitir la etiqueta si el trabajo dura menos de 10 minutos'],
  descarga: ['Intervenir de inmediato tras abrir el MSD', 'Esperar solo si se percibe olor a quemado', 'Descargar los capacitores puenteándolos con un desarmador'],
  'verificacion-0v': ['Confiar en la lectura de 0 V del tablero', 'Medir una sola vez sin probar antes el multímetro', 'Verificar con un multímetro CAT II de bolsillo'],
  rescate: ['Reiniciar el sistema varias veces hasta que arranque', 'Remolcar la unidad sin aislar el sistema AV', 'Continuar la ruta si la advertencia desaparece'],
  general: ['Omitir el paso si la unidad urge salir a ruta', 'Hacerlo solo si el supervisor lo solicita', 'Reutilizar las piezas desmontadas para ahorrar tiempo'],
};

const torqueOptions = (v: number, tol: number) => {
  const f = (x: number) => `${Math.round(x * 10) / 10} N·m`;
  const opts = [`${v} N·m ± ${tol}`, f(v * 0.5), f(v * 1.6), f(v * 2.5)];
  return [...new Set(opts)].length === 4 ? opts : [`${v} N·m ± ${tol}`, f(v + 10), f(v + 25), f(Math.max(1, v - 5))];
};

const COMP_IDS = new Set(['hv', 'ev', 'diesel', 'elec', 'sw', 'con', 'diag']);
/** Reordena las opciones para que la correcta quede en el índice 0 (convención de data.js; la app las baraja). */
const correctFirst = (o: string[], i: number) => (i >= 0 && i < o.length ? [o[i], ...o.filter((_, k) => k !== i)] : o);
const clampLvl = (n: number): 1 | 2 | 3 => (n <= 1 ? 1 : n >= 3 ? 3 : 2);

function buildTraining(pkg: Omit<PublishedModulePackage, 'entrenamiento'>, meta?: ExtractionMeta): TrainingContent {
  const { id: moduloId, codigo, categoria } = pkg;
  const key = slug(codigo);
  const safetyComp = categoria === 'ev' ? 'hv' : 'diesel';
  const techComp = categoria === 'ev' ? 'ev' : 'diesel';
  const mandatory = pkg.reglasSeguridad.filter((r) => r.obligatoria).sort((a, b) => a.orden - b.orden);
  const others = pkg.reglasSeguridad.filter((r) => !r.obligatoria);

  const lecciones: TdmLesson[] = [];
  const preguntas: TdmQuestion[] = [];
  const docs: TdmDoc[] = [];
  let qn = 0;
  const q = (c: string, lvl: 1 | 2 | 3, text: string, o: string[], exp: string) =>
    preguntas.push({ id: `${key}-q${++qn}`, c, lvl, q: text, o, a: 0, exp, moduloId, diferida: qn % 2 === 0 });

  /* --- seguridad --- */
  if (mandatory.length) {
    const ref = `${codigo} §Seguridad`;
    docs.push({ id: ref, title: `${pkg.nombre} — Secuencia de seguridad`, text: mandatory.map((r) => `${r.orden}. ${r.texto} (${r.norma})`).join(' ') });
    const seq = [...new Set(mandatory.map((r) => SAFETY_TYPE_LABEL[r.tipo]))];
    const first = mandatory[0];
    const last = mandatory[mandatory.length - 1];
    lecciones.push({
      id: `${key}-seg`,
      comp: safetyComp,
      level: 1,
      min: Math.min(6, 2 + mandatory.length),
      title: `Secuencia obligatoria de seguridad · ${codigo}`,
      ref,
      cards: mandatory.slice(0, 5).map((r) => ({ t: `${r.orden}. ${SAFETY_TYPE_LABEL[r.tipo]}`, b: `${r.texto} — ${r.norma}` })),
      key: seq.join(' → '),
      check: {
        q: `Según ${codigo}, ¿qué va PRIMERO en la secuencia de seguridad?`,
        o: [short(first.texto, 110), mandatory.length > 1 ? short(last.texto, 110) : 'Iniciar el desmontaje y verificar al final', 'Comenzar por la pieza dañada y asegurar después', 'Depende del criterio de cada técnico'],
        a: 0,
      },
      moduloId,
    });
    mandatory.forEach((r) => {
      const lvl = r.tipo === 'epp' ? 1 : r.tipo === 'verificacion-0v' ? 3 : 2;
      q(safetyComp, lvl, `Según el manual ${codigo}, ¿qué es obligatorio en «${SAFETY_TYPE_LABEL[r.tipo]}»?`, [short(r.texto, 140), ...DISTRACTORS[r.tipo]], `${r.texto} Referencia: ${r.norma}, pág. ${r.pagina}.`);
    });
    if (seq.length >= 3) {
      const wrong1 = [...seq].reverse();
      const wrong2 = [seq[1], seq[0], ...seq.slice(2)];
      const wrong3 = [...seq.slice(1), seq[0]];
      q(safetyComp, 3, `¿Cuál es el orden correcto de la secuencia de seguridad de ${codigo}?`, [seq.join(' → '), wrong1.join(' → '), wrong2.join(' → '), wrong3.join(' → ')], 'OSHA 1910.147 y NFPA 70E: protegerse, aislar y bloquear, esperar la descarga y verificar 0 V antes de intervenir.');
    }
  }

  /* --- diagnóstico / procedimiento (reglas no obligatorias) --- */
  if (others.length) {
    const ref = `${codigo} §Procedimiento`;
    docs.push({ id: ref, title: `${pkg.nombre} — Reglas de procedimiento y diagnóstico`, text: others.map((r) => r.texto).join(' ') });
    lecciones.push({
      id: `${key}-proc`,
      comp: 'diag',
      level: 2,
      min: Math.min(6, 2 + others.length),
      title: `Reglas de procedimiento y diagnóstico · ${codigo}`,
      ref,
      cards: others.slice(0, 5).map((r, i) => ({ t: `Regla ${i + 1} · pág. ${r.pagina}`, b: r.texto })),
      key: 'Evidencia primero: confirma con medición o DTC antes de sustituir piezas.',
      check: { q: `¿Cuál de estas reglas pertenece a ${codigo}?`, o: [short(others[0].texto, 120), ...DISTRACTORS.general], a: 0 },
      moduloId,
    });
    others.slice(0, 4).forEach((r) => q('diag', 2, `Según ${codigo}, ¿qué indica el manual?`, [short(r.texto, 140), ...DISTRACTORS.general], `${r.texto} (pág. ${r.pagina}).`));
  }

  /* --- pares de apriete --- */
  if (pkg.paresApriete.length) {
    const ref = `${codigo} §Pares`;
    docs.push({ id: ref, title: `${pkg.nombre} — Pares de apriete`, text: pkg.paresApriete.map((t) => `${t.componente}: ${t.especificacion}, secuencia ${t.secuencia}, herramienta ${t.herramienta}.`).join(' ') });
    const t0 = pkg.paresApriete[0];
    lecciones.push({
      id: `${key}-torque`,
      comp: techComp,
      level: 2,
      min: Math.min(6, 2 + pkg.paresApriete.length),
      title: `Pares de apriete · ${pkg.nombre}`,
      ref,
      cards: pkg.paresApriete.slice(0, 5).map((t) => ({ t: t.componente, b: `${t.especificacion} · secuencia: ${t.secuencia} · ${t.herramienta} (pág. ${t.pagina})` })),
      key: 'Llave calibrada, valor del manual y secuencia indicada: nunca "a sentimiento".',
      check: { q: `¿Qué par especifica ${codigo} para «${short(t0.componente, 60)}»?`, o: torqueOptions(t0.valorNm, t0.toleranciaNm), a: 0 },
      moduloId,
    });
    pkg.paresApriete.forEach((t) =>
      q(techComp, 2, `Par de apriete especificado para «${short(t.componente, 70)}» (${codigo}):`, torqueOptions(t.valorNm, t.toleranciaNm), `${t.especificacion}, secuencia ${t.secuencia}, con ${t.herramienta}.`),
    );
  }

  /* --- SBOM --- */
  if (pkg.piezasSBOM.length) {
    const ref = `${codigo} §SBOM`;
    docs.push({ id: ref, title: `${pkg.nombre} — SBOM`, text: pkg.piezasSBOM.map((p) => `${p.codigo} ${p.nombre} (${p.grupoFuncion}, ${p.criticidad}${p.kitRescate ? ', kit de rescate' : ''}).`).join(' ') });
    const groups = [...new Set(pkg.piezasSBOM.map((p) => p.grupoFuncion))];
    const p0 = pkg.piezasSBOM[0];
    const codes = pkg.piezasSBOM.map((p) => p.codigo);
    const fakeCodes = (c: string) => [c.replace(/\d(?=\D*$)/, (d) => String((+d + 1) % 10)), `${c}-R`, c.split('').reverse().join('').toUpperCase()];
    const codeOpts = (c: string) => [c, ...[...codes.filter((x) => x !== c), ...fakeCodes(c)].slice(0, 3)];
    lecciones.push({
      id: `${key}-sbom`,
      comp: techComp,
      level: 1,
      min: Math.min(5, 2 + groups.length),
      title: `SBOM y kit de rescate · ${codigo}`,
      ref,
      cards: groups.slice(0, 5).map((g) => ({
        t: g,
        b: pkg.piezasSBOM.filter((p) => p.grupoFuncion === g).map((p) => `${p.codigo} · ${p.nombre}${p.kitRescate ? ' (kit de rescate)' : ''}`).join(' | '),
      })),
      key: 'Valida código y revisión contra el SBOM del módulo antes de cerrar la orden.',
      check: { q: `¿Qué código corresponde a «${short(p0.nombre, 60)}»?`, o: codeOpts(p0.codigo), a: 0 },
      moduloId,
    });
    pkg.piezasSBOM.slice(0, 6).forEach((p) => q(techComp, 2, `Código SBOM de «${short(p.nombre, 70)}» en ${codigo}:`, codeOpts(p.codigo), `${p.codigo} · ${p.nombre} · grupo ${p.grupoFuncion} · criticidad ${p.criticidad}.`));
  }

  /* --- procedimiento jugable (Taller / Rescate) --- */
  const procedimientos: TdmProcedure[] = [];
  const procId = `${key}-taller`;
  const ruleFor = (t: SafetyRuleType) => mandatory.find((r) => r.tipo === t);
  const torqueSteps: TdmProcedureStep[] = pkg.paresApriete.slice(0, 4).map((t) => ({
    title: `Apretar ${short(t.componente, 50)}`,
    tool: 'torque',
    part: t.parteId,
    instr: `Aprieta «${t.componente}» al valor de ${codigo} (secuencia: ${t.secuencia}).`,
    why: `Especificación ${t.especificacion}, pág. ${t.pagina}. Fuera de tolerancia se registra como error de apriete.`,
    input: { label: short(t.componente, 40), unit: 'N·m', value: t.valorNm, tol: Math.max(0.5, t.toleranciaNm) },
  }));
  const ruleCheck = (r: SafetyRule | undefined, fallbackQ: string) =>
    r ? { q: fallbackQ, o: [short(r.texto, 120), ...DISTRACTORS[r.tipo]], a: 0, fb: `${r.norma} · pág. ${r.pagina}` } : undefined;

  let steps: TdmProcedureStep[];
  if (categoria === 'ev') {
    steps = [
      { title: 'Colocar EPP dieléctrico', tool: 'guantes', part: 'self', ppe: true, instr: ruleFor('epp')?.texto ?? 'Selecciona los guantes dieléctricos y aplícalos ("Usar en mí").', why: 'Última barrera si falla la desenergización (NFPA 70E §130.7).', check: ruleCheck(ruleFor('epp'), `¿Qué exige ${codigo} sobre el EPP?`) },
      { title: 'Registrar el estado inicial', tool: 'escaner', part: 'gateway', instr: 'Conecta la herramienta de diagnóstico y documenta DTC y estado.', why: 'Documentas antes de intervenir.', reading: { text: `Módulo ${codigo} · DTC documentados · Contacto OFF`, status: 'info' } },
      { title: 'Desconectar baterías de 24 V', tool: 'manual', part: 'bateria_24', instr: 'Llave fuera; desconecta las baterías de 24 V.', why: 'Sin 24 V los contactores AV no cierran.', check: { q: '¿Qué borne desconectas primero?', o: ['El negativo (–)', 'El positivo (+)', 'Da igual', 'Ambos a la vez'], a: 0, fb: 'Negativo primero evita cortos a chasis.' } },
      { title: 'Retirar el MSD', tool: 'guantes', part: 'msd', anim: { id: 'msd', type: 'remove' }, instr: ruleFor('loto')?.texto ?? 'Con los guantes puestos, retira el MSD.', why: 'Abre físicamente el circuito de tracción.' },
      { title: 'Bloquear y etiquetar (LOTO)', tool: 'candado', part: 'msd', instr: 'Coloca tu candado personal y etiqueta.', why: 'OSHA 29 CFR 1910.147: nadie puede reenergizar mientras trabajas.', check: ruleCheck(ruleFor('loto'), `¿Qué exige ${codigo} en el bloqueo?`) },
      { title: 'Esperar la descarga', tool: null, part: null, wait: { secs: 8, label: ruleFor('descarga') ? short(ruleFor('descarga')!.texto, 80) : 'Descarga de capacitores (simulado en 8 s)' }, instr: 'Espera el tiempo de descarga del manual.', why: 'Los capacitores conservan tensión tras abrir el MSD.' },
      { title: 'Prueba "viva": probar el multímetro', tool: 'multimetro', part: 'bateria_24', instr: 'Prueba el multímetro en una fuente conocida.', why: 'Confirma que el instrumento mide.', reading: { text: '25.3 V CC — el instrumento funciona', status: 'ok' } },
      { title: 'Prueba "muerta": verificar 0 V', tool: 'multimetro', part: 'inversor', instr: ruleFor('verificacion-0v')?.texto ?? 'Mide +/–, +/chasis y –/chasis.', why: 'NFPA 70E §120.5(7): única forma de saber que no hay tensión.', reading: { text: '0.0 V (+/–) · 0.0 V (+/chasis) · 0.0 V (–/chasis)', status: 'ok' } },
      { title: 'Prueba "viva" final', tool: 'multimetro', part: 'bateria_24', setsSafe: true, instr: 'Vuelve a probar el multímetro.', why: 'Valida la lectura de 0 V.', reading: { text: 'Verificación válida · sistema seguro', status: 'ok' } },
      ...torqueSteps,
      { title: 'Retirar tu bloqueo LOTO', tool: 'candado', part: 'msd', instr: 'Retira tu candado y etiqueta.', why: 'Solo quien lo colocó lo retira.' },
      { title: 'Reinstalar el MSD', tool: 'guantes', part: 'msd', anim: { id: 'msd', type: 'install' }, instr: 'Con EPP, reinstala el MSD.', why: 'Restablece el circuito.' },
      { title: 'Prueba funcional', tool: 'escaner', part: 'gateway', instr: 'Borra DTC y verifica READY.', why: 'Confirma la reparación.', reading: { text: 'Sin DTC · READY ✓', status: 'ok' } },
    ];
  } else {
    const safetyChecks: TdmProcedureStep[] = mandatory.slice(0, 2).map((r) => ({
      title: `Confirmar: ${SAFETY_TYPE_LABEL[r.tipo]}`,
      tool: null,
      part: 'self',
      instr: 'Confirma la condición de seguridad (botón "Confirmar").',
      why: r.texto,
      check: { q: `Antes de continuar, ¿qué exige ${codigo}?`, o: [short(r.texto, 120), ...DISTRACTORS[r.tipo]], a: 0, fb: `${r.norma} · pág. ${r.pagina}` },
    }));
    const inspectPart = pkg.paresApriete[0]?.parteId ?? 'motor_d';
    steps = [
      { title: 'Leer DTC y datos en vivo', tool: 'escaner', part: 'ecu_motor', instr: 'Conecta la herramienta a la ECU de motor.', why: 'Confirma la queja con evidencia.', reading: { text: `Módulo ${codigo} · DTC documentados`, status: 'info' } },
      ...safetyChecks,
      { title: 'Inspección visual', tool: 'linterna', part: inspectPart, instr: 'Inspecciona fugas, fijaciones y estado de la zona de trabajo.', why: 'Lo simple primero.', reading: { text: 'Sin fugas visibles · fijaciones identificadas', status: 'ok' } },
      ...torqueSteps,
      { title: 'Borrar DTC y prueba de ruta', tool: 'escaner', part: 'ecu_motor', instr: 'Borra códigos y verifica con datos en vivo.', why: 'Confirma la reparación.', reading: { text: 'Sin DTC · parámetros en rango ✓', status: 'ok' } },
    ];
  }
  steps = steps.map((s) => (s.check === undefined ? (({ check: _c, ...rest }) => rest)(s) : s));
  procedimientos.push({
    id: procId,
    title: `${codigo} · ${short(pkg.nombre, 60)}`,
    mode: categoria,
    comps: categoria === 'ev' ? ['hv', 'ev'] : ['diesel', 'diag'],
    level: torqueSteps.length > 2 ? 'Intermedio' : 'Básico',
    min: Math.max(4, Math.round(steps.length * 0.7)),
    hv: categoria === 'ev',
    intro: `Procedimiento generado del manual «${pkg.fuente.archivo}» (${codigo} v${pkg.version}). Aplica la secuencia de seguridad y los pares de apriete publicados por tu supervisor.`,
    steps,
    moduloId,
  });

  /* --- fichas y tareas por pieza (se agregan a las existentes) --- */
  const partInfo: TrainingContent['partInfo'] = {};
  const tareasPiezas: TrainingContent['tareasPiezas'] = {};
  const touch = (pid: string) => (partInfo[pid] ??= { specs: [], procs: [procId], tools: [] });
  pkg.paresApriete.forEach((t) => {
    const p = touch(t.parteId);
    p.specs.push(`${t.componente}: ${t.especificacion} (${codigo}, pág. ${t.pagina})`);
    if (!p.tools.includes('torque')) p.tools.push('torque');
    (tareasPiezas[t.parteId] ??= []).push(['torque', `Apretar ${t.componente} a ${t.especificacion} · ${t.secuencia} (${codigo})`]);
  });
  pkg.piezasSBOM.forEach((sp) => {
    const p = touch(sp.parteId);
    p.specs.push(`Refacción ${sp.codigo}: ${sp.nombre}${sp.kitRescate ? ' · kit de rescate' : ''}`);
    if (!p.tools.includes('linterna')) p.tools.push('linterna');
    (tareasPiezas[sp.parteId] ??= []).push(['linterna', `Verificar ${sp.codigo} (${short(sp.nombre, 40)}) contra SBOM ${codigo}`]);
  });

  /* --- contenido didáctico sintetizado por la IA (se suma al generado por reglas) --- */
  (meta?.aiLessons ?? []).forEach((l, i) => {
    if (!COMP_IDS.has(l.comp) || !l.cards.length || l.checkOptions.length < 2) return;
    const ref = `${codigo} §IA-${i + 1}`;
    docs.push({ id: ref, title: `${pkg.nombre} — ${l.title}`, text: l.cards.map((c) => `${c.t}: ${c.b}`).join(' ') });
    lecciones.push({
      id: `${key}-ia${i + 1}`,
      comp: l.comp,
      level: l.level >= 2 ? 2 : 1,
      min: Math.min(6, 2 + l.cards.length),
      title: l.title,
      ref,
      cards: l.cards.slice(0, 6),
      key: l.key,
      check: { q: l.checkQuestion, o: correctFirst(l.checkOptions, l.checkCorrectIndex).slice(0, 4), a: 0 },
      moduloId,
    });
  });
  (meta?.aiQuestions ?? []).forEach((x) => {
    if (!COMP_IDS.has(x.comp) || x.options.length < 2) return;
    q(x.comp, clampLvl(x.level), x.question, correctFirst(x.options, x.correctIndex).slice(0, 4), x.explanation);
  });

  return { lecciones, preguntas, procedimientos, partInfo, tareasPiezas, docs };
}

export interface SelectionInput {
  rules: string[];
  torques: string[];
  sbom: string[];
}

/** Construye el `PublishedModulePackage` a partir de la extracción y la selección del supervisor. */
export function buildPackage(
  ex: ManualExtraction,
  sel: SelectionInput,
  opts: { publishedBy: string; destinos?: string[]; version?: number },
): PublishedModulePackage {
  const categoria: ModuleCategory = ex.meta?.category ?? (ex === EXTRACTION_DIESEL ? 'diesel' : 'ev');
  const version = opts.version ?? nextVersion(ex.moduleCode);
  const rules = ex.rules.filter((r) => sel.rules.includes(r.id));
  const reglasSeguridad: SafetyRule[] = rules
    .map((r) => {
      const tipo = classifySafety(r.rule);
      const safety = r.category === 'Seguridad AV' || (tipo !== 'general' && SAFETY_RX.test(r.rule));
      return { r, tipo, safety };
    })
    .sort((a, b) => (a.safety === b.safety ? TYPE_ORDER[a.tipo] - TYPE_ORDER[b.tipo] || a.r.page - b.r.page : a.safety ? -1 : 1))
    .map(({ r, tipo, safety }, i) => ({
      id: r.id,
      orden: i + 1,
      texto: r.rule,
      tipo: safety ? tipo : 'general',
      norma: normOf(r.rule, safety ? tipo : 'general'),
      obligatoria: safety,
      pagina: r.page,
    }));
  const paresApriete = ex.torques.filter((t) => sel.torques.includes(t.component)).map((t) => parseTorque(t, categoria));
  const piezasSBOM: SbomPart[] = ex.sbom
    .filter((p) => sel.sbom.includes(p.code))
    .map((p) => ({
      codigo: p.code,
      nombre: p.description,
      grupoFuncion: groupOf(p.description),
      criticidad: p.criticality,
      taller: p.workshop,
      kitRescate: p.rescueKit,
      cantidad: p.qty,
      parteId: partFor(p.description, categoria),
    }));

  const base: Omit<PublishedModulePackage, 'entrenamiento'> = {
    schema: 'fa.module/v1',
    id: `${ex.moduleCode}@${version}`,
    codigo: ex.moduleCode,
    nombre: ex.moduleName,
    categoria,
    vehiculo: ex.vehicle,
    fechaPublicacion: new Date().toISOString(),
    version,
    destinos: opts.destinos ?? ['App Móvil', 'Visor AR'],
    publicadoPor: opts.publishedBy,
    fuente: {
      archivo: ex.meta?.sourceFile ?? 'desconocido',
      paginas: ex.pages,
      metodo: ex.meta?.method ?? 'plantilla',
      hash: ex.meta?.sourceHash ?? null,
      motor: ex.meta?.engine ?? 'local',
      ...(ex.meta?.provider ? { proveedor: `${ex.meta.provider} (${ex.meta.model})` } : {}),
    },
    reglasSeguridad,
    paresApriete,
    piezasSBOM,
  };
  return { ...base, entrenamiento: buildTraining(base, ex.meta) };
}

/** Construye y persiste el paquete en el almacén compartido (localStorage + API local). */
export async function publishPackage(ex: ManualExtraction, sel: SelectionInput, publishedBy: string) {
  const pkg = buildPackage(ex, sel, { publishedBy });
  const { synced, json } = await publishModule(pkg);
  return { pkg, synced, json };
}
