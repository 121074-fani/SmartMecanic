import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BrainCircuit, ChevronRight, GitBranch, Repeat2, ShieldCheck, Sparkles, TrendingDown, Zap } from 'lucide-react';
import { CHART_ANIM, ChartTooltip, KpiCard, LegendItem, PageHeader, RiskBadge, SpecialtyBadge } from '../components/ui';
import { ERROR_RECURRENCE, OBSERVED_EXAMS, RETENTION_COHORTS, type ErrorPeriod } from '../data/mock';
import { currentRetention, fleetIre, ireValue, PASS_THRESHOLD, retention, riskOf } from '../lib/retention';
import type { Technician } from '../types';

import { useChartColors } from '../lib/theme';

const SHORT_CAT: Record<string, string> = { 'Protocolo LOTO': 'LOTO', 'Pares de apriete': 'Apriete', 'Selección SBOM': 'SBOM', 'Aislamiento AV': 'Aisl. AV', 'Diagnóstico CAN': 'Diag. CAN' };

export default function ExecutiveView({
  technicians,
  onOpenTechnician,
  errorRecurrence = ERROR_RECURRENCE,
}: {
  technicians: Technician[];
  onOpenTechnician: (id: string) => void;
  /** recurrencia de errores base + telemetría real de los técnicos (analyticsService) */
  errorRecurrence?: typeof ERROR_RECURRENCE;
}) {
  const SERIES = useChartColors();
  const COHORT_COLORS = [SERIES.s3, SERIES.s1, SERIES.s2];
  const [period, setPeriod] = useState<ErrorPeriod>('30d');
  const [showObserved, setShowObserved] = useState(true);

  const kpis = useMemo(() => {
    const avgR = technicians.reduce((a, t) => a + currentRetention(t), 0) / technicians.length;
    const hvPool = technicians.filter((t) => t.specialty === 'Alto Voltaje');
    const hvCert = technicians.filter((t) => t.hvCertified).length;
    const deleg = technicians.reduce((a, t) => a + t.delegationScore, 0) / technicians.length;
    return { avgR, ire: fleetIre(technicians), hvCert, hvPool: hvPool.length, deleg };
  }, [technicians]);

  const retentionData = useMemo(
    () =>
      Array.from({ length: 91 }, (_, t) => {
        const row: Record<string, number | null> = { t };
        RETENTION_COHORTS.forEach((c) => (row[c.key] = Math.round(retention(t, c.S) * 1000) / 10));
        const obs = OBSERVED_EXAMS[t];
        row.obsAprobados = obs ? obs.aprobados : null;
        row.obsRefuerzo = obs ? obs.refuerzo : null;
        row.obsSinAprobar = obs ? obs.sinAprobar : null;
        return row;
      }),
    [],
  );

  const errorData = errorRecurrence[period];
  const topRescue = [...errorData].sort((a, b) => b['Rescate en Ruta'] / b.Taller - a['Rescate en Ruta'] / a.Taller)[0];

  const atRisk = technicians
    .map((t) => ({ t, risk: riskOf(t), R: currentRetention(t), ire: ireValue(t.ire) }))
    .filter((x) => x.risk !== 'Bajo')
    .sort((a, b) => (a.risk === b.risk ? a.R - b.R : a.risk === 'Alto' ? -1 : 1))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow="Vista 01 · Analítica predictiva"
        title="Resumen Ejecutivo"
        desc="Estado de la retención del conocimiento técnico, redundancia de errores y certificación en alto voltaje de toda la flota."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tasa de Retención Promedio R(t)"
          value={(kpis.avgR * 100).toFixed(1)}
          unit="%"
          hint="R(t) = e^(−t/S) al día de hoy"
          icon={<BrainCircuit size={16} />}
          tone="petrol"
          delta={{ text: '4.2 pts vs. mes ant.', good: true }}
        />
        <KpiCard
          label="Índice de Redundancia de Errores (IRE)"
          value={(kpis.ire * 100).toFixed(1)}
          unit="%"
          hint="Errores repetidos / totales"
          icon={<Repeat2 size={16} />}
          tone="amber"
          delta={{ text: '2.1 pts vs. mes ant.', good: true }}
        />
        <KpiCard
          label="Técnicos Certificados en Alto Voltaje"
          value={`${kpis.hvCert}`}
          unit={`/ ${kpis.hvPool} en ruta AV`}
          hint="Secciones 1–3 aprobadas + práctica"
          icon={<ShieldCheck size={16} />}
          tone="emerald"
          delta={{ text: '+1 este mes', good: true }}
        />
        <KpiCard
          label="Tasa de Delegación Correcta"
          value={kpis.deleg.toFixed(1)}
          unit="%"
          hint="Casos escalados al nivel adecuado"
          icon={<GitBranch size={16} />}
          tone="sky"
          delta={{ text: '1.3 pts vs. mes ant.', good: false }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-5">
        {/* Curva de retención */}
        <section className="card p-5 2xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="card-title">Curva de Retención Estimada · R(t) = e<sup>−t/S</sup></h2>
              <p className="card-sub mt-0.5">Retención (%) por días transcurridos tras la última evaluación, por estado del módulo</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={showObserved}
                onChange={(e) => setShowObserved(e.target.checked)}
                className="accent-petrol-500"
              />
              Mostrar exámenes diferidos observados
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {RETENTION_COHORTS.map((c, i) => (
              <LegendItem key={c.key} color={COHORT_COLORS[i]} label={c.label} />
            ))}
            <LegendItem color="#f59e0b" label={`Umbral de aprobación (${PASS_THRESHOLD} %)`} dashed />
          </div>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionData} margin={{ top: 10, right: 16, left: -8, bottom: 4 }}>
                <CartesianGrid stroke={SERIES.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={[0, 90]}
                  ticks={[0, 15, 30, 45, 60, 75, 90]}
                  tick={{ fill: SERIES.axis, fontSize: 11 }}
                  axisLine={{ stroke: SERIES.grid }}
                  tickLine={false}
                  tickFormatter={(v) => `D+${v}`}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: SERIES.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  cursor={{ stroke: SERIES.cursor, strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={<ChartTooltip labelFormatter={(l) => `Día ${l} tras evaluación`} valueSuffix=" %" />}
                />
                <ReferenceLine y={PASS_THRESHOLD} stroke="#f59e0b" strokeDasharray="5 4" strokeOpacity={0.7} />
                {[15, 30, 45, 60].map((d) => (
                  <ReferenceLine key={d} x={d} stroke="#2a3b4c" strokeDasharray="2 4" />
                ))}
                {RETENTION_COHORTS.map((c, i) => (
                  <Line
                    key={c.key}
                    dataKey={c.key}
                    name={c.label.split(' (')[0]}
                    stroke={COHORT_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: SERIES.surface, strokeWidth: 2 }}
                    isAnimationActive={CHART_ANIM}
                  />
                ))}
                {showObserved &&
                  (['obsAprobados', 'obsRefuerzo', 'obsSinAprobar'] as const).map((k, i) => (
                    <Line
                      key={k}
                      dataKey={k}
                      name={`Observado · ${RETENTION_COHORTS[i].label.split(' (')[0]}`}
                      stroke="transparent"
                      dot={{ r: 4.5, fill: COHORT_COLORS[i], stroke: SERIES.surface, strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: COHORT_COLORS[i], stroke: SERIES.surface, strokeWidth: 2 }}
                      connectNulls={false}
                      legendType="none"
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Las líneas verticales marcan los exámenes diferidos (D+15, D+30, D+45, D+60). Cada examen aprobado incrementa la estabilidad S
            del conocimiento ×1.6 (repaso espaciado).
          </p>
        </section>

        {/* Errores */}
        <section className="card p-5 2xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="card-title">Recurrencia de Fallos Críticos</h2>
              <p className="card-sub mt-0.5">Errores repetidos · Taller vs. Rescate en Ruta</p>
            </div>
            <div className="flex rounded-lg border border-base-600 bg-base-850 p-0.5 text-xs">
              {(['30d', '90d'] as ErrorPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 transition-colors ${period === p ? 'bg-petrol-500 text-white' : 'text-slate-400 hover:text-fg'}`}
                >
                  {p === '30d' ? '30 días' : 'Trimestre'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.s1 }} /> Taller
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.s2 }} /> Rescate en Ruta
            </span>
          </div>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorData} margin={{ top: 10, right: 8, left: -16, bottom: 4 }} barCategoryGap="28%">
                <CartesianGrid stroke={SERIES.grid} vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fill: SERIES.axis, fontSize: 10 }}
                  axisLine={{ stroke: SERIES.grid }}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(v: string) => SHORT_CAT[v] ?? v}
                />
                <YAxis tick={{ fill: SERIES.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(63,184,192,0.06)' }} content={<ChartTooltip valueSuffix=" fallos" />} />
                <Bar isAnimationActive={CHART_ANIM} dataKey="Taller" stackId="e" fill={SERIES.s1} stroke={SERIES.surface} strokeWidth={2} radius={[0, 0, 4, 4]} />
                <Bar isAnimationActive={CHART_ANIM} dataKey="Rescate en Ruta" stackId="e" fill={SERIES.s2} stroke={SERIES.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-100/90">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-400" />
            <span>
              <b>{topRescue.category}</b> falla {(topRescue['Rescate en Ruta'] / topRescue.Taller).toFixed(1)}× más en rescate en ruta que en
              taller. Sugerencia: priorizar micro-cápsulas AR de ese procedimiento en el kit de rescate.
            </span>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="card-title">Técnicos que requieren intervención</h2>
              <p className="card-sub mt-0.5">Priorizados por riesgo combinado (retención, IRE y delegación)</p>
            </div>
            <TrendingDown size={16} className="text-amber-400" />
          </div>
          <ul className="mt-4 divide-y divide-base-700">
            {atRisk.map(({ t, risk, R, ire }) => (
              <li key={t.id}>
                <button
                  onClick={() => onOpenTechnician(t.id)}
                  className="group flex w-full items-center gap-2 sm:gap-4 rounded-lg px-2 py-3 text-left transition-colors hover:bg-base-850"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-700 text-xs font-semibold text-slate-200">
                    {t.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">{t.name}</span>
                    <span className="text-[11px] text-slate-500">{t.depot}</span>
                  </span>
                  <span className="hidden md:inline-flex"><SpecialtyBadge s={t.specialty} /></span>
                  <span className="hidden w-20 text-right text-xs sm:block">
                    <span className="block font-mono text-slate-200">{(R * 100).toFixed(0)} %</span>
                    <span className="text-[10px] text-slate-500">R(t)</span>
                  </span>
                  <span className="hidden w-16 text-right text-xs sm:block">
                    <span className="block font-mono text-slate-200">{(ire * 100).toFixed(0)} %</span>
                    <span className="text-[10px] text-slate-500">IRE</span>
                  </span>
                  <RiskBadge risk={risk} />
                  <ChevronRight size={16} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-petrol-300" />
                </button>
              </li>
            ))}
            {atRisk.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Sin técnicos en riesgo. 🎉</li>}
          </ul>
        </section>

        <section className="card relative overflow-hidden p-5">
          <div className="hazard-stripe absolute inset-x-0 top-0 h-1.5" />
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <h2 className="card-title">Alertas de Alto Voltaje</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { t: 'Unidad E-12 #0412', d: 'HVIL abierto en rescate en ruta · técnico Nivel Operativo sin certificación AV.', lvl: 'Crítica' },
              { t: 'Depósito Norte', d: '2 técnicos con R(t) < 40 % en Protocolo LOTO. Examen diferido vencido.', lvl: 'Alta' },
              { t: 'Kit de rescate #K-07', d: 'Guantes clase 0 con prueba dieléctrica vencida (> 6 meses).', lvl: 'Alta' },
            ].map((a) => (
              <li key={a.t} className="rounded-lg border border-base-700 bg-base-850 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{a.t}</span>
                  <span
                    className={`chip ${a.lvl === 'Crítica' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}
                  >
                    {a.lvl}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{a.d}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
