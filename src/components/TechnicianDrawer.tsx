import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Bot, CheckCircle2, ClipboardCheck, Clock, FastForward, GraduationCap, Loader2, Lock, MapPin, Truck, Wrench, X, XCircle } from 'lucide-react';
import { CHART_ANIM, ChartTooltip, LegendItem, LevelBadge, RiskBadge, SpecialtyBadge } from './ui';
import {
  buildSawtooth,
  CATEGORY_LABEL,
  currentRetention,
  dayToDate,
  ireCategoryValue,
  ireValue,
  lastReview,
  PASS_THRESHOLD,
  riskOf,
  SIM_STEP_DAYS,
  needsReinforcement,
  REINFORCEMENT_THRESHOLD,
} from '../lib/retention';
import type { ErrorCategory, Technician } from '../types';
import { useChartColors } from '../lib/theme';

export default function TechnicianDrawer({
  tech,
  onClose,
  onSimulate,
  onActivateExam,
  onApplyExam,
  onCancelExam,
}: {
  tech: Technician;
  onClose: () => void;
  onSimulate: () => void;
  onActivateExam: () => void;
  onApplyExam: () => void;
  onCancelExam: () => void;
}) {
  const SERIES = useChartColors();
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const overall = Math.round(tech.sections.reduce((a, s) => a + s.progress, 0) / tech.sections.length);

  const applyExam = () => {
    setApplying(true);
    window.setTimeout(() => {
      onApplyExam();
      setApplying(false);
      setFlashId(`${tech.id}-rf-${tech.currentDay + 3}`);
      window.setTimeout(() => setFlashId(null), 2200);
    }, 900);
  };
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = useMemo(() => buildSawtooth(tech), [tech]);
  const R = currentRetention(tech);
  const S = lastReview(tech.reviews, tech.currentDay).stability;
  const ire = ireValue(tech.ire);
  const risk = riskOf(tech);
  const exams = tech.reviews.filter((r) => r.score !== null);

  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      onSimulate();
      setRunning(false);
      setFlashId(`${tech.id}-${tech.currentDay + SIM_STEP_DAYS}`);
      window.setTimeout(() => setFlashId(null), 2200);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-base-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[640px] animate-slide-in flex-col border-l border-base-600 bg-base-900 shadow-2xl">
        {/* Encabezado */}
        <div className="border-b border-base-700 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-petrol-700 text-sm font-semibold text-white">{tech.initials}</span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-fg">{tech.name}</h2>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <MapPin size={12} /> {tech.depot} · {tech.id}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SpecialtyBadge s={tech.specialty} />
                <LevelBadge l={tech.lexicalLevel} />
                <RiskBadge risk={risk} />
                {tech.hvCertified && <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Certificado AV</span>}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-base-800 hover:text-fg" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: 'R(t) actual', v: `${(R * 100).toFixed(0)}%`, warn: R < 0.5 },
              { l: 'Estabilidad S', v: `${S.toFixed(0)} d`, warn: false },
              { l: 'IRE global', v: `${(ire * 100).toFixed(0)}%`, warn: ire > 0.35 },
              { l: 'Día programa', v: `D${tech.currentDay}`, warn: false },
            ].map((m) => (
              <div key={m.l} className="rounded-lg border border-base-700 bg-base-850 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{m.l}</p>
                <p key={m.v} className={`mt-1 animate-fade-up font-mono text-lg font-semibold tabular-nums ${m.warn ? 'text-amber-300' : 'text-fg'}`}>
                  {m.v}
                </p>
              </div>
            ))}
          </div>

          {/* Examen de refuerzo */}
          {tech.reinforcement ? (
            <section className="animate-fade-up rounded-xl border border-sky-500/40 bg-sky-500/5 p-4">
              <div className="flex items-start gap-3">
                <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-sky-300" />
                <div className="min-w-0 flex-1">
                  <h3 className="card-title">Examen de refuerzo activo · solo para {tech.name.split(' ')[0]}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {CATEGORY_LABEL[tech.reinforcement.category]} · {tech.reinforcement.questions} reactivos · activado {tech.reinforcement.activatedAt}
                  </p>
                  <p className="mt-2 text-xs text-slate-300">{tech.reinforcement.reason}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button onClick={applyExam} disabled={applying} className="btn-primary flex-1">
                  {applying ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />}
                  {applying ? 'Calificando…' : 'Registrar resultado del refuerzo (simular)'}
                </button>
                <button onClick={onCancelExam} disabled={applying} className="btn-ghost">
                  Cancelar examen
                </button>
              </div>
            </section>
          ) : (
            needsReinforcement(tech) && (
              <section className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:flex-row sm:items-center">
                <GraduationCap size={18} className="shrink-0 text-amber-400" />
                <p className="flex-1 text-xs text-slate-300">
                  Evaluaciones con ponderación baja (última: <b className="text-amber-300">{tech.log[0]?.score}/100</b>, umbral {REINFORCEMENT_THRESHOLD}). Se
                  recomienda un examen de refuerzo dirigido.
                </p>
                <button onClick={onActivateExam} className="btn-amber whitespace-nowrap text-xs">
                  <GraduationCap size={14} /> Examen de refuerzo
                </button>
              </section>
            )
          )}

          {/* Curva individual */}
          <section className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="card-title">Curva de retención individual</h3>
                <p className="card-sub">Cada examen diferido reinicia la curva con una nueva estabilidad S</p>
              </div>
              <span className="text-[11px] text-slate-500">{dayToDate(tech.currentDay)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-4">
              <LegendItem color={SERIES.s1} label="Historial R(t)" />
              <LegendItem color={SERIES.s1} label="Proyección 45 d" dashed />
              <LegendItem color="#f59e0b" label="Umbral 70 %" dashed />
            </div>
            <div className="mt-1 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 22, right: 12, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke={SERIES.grid} vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[0, 'dataMax']}
                    tick={{ fill: SERIES.axis, fontSize: 10 }}
                    axisLine={{ stroke: SERIES.grid }}
                    tickLine={false}
                    tickFormatter={(v) => `D${v}`}
                  />
                  <YAxis domain={[0, 100]} tick={{ fill: SERIES.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    cursor={{ stroke: SERIES.cursor, strokeDasharray: '3 3' }}
                    content={<ChartTooltip labelFormatter={(l) => `Día ${l} · ${dayToDate(Number(l))}`} valueSuffix=" %" />}
                  />
                  <ReferenceLine y={PASS_THRESHOLD} stroke="#f59e0b" strokeDasharray="5 4" strokeOpacity={0.6} />
                  <ReferenceLine x={tech.currentDay} stroke="#3fb8c0" strokeOpacity={0.5} label={{ value: 'Hoy', fill: '#7fd3d8', fontSize: 10, position: 'insideTopRight' }} />
                  <Line dataKey="real" name="Retención" stroke={SERIES.s1} strokeWidth={2} dot={false} isAnimationActive={CHART_ANIM} animationDuration={700} />
                  <Line dataKey="proyeccion" name="Proyección" stroke={SERIES.s1} strokeOpacity={0.7} strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                  {exams.map((e) => (
                    <ReferenceDot
                      key={e.day}
                      x={e.day}
                      y={100}
                      r={5}
                      fill={(e.score ?? 0) >= PASS_THRESHOLD ? '#10b981' : '#ef4444'}
                      stroke={SERIES.surface}
                      strokeWidth={2}
                      label={{ value: `${e.score}`, position: 'top', fill: '#cbd5e1', fontSize: 10 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <button onClick={run} disabled={running} className="btn-amber mt-3 w-full">
              {running ? <Loader2 size={16} className="animate-spin" /> : <FastForward size={16} />}
              {running ? 'Aplicando examen diferido…' : `Simular Examen Diferido (Paso de ${SIM_STEP_DAYS} días)`}
            </button>
          </section>

          {/* IRE desglosado */}
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="card-title">Índice de Redundancia de Errores (IRE)</h3>
                <p className="card-sub">Proporción de errores que se repiten por categoría</p>
              </div>
              <span className="font-mono text-xl font-semibold text-fg tabular-nums">{(ire * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-4 space-y-3">
              {(Object.keys(tech.ire) as ErrorCategory[]).map((k) => {
                const v = ireCategoryValue(tech.ire, k);
                const { total, repeated } = tech.ire[k];
                return (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-300">{CATEGORY_LABEL[k]}</span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {repeated}/{total} · <span className={v > 0.4 ? 'text-amber-300' : 'text-slate-200'}>{(v * 100).toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-base-700">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${v > 0.4 ? 'bg-amber-500' : v > 0.2 ? 'bg-petrol-400' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.max(2, v * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Secciones */}
          <section className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="card-title">Ruta modular</h3>
              <span className="text-xs text-slate-400">
                Progreso total <b key={overall} className="ml-1 inline-block animate-fade-up font-mono text-base text-fg">{overall}%</b>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-base-700">
              <div className="h-full rounded-full bg-gradient-to-r from-petrol-500 to-emerald-500 transition-all duration-700" style={{ width: `${overall}%` }} />
            </div>
            <div className="mt-3 space-y-2">
              {tech.sections.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-base-700 bg-base-850 px-3 py-2">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-md text-xs font-bold ${
                      s.status === 'aprobada' ? 'bg-emerald-500/20 text-emerald-300' : s.status === 'en curso' ? 'bg-petrol-500/20 text-petrol-300' : 'bg-base-700 text-slate-500'
                    }`}
                  >
                    {s.status === 'bloqueada' ? <Lock size={13} /> : s.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${s.status === 'bloqueada' ? 'text-slate-500' : 'text-slate-200'}`}>
                      Sección {s.id} · {s.title}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-base-700">
                      <div className={`h-full transition-all duration-700 ${s.status === 'aprobada' ? 'bg-emerald-500' : 'bg-petrol-400'}`} style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                  <span className="w-20 text-right">
                    <span className={`block font-mono text-sm font-semibold tabular-nums ${s.status === 'aprobada' ? 'text-emerald-300' : s.status === 'en curso' ? 'text-petrol-300' : 'text-slate-500'}`}>
                      {s.progress}%
                    </span>
                    <span className="block text-[10px] capitalize text-slate-500">{s.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Bitácora */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Bot size={16} className="text-petrol-300" />
              <h3 className="card-title">Bitácora de Retroalimentación IA</h3>
              <span className="ml-auto text-[11px] text-slate-500">{tech.log.length} entradas</span>
            </div>
            <ol className="relative space-y-3 border-l border-base-600 pl-5">
              {tech.log.map((e) => (
                <li
                  key={e.id}
                  className={`relative rounded-lg border p-3 transition-all ${
                    flashId === e.id ? 'animate-fade-up border-amber-400/60 bg-amber-500/10' : 'border-base-700 bg-base-850'
                  }`}
                >
                  <span className={`absolute -left-[27px] top-4 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-base-900 ${e.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock size={11} /> {e.date} · D{e.day}
                    </span>
                    <span className={`chip ${e.mode === 'Taller' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                      {e.mode === 'Taller' ? <Wrench size={10} /> : <Truck size={10} />}
                      {e.mode}
                    </span>
                    <span className="ml-auto flex items-center gap-1 font-mono">
                      {e.passed ? <CheckCircle2 size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-red-400" />}
                      <span className="text-slate-200">{e.score}/100</span>
                      <span className="text-slate-500">· R {e.retentionAtExam}%</span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-slate-200">{e.module}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    <span className="text-slate-500">Falla detectada: </span>
                    {e.failure}
                  </p>
                  <p className="mt-1.5 rounded-md bg-petrol-500/10 px-2 py-1.5 text-xs text-petrol-200">
                    <span className="font-semibold text-petrol-300">Recomendación IA: </span>
                    {e.recommendation}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
