import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  Cpu,
  FileText,
  Glasses,
  Loader2,
  Rocket,
  RotateCcw,
  Smartphone,
  Sparkles,
  Truck,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { EXTRACTION_DIESEL, EXTRACTION_EV, PROCESS_STEPS, SAMPLE_MANUAL } from '../data/mock';
import type { Criticality, ManualExtraction, PublishedModule } from '../types';

type Phase = 'idle' | 'ready' | 'processing' | 'done' | 'published';
const STEP_MS = 750;

const CRIT_STYLE: Record<Criticality, string> = {
  Crítica: 'border-red-500/40 bg-red-500/10 text-red-300',
  Alta: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Media: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Baja: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

export default function IngestionView({
  published,
  onPublish,
  activeModules,
}: {
  published: PublishedModule[];
  onPublish: (m: PublishedModule) => void;
  activeModules: number;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<{ name: string; size: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ManualExtraction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const extraction = (name: string) => (/inversor|electric|eléctric|bev|hv|bater/i.test(name) ? EXTRACTION_EV : EXTRACTION_DIESEL);

  const accept = (name: string, bytes?: number) => {
    setFile({ name, size: bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '18.4 MB' });
    setPhase('ready');
    setResult(null);
    setStep(0);
    setLogs([]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f.name, f.size);
  };

  const process = () => {
    if (!file) return;
    setPhase('processing');
    setStep(0);
    setLogs([`> Iniciando pipeline IA + RAG para "${file.name}"`]);
  };

  // Avance de la animación de procesamiento
  useEffect(() => {
    if (phase !== 'processing' || !file) return;
    const ex = extraction(file.name);
    const lines = [
      `  OCR completo · ${ex.pages} páginas, 37 tablas, 52 diagramas detectados`,
      `  ${ex.chunks.toLocaleString('es-MX')} fragmentos semánticos generados (≈ 512 tokens c/u)`,
      `  Vectores indexados en colección "${ex.moduleCode.toLowerCase()}" · dim 1024`,
      `  ${ex.rules.length} reglas y ${ex.torques.length} pares de apriete normalizados (N·m)`,
      `  SBOM: ${ex.sbom.length} piezas vinculadas al catálogo maestro`,
      `  Validación de seguridad OK · 0 conflictos con procedimiento LOTO vigente`,
    ];
    if (step >= PROCESS_STEPS.length) {
      setResult(ex);
      setPhase('done');
      return;
    }
    const id = window.setTimeout(() => {
      setLogs((l) => [...l, `✓ ${PROCESS_STEPS[step].label}`, lines[step]]);
      setStep((s) => s + 1);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [phase, step, file]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  const publish = () => {
    if (!result) return;
    onPublish({
      code: result.moduleCode,
      name: result.moduleName,
      date: '23 nov 2026',
      targets: ['App Móvil', 'Visor AR'],
    });
    setPhase('published');
  };

  const reset = () => {
    setPhase('idle');
    setFile(null);
    setResult(null);
    setStep(0);
    setLogs([]);
  };

  const pct = Math.round((step / PROCESS_STEPS.length) * 100);
  const alreadyPublished = result ? published.some((p) => p.code === result.moduleCode) : false;

  return (
    <div>
      <PageHeader
        eyebrow="Vista 03 · IA + RAG"
        title="Ingesta Automatizada de Manuales"
        desc="Sube un manual técnico y el sistema extrae reglas de entrenamiento, pares de apriete y el SBOM del módulo listo para publicarse en la app móvil y el visor AR."
        right={
          <div className="card flex items-center gap-3 px-4 py-2.5">
            <Boxes size={18} className="text-petrol-300" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Módulos activos</p>
              <p key={activeModules} className="animate-fade-up font-mono text-lg font-semibold text-white">{activeModules}</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Carga */}
        <section className="card p-5 xl:col-span-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => phase !== 'processing' && inputRef.current?.click()}
            className={`grid-bg relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
              drag ? 'scale-[1.01] border-petrol-400 bg-petrol-500/10' : 'border-base-600 hover:border-petrol-600 hover:bg-base-850'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) accept(f.name, f.size);
                e.target.value = '';
              }}
            />
            <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-petrol-500/15 ring-1 ring-petrol-500/30 ${drag ? 'animate-bounce' : ''}`}>
              <UploadCloud size={26} className="text-petrol-300" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-100">Arrastra aquí el manual técnico en PDF</p>
            <p className="mt-1 text-xs text-slate-500">o haz clic para seleccionarlo · Máx. 200 MB · Se procesa localmente en la demo</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                accept(SAMPLE_MANUAL);
              }}
              disabled={phase === 'processing'}
              className="btn-ghost mt-4 text-xs"
            >
              <FileText size={14} /> Usar manual de ejemplo
            </button>
          </div>

          {file && (
            <div className="mt-4 flex animate-fade-up items-center gap-3 rounded-lg border border-base-700 bg-base-850 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-500/15 text-[10px] font-bold text-red-300">PDF</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
                <p className="text-[11px] text-slate-500">
                  {file.size} · Destino: {extraction(file.name).vehicle}
                </p>
              </div>
              {phase === 'ready' && (
                <button onClick={process} className="btn-primary">
                  <Sparkles size={15} /> Procesar Manual con IA + RAG
                </button>
              )}
              {phase === 'processing' && (
                <span className="flex items-center gap-2 text-xs text-petrol-300">
                  <Loader2 size={14} className="animate-spin" /> {pct}%
                </span>
              )}
              {(phase === 'done' || phase === 'published') && (
                <button onClick={reset} className="btn-ghost text-xs">
                  <RotateCcw size={13} /> Nuevo manual
                </button>
              )}
            </div>
          )}

          {(phase === 'processing' || phase === 'done' || phase === 'published') && (
            <div className="mt-4 grid animate-fade-up grid-cols-1 gap-4 lg:grid-cols-2">
              <ol className="space-y-2">
                {PROCESS_STEPS.map((s, i) => {
                  const done = i < step;
                  const active = i === step && phase === 'processing';
                  return (
                    <li
                      key={s.label}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-all ${
                        done ? 'border-emerald-500/25 bg-emerald-500/5' : active ? 'border-petrol-500/50 bg-petrol-500/10' : 'border-base-700 bg-base-850 opacity-60'
                      }`}
                    >
                      <span className="mt-0.5">
                        {done ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : active ? (
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
                    <div className="h-full bg-petrol-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div ref={logRef} className="relative h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
                  {phase === 'processing' && <div className="pointer-events-none absolute inset-x-0 h-8 animate-scan bg-gradient-to-b from-transparent via-petrol-400/10 to-transparent" />}
                  {logs.map((l, i) => (
                    <p key={i} className={`animate-fade-up ${l.startsWith('✓') ? 'text-emerald-300' : l.startsWith('>') ? 'text-petrol-300' : 'text-slate-400'}`}>
                      {l}
                    </p>
                  ))}
                  {phase === 'processing' && <span className="inline-block h-3 w-1.5 animate-pulse bg-petrol-300" />}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Publicados */}
        <section className="card p-5 xl:col-span-2">
          <h2 className="card-title">Módulos publicados recientemente</h2>
          <p className="card-sub mt-0.5">Sincronizados con App Móvil y Visor AR</p>
          <ul className="mt-4 space-y-2">
            {published.map((m, i) => (
              <li key={m.code} className={`flex items-center gap-3 rounded-lg border border-base-700 bg-base-850 p-3 ${i === 0 && phase === 'published' ? 'animate-fade-up border-emerald-500/40' : ''}`}>
                <BookOpenCheck size={16} className="shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-100">{m.name}</p>
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

      {/* Resultados */}
      {result && (
        <div className="mt-6 animate-fade-up space-y-6">
          <div className="card flex flex-wrap items-center gap-4 border-petrol-600/40 bg-gradient-to-r from-petrol-900/40 to-base-800 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-petrol-300">{result.moduleCode}</p>
              <h2 className="text-lg font-semibold text-white">{result.moduleName}</h2>
              <p className="text-xs text-slate-400">
                {result.rules.length} reglas · {result.torques.length} pares de apriete · {result.sbom.length} piezas SBOM · {result.pages} págs. fuente
              </p>
            </div>
            {phase === 'published' || alreadyPublished ? (
              <span className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
                <CheckCircle2 size={16} /> Publicado en App Móvil y Visor AR
              </span>
            ) : (
              <button onClick={publish} className="btn-primary px-5 py-2.5">
                <Rocket size={16} /> Publicar en App Móvil y Visor AR
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card p-5">
              <h3 className="card-title">1 · Reglas de entrenamiento extraídas</h3>
              <ul className="mt-4 space-y-2">
                {result.rules.map((r) => (
                  <li key={r.id} className="rounded-lg border border-base-700 bg-base-850 p-3">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={`chip ${r.category === 'Seguridad AV' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-petrol-500/30 bg-petrol-500/10 text-petrol-300'}`}>
                        {r.category}
                      </span>
                      <span className="text-slate-500">pág. {r.page}</span>
                      <span className="ml-auto font-mono text-slate-400">confianza {(r.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-200">{r.rule}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card p-5">
              <h3 className="card-title">Pares de apriete</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-base-700">
                    <tr>
                      <th className="th px-2">Componente</th>
                      <th className="th px-2">Especificación</th>
                      <th className="th px-2">Secuencia</th>
                      <th className="th px-2">Herramienta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-700 text-xs">
                    {result.torques.map((t) => (
                      <tr key={t.component}>
                        <td className="px-2 py-2.5 text-slate-200">
                          {t.component}
                          <span className="block text-[10px] text-slate-500">pág. {t.page}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-mono font-semibold text-amber-300">{t.spec}</td>
                        <td className="px-2 py-2.5 text-slate-400">{t.sequence}</td>
                        <td className="px-2 py-2.5 text-slate-400">{t.tool}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="card-title">2 · SBOM · Service Bill of Materials</h3>
                <p className="card-sub mt-0.5">Vinculado a {result.moduleCode}</p>
              </div>
              <div className="flex gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><Wrench size={12} className="text-sky-300" /> Uso en Taller</span>
                <span className="flex items-center gap-1"><Truck size={12} className="text-amber-300" /> Kit de Rescate</span>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-base-700 bg-base-850/60">
                  <tr>
                    <th className="th">Código de pieza</th>
                    <th className="th">Descripción</th>
                    <th className="th">Criticidad</th>
                    <th className="th text-center">Taller</th>
                    <th className="th text-center">Kit de Rescate</th>
                    <th className="th text-right">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-700">
                  {result.sbom.map((p, i) => (
                    <tr key={p.code} className="animate-fade-up hover:bg-base-850" style={{ animationDelay: `${i * 50}ms` }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
