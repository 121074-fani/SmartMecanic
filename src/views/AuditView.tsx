import { useMemo, useState } from 'react';
import {
  Battery,
  Cable,
  CheckCircle2,
  Cog,
  Cpu,
  Disc3,
  Fan,
  Fuel,
  Gauge,
  Glasses,
  GraduationCap,
  PackageSearch,
  ScanEye,
  ShieldCheck,
  Smartphone,
  Truck,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import { KpiCard, PageHeader } from '../components/ui';
import { VISUAL_QUERIES } from '../data/mock';
import type { VisualQuery } from '../types';

const ICONS = { battery: Battery, cable: Cable, cog: Cog, disc: Disc3, fuel: Fuel, cpu: Cpu, fan: Fan, gauge: Gauge };
type FilterKey = 'todas' | 'refuerzo' | 'av' | 'ar';

const ago = (m: number) => (m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`);

function Capture({ q }: { q: VisualQuery }) {
  const Icon = ICONS[q.componentIcon];
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-br from-base-700 via-base-850 to-base-950">
      <div className="grid-bg absolute inset-0 opacity-60" />
      <Icon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500/50" size={96} strokeWidth={1} />
      {/* bounding box de detección */}
      <div
        className={`absolute rounded-sm border-2 ${q.hv ? 'border-amber-400' : 'border-petrol-400'}`}
        style={{ left: `${q.bbox.x}%`, top: `${q.bbox.y}%`, width: `${q.bbox.w}%`, height: `${q.bbox.h}%` }}
      >
        <span className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${q.hv ? 'bg-amber-400 text-base-950' : 'bg-petrol-400 text-base-950'}`}>
          {(q.confidence * 100).toFixed(0)}% · {q.component.split(' (')[0]}
        </span>
        {['-left-1 -top-1', '-right-1 -top-1', '-left-1 -bottom-1', '-right-1 -bottom-1'].map((p) => (
          <span key={p} className={`absolute h-2 w-2 ${p} ${q.hv ? 'bg-amber-400' : 'bg-petrol-400'}`} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 h-10 animate-scan bg-gradient-to-b from-transparent via-petrol-300/10 to-transparent" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-base-950/80 px-1.5 py-0.5 text-[10px] text-slate-300">
        {q.device === 'Visor AR' ? <Glasses size={11} /> : <Smartphone size={11} />} {q.device}
      </div>
      {q.hv && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-base-950">
          <Zap size={10} /> ALTO VOLTAJE
        </div>
      )}
    </div>
  );
}

export default function AuditView({ onOpenTechnician }: { onOpenTechnician: (id: string) => void }) {
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [validated, setValidated] = useState<Record<string, boolean>>({ 'Q-4815': true, 'Q-4817': true });

  const list = useMemo(
    () =>
      VISUAL_QUERIES.filter((q) =>
        filter === 'refuerzo' ? q.needsReinforcement : filter === 'av' ? q.hv : filter === 'ar' ? q.device === 'Visor AR' : true,
      ),
    [filter],
  );

  const total = VISUAL_QUERIES.length;
  const reinf = VISUAL_QUERIES.filter((q) => q.needsReinforcement).length;
  const avgConf = VISUAL_QUERIES.reduce((a, q) => a + q.confidence, 0) / total;
  const validatedCount = Object.values(validated).filter(Boolean).length;

  const FILTERS: { k: FilterKey; l: string }[] = [
    { k: 'todas', l: 'Todas' },
    { k: 'refuerzo', l: 'Requirió refuerzo' },
    { k: 'av', l: 'Alto Voltaje' },
    { k: 'ar', l: 'Visor AR' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Vista 04 · Copiloto IA"
        title="Auditoría de Diagnóstico Visual"
        desc="Consultas recientes de técnicos en campo mediante foto desde el celular o visor AR: componente detectado, diagnóstico de la IA, pieza SBOM recomendada y necesidad de refuerzo modular."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Consultas visuales (24 h)" value={`${total * 17}`} hint={`${total} más recientes en el feed`} icon={<ScanEye size={16} />} tone="petrol" />
        <KpiCard label="Confianza media de detección" value={(avgConf * 100).toFixed(1)} unit="%" hint="Modelo visión v3.2 · on-device" icon={<Cpu size={16} />} tone="sky" />
        <KpiCard label="Requirieron refuerzo modular" value={`${Math.round((reinf / total) * 100)}`} unit="%" hint={`${reinf} de ${total} consultas`} icon={<GraduationCap size={16} />} tone="amber" />
        <KpiCard label="Validadas por supervisor" value={`${validatedCount}`} unit={`/ ${total}`} hint="Retroalimenta el modelo" icon={<ShieldCheck size={16} />} tone="emerald" />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              filter === f.k ? 'border-petrol-500 bg-petrol-500/15 text-white' : 'border-base-600 text-slate-400 hover:border-base-500 hover:text-white'
            }`}
          >
            {f.l}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-petrol-400" />
          </span>
          Feed en vivo
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {list.map((q, i) => (
          <article key={q.id} className="card animate-fade-up overflow-hidden p-4 transition-colors hover:border-base-500" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-mono text-slate-400">{q.id}</span>
              <span>·</span>
              <span>{ago(q.minutesAgo)}</span>
              <span
                className={`chip ml-auto ${q.mode === 'Taller' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}
              >
                {q.mode === 'Taller' ? <Wrench size={10} /> : <Truck size={10} />} {q.mode}
              </span>
            </div>

            <Capture q={q} />

            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-100">{q.component}</p>
                <span className="text-[11px] text-slate-500">{q.unit} · {q.powertrain}</span>
              </div>
              <div className="rounded-lg bg-base-850 p-2.5 text-xs">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-petrol-400">Diagnóstico sugerido por IA</p>
                <p className="text-slate-300">{q.diagnosis}</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-base-700 p-2.5 text-xs">
                <PackageSearch size={15} className="shrink-0 text-violet-300" />
                <div className="min-w-0">
                  <p className="font-mono text-petrol-300">{q.sbomCode}</p>
                  <p className="truncate text-slate-400">{q.sbomDesc}</p>
                </div>
              </div>
              {q.needsReinforcement ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-200">
                  <GraduationCap size={15} className="shrink-0 text-amber-400" />
                  <span>
                    Refuerzo modular asignado: <b>{q.reinforcementModule}</b>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-xs text-emerald-200">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" /> Sin refuerzo requerido · resolución autónoma
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-base-700 pt-3">
              <button onClick={() => onOpenTechnician(q.technicianId)} className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400 hover:text-petrol-300">
                <User size={13} /> <span className="truncate">{q.technician}</span>
              </button>
              <button
                onClick={() => setValidated((v) => ({ ...v, [q.id]: !v[q.id] }))}
                className={`ml-auto rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all ${
                  validated[q.id] ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-base-600 text-slate-300 hover:border-petrol-500'
                }`}
              >
                {validated[q.id] ? '✓ Validado' : 'Validar diagnóstico'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
