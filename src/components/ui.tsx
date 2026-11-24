import { AlertTriangle, CheckCircle2, Lock, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LexicalLevel, ModuleSection, RiskLevel, Specialty } from '../types';

/** `?static` en la URL desactiva animaciones de gráficas (capturas, impresión). */
export const CHART_ANIM = !new URLSearchParams(window.location.search).has('static');

/** Colores de series de gráficas (validados para CVD sobre superficie #111a24). */
export const SERIES = {
  s1: '#3987e5',
  s2: '#d95926',
  s3: '#199e70',
  grid: '#1f2d3b',
  axis: '#7b8a9a',
  surface: '#111a24',
};

export function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'petrol',
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon: ReactNode;
  tone?: 'petrol' | 'amber' | 'emerald' | 'sky';
  delta?: { text: string; good: boolean };
}) {
  const toneMap = {
    petrol: 'from-petrol-500/20 text-petrol-300 ring-petrol-500/30',
    amber: 'from-amber-500/20 text-amber-300 ring-amber-500/30',
    emerald: 'from-emerald-500/20 text-emerald-300 ring-emerald-500/30',
    sky: 'from-sky-500/20 text-sky-300 ring-sky-500/30',
  }[tone];
  return (
    <div className="card group relative overflow-hidden p-4 transition-colors hover:border-base-500">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${toneMap} to-transparent opacity-60 blur-2xl`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg bg-base-850 ring-1 ${toneMap}`}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-fg tabular-nums">{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-500">{hint}</span>
        {delta && (
          <span className={`font-medium ${delta.good ? 'text-emerald-400' : 'text-amber-400'}`}>
            {delta.good ? '▲' : '▼'} {delta.text}
          </span>
        )}
      </div>
    </div>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const m = {
    Bajo: { c: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', i: <ShieldCheck size={12} /> },
    Medio: { c: 'border-amber-500/30 bg-amber-500/10 text-amber-300', i: <AlertTriangle size={12} /> },
    Alto: { c: 'border-red-500/40 bg-red-500/10 text-red-300', i: <ShieldAlert size={12} /> },
  }[risk];
  return (
    <span className={`chip ${m.c}`}>
      {m.i}
      {risk}
    </span>
  );
}

export function SpecialtyBadge({ s }: { s: Specialty }) {
  const m = {
    'Alto Voltaje': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    'Mecánica Pesada': 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    'Refacciones/SBOM': 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  }[s];
  return (
    <span className={`chip ${m}`}>
      {s === 'Alto Voltaje' && <Zap size={11} />}
      {s}
    </span>
  );
}

export function LevelBadge({ l }: { l: LexicalLevel }) {
  const bars = l === 'Operativo' ? 1 : l === 'Técnico' ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-300">
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={`w-1 rounded-sm ${b <= bars ? 'bg-petrol-400' : 'bg-base-600'}`} style={{ height: 4 + b * 3 }} />
        ))}
      </span>
      {l}
    </span>
  );
}

/** Barra modular estilo "secciones" con candados de bloqueo. */
export function SectionProgress({ sections, compact = false }: { sections: ModuleSection[]; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {sections.map((s) => {
        const locked = s.status === 'bloqueada';
        const done = s.status === 'aprobada';
        return (
          <div key={s.id} className="group/sec relative flex-1" title={`Sección ${s.id} · ${s.title} — ${s.status} (${s.progress}%)`}>
            <div className={`relative overflow-hidden rounded ${compact ? 'h-2' : 'h-5'} ${locked ? 'hazard-stripe bg-base-700' : 'bg-base-700'}`}>
              <div
                className={`h-full rounded transition-all duration-700 ${done ? 'bg-emerald-500' : 'bg-petrol-400'}`}
                style={{ width: `${locked ? 0 : s.progress}%` }}
              />
              {!compact && (
                <span className="absolute inset-0 flex items-center justify-center gap-1 text-[10px] font-semibold text-fg/90">
                  {locked ? <Lock size={10} className="text-amber-300" /> : done ? <CheckCircle2 size={10} /> : null}
                  S{s.id}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueSuffix = '',
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string; dataKey: string }[];
  label?: string | number;
  labelFormatter?: (l: string | number) => string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-base-600 bg-base-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-slate-200">{labelFormatter ? labelFormatter(label ?? '') : label}</p>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono text-slate-100 tabular-nums">
            {typeof p.value === 'number' ? p.value.toFixed(p.value % 1 === 0 ? 0 : 1) : p.value}
            {valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LegendItem({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className="inline-block h-0.5 w-4" style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      {label}
    </span>
  );
}

export function PageHeader({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-petrol-400">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{desc}</p>
      </div>
      {right}
    </div>
  );
}
