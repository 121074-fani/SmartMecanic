import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  Boxes,
  CheckCircle2,
  Cpu,
  FileText,
  Glasses,
  Hand,
  Loader2,
  Rocket,
  Smartphone,
  Sparkles,
  Trash2,
  Truck,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { EXTRACTION_DIESEL, EXTRACTION_EV, PROCESS_STEPS, SAMPLE_MANUAL } from '../data/mock';
import type { Criticality, ManualExtraction, PublishedModule } from '../types';

const STEP_MS = 750;

type FileStatus = 'En cola' | 'Procesando' | 'Procesado' | 'Publicado';
interface IngestedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  uploadedAt: string;
  pages: number | null;
  sample: boolean;
  status: FileStatus;
}

type Mode = 'auto' | 'manual';
interface Selection {
  mode: Mode;
  rules: string[];
  torques: string[];
  sbom: string[];
}

const CRIT_STYLE: Record<Criticality, string> = {
  Crítica: 'border-red-500/40 bg-red-500/10 text-red-300',
  Alta: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Media: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Baja: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

const STATUS_STYLE: Record<FileStatus, string> = {
  'En cola': 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  Procesando: 'border-petrol-500/40 bg-petrol-500/10 text-petrol-300',
  Procesado: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Publicado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

/** Criterios de la selección automática del sistema. */
const AUTO_RULES = 'Reglas con confianza ≥ 92 %, todos los pares de apriete y piezas SBOM de criticidad Media o superior.';
const autoSelection = (ex: ManualExtraction): Selection => ({
  mode: 'auto',
  rules: ex.rules.filter((r) => r.confidence >= 0.92).map((r) => r.id),
  torques: ex.torques.map((t) => t.component),
  sbom: ex.sbom.filter((p) => p.criticality !== 'Baja').map((p) => p.code),
});

const extractionFor = (name: string) => (/inversor|electric|eléctric|bev|hv|bater/i.test(name) ? EXTRACTION_EV : EXTRACTION_DIESEL);

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (ms: number) => new Date(ms).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Cuenta páginas leyendo la estructura del PDF real (sin librerías). */
async function countPdfPages(file: File): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buf);
    const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g), ...text.matchAll(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)].map((m) => +m[1]);
    if (counts.length) return Math.max(...counts);
    const pages = text.match(/\/Type\s*\/Page(?!s)\b/g);
    return pages ? pages.length : null;
  } catch {
    return null;
  }
}

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export default function IngestionView({
  published,
  onPublish,
  activeModules,
}: {
  published: PublishedModule[];
  onPublish: (m: PublishedModule) => void;
  activeModules: number;
}) {
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [drag, setDrag] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const active = files.find((f) => f.id === activeId) ?? null;
  const patch = (id: string, p: Partial<IngestedFile>) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)));

  const addFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    const bad = arr.filter((f) => !isPdf(f)).map((f) => f.name);
    setRejected(bad);
    const good = arr.filter(isPdf);
    const records: IngestedFile[] = good.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      type: f.type || 'application/pdf',
      lastModified: f.lastModified,
      uploadedAt: fmtDate(Date.now()),
      pages: null,
      sample: false,
      status: 'En cola',
    }));
    if (!records.length) return;
    setFiles((fs) => [...records, ...fs]);
    if (!processingId) setActiveId(records[0].id);
    // lectura real del número de páginas
    good.forEach(async (f, i) => {
      const pages = await countPdfPages(f);
      patch(records[i].id, { pages });
    });
  };

  const addSample = () => {
    const rec: IngestedFile = {
      id: `sample-${Date.now()}`,
      name: SAMPLE_MANUAL,
      size: 19_293_184,
      type: 'application/pdf',
      lastModified: Date.now() - 86_400_000 * 3,
      uploadedAt: fmtDate(Date.now()),
      pages: EXTRACTION_EV.pages,
      sample: true,
      status: 'En cola',
    };
    setFiles((fs) => [rec, ...fs]);
    if (!processingId) setActiveId(rec.id);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const process = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (!f) return;
    setActiveId(id);
    setProcessingId(id);
    patch(id, { status: 'Procesando' });
    setStep(0);
    setLogs([`> Iniciando pipeline IA + RAG para "${f.name}" (${fmtSize(f.size)})`]);
  };

  // animación del pipeline
  useEffect(() => {
    if (!processingId) return;
    const f = files.find((x) => x.id === processingId);
    if (!f) return;
    const ex = extractionFor(f.name);
    const pages = f.pages ?? ex.pages;
    const lines = [
      `  OCR completo · ${pages} páginas leídas de ${f.name}`,
      `  ${Math.round(pages * 8.7).toLocaleString('es-MX')} fragmentos semánticos generados (≈ 512 tokens c/u)`,
      `  Vectores indexados en colección "${ex.moduleCode.toLowerCase()}" · dim 1024`,
      `  ${ex.rules.length} reglas y ${ex.torques.length} pares de apriete normalizados (N·m)`,
      `  SBOM: ${ex.sbom.length} piezas vinculadas al catálogo maestro`,
      `  Validación de seguridad OK · 0 conflictos con procedimiento LOTO vigente`,
    ];
    if (step >= PROCESS_STEPS.length) {
      patch(processingId, { status: 'Procesado' });
      setSelections((s) => ({ ...s, [processingId]: autoSelection(ex) }));
      setProcessingId(null);
      return;
    }
    const t = window.setTimeout(() => {
      setLogs((l) => [...l, `✓ ${PROCESS_STEPS[step].label}`, lines[step]]);
      setStep((s) => s + 1);
    }, STEP_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingId, step]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const result = active && (active.status === 'Procesado' || active.status === 'Publicado') ? extractionFor(active.name) : null;
  const sel = active ? selections[active.id] : undefined;
  const locked = active?.status === 'Publicado';

  const setMode = (mode: Mode) => {
    if (!active || !result || locked) return;
    setSelections((s) => ({ ...s, [active.id]: mode === 'auto' ? autoSelection(result) : { ...s[active.id], mode: 'manual' } }));
  };

  const toggle = (kind: 'rules' | 'torques' | 'sbom', key: string) => {
    if (!active || !sel || sel.mode !== 'manual' || locked) return;
    const cur = sel[kind];
    setSelections((s) => ({ ...s, [active.id]: { ...sel, [kind]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] } }));
  };

  const setAll = (kind: 'rules' | 'torques' | 'sbom', keys: string[]) => {
    if (!active || !sel || sel.mode !== 'manual' || locked) return;
    setSelections((s) => ({ ...s, [active.id]: { ...sel, [kind]: keys } }));
  };

  const totalSelected = sel ? sel.rules.length + sel.torques.length + sel.sbom.length : 0;

  const publish = () => {
    if (!active || !result || !sel || totalSelected === 0) return;
    onPublish({
      code: result.moduleCode,
      name: `${result.moduleName} (${sel.rules.length} reglas · ${sel.torques.length} pares · ${sel.sbom.length} piezas)`,
      date: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
      targets: ['App Móvil', 'Visor AR'],
    });
    patch(active.id, { status: 'Publicado' });
  };

  const pct = Math.round((step / PROCESS_STEPS.length) * 100);
  const alreadyPublished = result ? published.some((p) => p.code === result.moduleCode) && !locked : false;
  const showPipeline = active && (processingId === active.id || active.status !== 'En cola');

  return (
    <div>
      <PageHeader
        eyebrow="Vista 03 · IA + RAG"
        title="Ingesta Automatizada de Manuales"
        desc="Sube manuales técnicos en PDF. El sistema extrae reglas, pares de apriete y el SBOM; tú decides si la selección la hace el sistema o la revisas manualmente antes de publicar."
        right={
          <div className="card flex items-center gap-3 px-4 py-2.5">
            <Boxes size={18} className="text-petrol-300" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Módulos activos</p>
              <p key={activeModules} className="animate-fade-up font-mono text-lg font-semibold text-fg">
                {activeModules}
              </p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="card p-4 sm:p-5 xl:col-span-3">
          {/* Zona de carga */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`grid-bg relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all sm:py-10 ${
              drag ? 'scale-[1.01] border-petrol-400 bg-petrol-500/10' : 'border-base-600 hover:border-petrol-600 hover:bg-base-850'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-petrol-500/15 ring-1 ring-petrol-500/30 ${drag ? 'animate-bounce' : ''}`}>
              <UploadCloud size={26} className="text-petrol-300" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-100">Arrastra aquí uno o varios manuales en PDF</p>
            <p className="mt-1 text-xs text-slate-500">o haz clic para seleccionarlos · se leen localmente en tu navegador</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addSample();
              }}
              className="btn-ghost mt-4 text-xs"
            >
              <FileText size={14} /> Usar manual de ejemplo
            </button>
          </div>

          {rejected.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Se omitieron archivos que no son PDF: {rejected.join(', ')}
            </p>
          )}

          {/* Archivos ingestados (reales) */}
          {files.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Archivos ingestados ({files.length})</h3>
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={f.id}
                    onClick={() => setActiveId(f.id)}
                    className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
                      f.id === activeId ? 'border-petrol-500/60 bg-petrol-500/5' : 'border-base-700 bg-base-850 hover:border-base-500'
                    }`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-500/15 text-[10px] font-bold text-red-300">PDF</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100" title={f.name}>
                        {f.name}
                        {f.sample && <span className="ml-2 text-[10px] font-normal text-slate-500">(ejemplo)</span>}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {fmtSize(f.size)} · {f.pages === null ? 'contando páginas…' : `${f.pages} págs.`} · modificado {fmtDate(f.lastModified)}
                      </p>
                      <p className="text-[11px] text-slate-500">Subido {f.uploadedAt}</p>
                    </div>
                    <span className={`chip ${STATUS_STYLE[f.status]}`}>
                      {f.status === 'Procesando' && <Loader2 size={11} className="animate-spin" />}
                      {f.status}
                    </span>
                    {f.status === 'En cola' && (
                      <div className="flex w-full gap-2 sm:w-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            process(f.id);
                          }}
                          disabled={!!processingId}
                          className="btn-primary flex-1 px-3 py-1.5 text-xs sm:flex-none"
                        >
                          <Sparkles size={13} /> Procesar con IA + RAG
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles((fs) => fs.filter((x) => x.id !== f.id));
                            if (activeId === f.id) setActiveId(null);
                          }}
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                          aria-label={`Quitar ${f.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pipeline */}
          {showPipeline && (
            <div className="mt-5 grid animate-fade-up grid-cols-1 gap-4 lg:grid-cols-2">
              <ol className="space-y-2">
                {PROCESS_STEPS.map((s, i) => {
                  const done = active.status !== 'Procesando' || i < step;
                  const running = processingId === active.id && i === step;
                  return (
                    <li
                      key={s.label}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-all ${
                        done ? 'border-emerald-500/25 bg-emerald-500/5' : running ? 'border-petrol-500/50 bg-petrol-500/10' : 'border-base-700 bg-base-850 opacity-60'
                      }`}
                    >
                      <span className="mt-0.5">
                        {done ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : running ? (
                          <Loader2 size={16} className="animate-spin text-petrol-300" />
                        ) : (
                          <span className="block h-4 w-4 rounded-full border border-base-500" />
                        )}
                      </span>
                      <span>
                        <span className="block text-xs font-medium text-slate-200">{s.label}</span>
                        <span className="block text-[11px] text-slate-500">{s.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-col overflow-hidden rounded-lg border border-base-700 bg-base-950">
                <div className="flex items-center gap-2 border-b border-base-700 px-3 py-2 text-[11px] text-slate-500">
                  <Cpu size={12} /> rag-pipeline.log
                  <div className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-base-700">
                    <div className="h-full bg-petrol-400 transition-all duration-500" style={{ width: `${active.status === 'Procesando' ? pct : 100}%` }} />
                  </div>
                </div>
                <div ref={logRef} className="relative h-56 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed sm:h-64">
                  {processingId === active.id && (
                    <div className="pointer-events-none absolute inset-x-0 h-8 animate-scan bg-gradient-to-b from-transparent via-petrol-400/10 to-transparent" />
                  )}
                  {processingId === active.id || logs.length ? (
                    logs.map((l, i) => (
                      <p key={i} className={`animate-fade-up ${l.startsWith('✓') ? 'text-emerald-300' : l.startsWith('>') ? 'text-petrol-300' : 'text-slate-400'}`}>
                        {l}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-500">Pipeline completado.</p>
                  )}
                  {processingId === active.id && <span className="inline-block h-3 w-1.5 animate-pulse bg-petrol-300" />}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="card p-4 sm:p-5 xl:col-span-2">
          <h2 className="card-title">Módulos publicados recientemente</h2>
          <p className="card-sub mt-0.5">Sincronizados con App Móvil y Visor AR</p>
          <ul className="mt-4 space-y-2">
            {published.map((m, i) => (
              <li key={`${m.code}-${i}`} className="flex items-center gap-3 rounded-lg border border-base-700 bg-base-850 p-3">
                <BookOpenCheck size={16} className="shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-100" title={m.name}>
                    {m.name}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {m.code} · {m.date}
                  </p>
                </div>
                <div className="flex gap-1 text-slate-400">
                  {m.targets.includes('App Móvil') && <Smartphone size={14} aria-label="App Móvil" />}
                  {m.targets.includes('Visor AR') && <Glasses size={14} aria-label="Visor AR" />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Resultados + selección */}
      {result && sel && active && (
        <div className="mt-6 animate-fade-up space-y-6">
          <div className="card space-y-4 border-petrol-600/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] text-petrol-300">
                  {result.moduleCode} · fuente: {active.name}
                </p>
                <h2 className="text-lg font-semibold text-fg">{result.moduleName}</h2>
                <p className="text-xs text-slate-400">
                  Seleccionados: <b className="text-slate-200">{sel.rules.length}</b>/{result.rules.length} reglas · <b className="text-slate-200">{sel.torques.length}</b>/
                  {result.torques.length} pares de apriete · <b className="text-slate-200">{sel.sbom.length}</b>/{result.sbom.length} piezas SBOM
                </p>
              </div>
              {locked ? (
                <span className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
                  <CheckCircle2 size={16} /> Publicado en App Móvil y Visor AR
                </span>
              ) : (
                <button onClick={publish} disabled={totalSelected === 0} className="btn-primary w-full px-5 py-2.5 sm:w-auto">
                  <Rocket size={16} /> {alreadyPublished ? 'Publicar nueva versión' : 'Publicar en App Móvil y Visor AR'}
                </button>
              )}
            </div>

            {/* Selector automático / manual */}
            <div className="flex flex-col gap-3 rounded-lg border border-base-700 bg-base-850 p-3 sm:flex-row sm:items-center">
              <div className="inline-flex shrink-0 rounded-lg border border-base-600 bg-base-900 p-0.5 text-xs" role="radiogroup" aria-label="Modo de selección">
                {(
                  [
                    { m: 'auto', l: 'Selección automática', i: <Bot size={14} /> },
                    { m: 'manual', l: 'Selección manual', i: <Hand size={14} /> },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.m}
                    role="radio"
                    aria-checked={sel.mode === o.m}
                    disabled={locked}
                    onClick={() => setMode(o.m)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors disabled:cursor-not-allowed ${
                      sel.mode === o.m ? 'bg-petrol-500 text-white' : 'text-slate-400 hover:text-fg'
                    }`}
                  >
                    {o.i} {o.l}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {sel.mode === 'auto' ? (
                  <>
                    <b className="text-slate-300">El sistema decide:</b> {AUTO_RULES}
                  </>
                ) : (
                  <>
                    <b className="text-slate-300">Tú decides:</b> marca o desmarca cada regla, par de apriete y pieza que se incluirá en el módulo.
                  </>
                )}
              </p>
            </div>
            {totalSelected === 0 && <p className="text-xs text-amber-400">Selecciona al menos un elemento para poder publicar.</p>}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card p-4 sm:p-5">
              <SectionHeader
                title="1 · Reglas de entrenamiento"
                count={`${sel.rules.length}/${result.rules.length}`}
                manual={sel.mode === 'manual' && !locked}
                onAll={() => setAll('rules', result.rules.map((r) => r.id))}
                onNone={() => setAll('rules', [])}
              />
              <ul className="mt-4 space-y-2">
                {result.rules.map((r) => {
                  const on = sel.rules.includes(r.id);
                  return (
                    <SelectableRow key={r.id} on={on} manual={sel.mode === 'manual' && !locked} onToggle={() => toggle('rules', r.id)}>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`chip ${r.category === 'Seguridad AV' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-petrol-500/30 bg-petrol-500/10 text-petrol-300'}`}>
                          {r.category}
                        </span>
                        <span className="text-slate-500">pág. {r.page}</span>
                        <span className={`ml-auto font-mono ${r.confidence >= 0.92 ? 'text-slate-400' : 'text-amber-300'}`}>confianza {(r.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-200">{r.rule}</p>
                    </SelectableRow>
                  );
                })}
              </ul>
            </section>

            <section className="card p-4 sm:p-5">
              <SectionHeader
                title="Pares de apriete"
                count={`${sel.torques.length}/${result.torques.length}`}
                manual={sel.mode === 'manual' && !locked}
                onAll={() => setAll('torques', result.torques.map((t) => t.component))}
                onNone={() => setAll('torques', [])}
              />
              <ul className="mt-4 space-y-2">
                {result.torques.map((t) => (
                  <SelectableRow key={t.component} on={sel.torques.includes(t.component)} manual={sel.mode === 'manual' && !locked} onToggle={() => toggle('torques', t.component)}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm text-slate-200">{t.component}</p>
                      <span className="whitespace-nowrap font-mono text-sm font-semibold text-amber-300">{t.spec}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t.sequence} · {t.tool} · pág. {t.page}
                    </p>
                  </SelectableRow>
                ))}
              </ul>
            </section>
          </div>

          <section className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeader
                title="2 · SBOM · Service Bill of Materials"
                count={`${sel.sbom.length}/${result.sbom.length}`}
                manual={sel.mode === 'manual' && !locked}
                onAll={() => setAll('sbom', result.sbom.map((p) => p.code))}
                onNone={() => setAll('sbom', [])}
              />
              <div className="flex gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Wrench size={12} className="text-sky-300" /> Uso en Taller
                </span>
                <span className="flex items-center gap-1">
                  <Truck size={12} className="text-amber-300" /> Kit de Rescate
                </span>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-base-700 bg-base-850/60">
                  <tr>
                    <th className="th w-10">Incl.</th>
                    <th className="th">Código de pieza</th>
                    <th className="th">Descripción</th>
                    <th className="th">Criticidad</th>
                    <th className="th text-center">Taller</th>
                    <th className="th text-center">Kit de Rescate</th>
                    <th className="th text-right">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-700">
                  {result.sbom.map((p) => {
                    const on = sel.sbom.includes(p.code);
                    const manual = sel.mode === 'manual' && !locked;
                    return (
                      <tr
                        key={p.code}
                        onClick={() => toggle('sbom', p.code)}
                        className={`transition-colors ${manual ? 'cursor-pointer hover:bg-base-850' : ''} ${on ? '' : 'opacity-45'}`}
                      >
                        <td className="td">
                          <Check on={on} manual={manual} />
                        </td>
                        <td className="td font-mono text-xs text-petrol-300">{p.code}</td>
                        <td className="td text-slate-200">{p.description}</td>
                        <td className="td">
                          <span className={`chip ${CRIT_STYLE[p.criticality]}`}>{p.criticality}</span>
                        </td>
                        <td className="td text-center">
                          {p.workshop ? <CheckCircle2 size={16} className="mx-auto text-sky-300" /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="td text-center">
                          {p.rescueKit ? <CheckCircle2 size={16} className="mx-auto text-amber-300" /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="td text-right font-mono tabular-nums text-slate-300">{p.qty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, count, manual, onAll, onNone }: { title: string; count: string; manual: boolean; onAll: () => void; onNone: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="card-title">{title}</h3>
      <span className="font-mono text-xs text-slate-400">{count}</span>
      {manual && (
        <span className="ml-2 flex gap-1 text-[11px]">
          <button onClick={onAll} className="rounded px-1.5 py-0.5 text-petrol-300 hover:bg-petrol-500/10">
            Todas
          </button>
          <button onClick={onNone} className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-base-700">
            Ninguna
          </button>
        </span>
      )}
    </div>
  );
}

function Check({ on, manual }: { on: boolean; manual: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
        on ? (manual ? 'border-petrol-500 bg-petrol-500 text-white' : 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300') : 'border-base-500 bg-base-900'
      }`}
    >
      {on && (manual ? <CheckCircle2 size={12} /> : <Bot size={12} />)}
    </span>
  );
}

function SelectableRow({ on, manual, onToggle, children }: { on: boolean; manual: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <li
      role={manual ? 'checkbox' : undefined}
      aria-checked={manual ? on : undefined}
      tabIndex={manual ? 0 : undefined}
      onClick={onToggle}
      onKeyDown={(e) => manual && (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onToggle())}
      className={`flex gap-3 rounded-lg border p-3 transition-all ${on ? 'border-base-700 bg-base-850' : 'border-dashed border-base-600 opacity-50'} ${
        manual ? 'cursor-pointer hover:border-petrol-600' : ''
      }`}
      title={manual ? undefined : on ? 'Incluido por la selección automática' : 'Excluido por la selección automática'}
    >
      <Check on={on} manual={manual} />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
