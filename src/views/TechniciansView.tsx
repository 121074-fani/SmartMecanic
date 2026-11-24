import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownUp, ChevronRight, ClipboardCheck, Filter, GraduationCap, Search, Zap } from 'lucide-react';
import { LevelBadge, PageHeader, RiskBadge, SectionProgress, SpecialtyBadge } from '../components/ui';
import TechnicianDrawer from '../components/TechnicianDrawer';
import { currentRetention, lastScore, needsReinforcement, REINFORCEMENT_THRESHOLD, riskOf } from '../lib/retention';
import type { RiskLevel, Specialty, Technician } from '../types';

type SortKey = 'name' | 'delegation' | 'risk' | 'retention' | 'score';
const RISK_ORDER: Record<RiskLevel, number> = { Alto: 0, Medio: 1, Bajo: 2 };

/** Botón / estado del examen de refuerzo para un técnico. */
function ReinforcementAction({ t, onActivate, onOpen }: { t: Technician; onActivate: () => void; onOpen: () => void }) {
  if (t.reinforcement)
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="chip whitespace-nowrap border-sky-500/30 bg-sky-500/10 py-1 text-sky-300 hover:bg-sky-500/20"
        title="Examen activo solo para este técnico — abrir para registrar resultado"
      >
        <ClipboardCheck size={12} /> Refuerzo activo
      </button>
    );
  if (needsReinforcement(t))
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onActivate();
        }}
        className="btn-amber whitespace-nowrap px-2.5 py-1 text-xs"
        title={`Ponderación bajo ${REINFORCEMENT_THRESHOLD}/100 — activar examen solo para este técnico`}
      >
        <GraduationCap size={13} /> Examen de refuerzo
      </button>
    );
  return <span className="text-xs text-slate-600">—</span>;
}

export default function TechniciansView({
  technicians,
  onSimulate,
  onActivateExam,
  onApplyExam,
  onCancelExam,
  focusId,
  onFocusChange,
}: {
  technicians: Technician[];
  onSimulate: (id: string) => void;
  onActivateExam: (id: string) => void;
  onApplyExam: (id: string) => void;
  onCancelExam: (id: string) => void;
  focusId: string | null;
  onFocusChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [spec, setSpec] = useState<Specialty | 'Todas'>('Todas');
  const [risk, setRisk] = useState<RiskLevel | 'Todos' | 'Refuerzo'>('Todos');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'risk', asc: true });

  const pendingCount = technicians.filter((t) => needsReinforcement(t) && !t.reinforcement).length;
  const activeCount = technicians.filter((t) => t.reinforcement).length;

  const rows = useMemo(() => {
    const list = technicians
      .map((t) => ({ t, risk: riskOf(t), R: currentRetention(t), score: lastScore(t) ?? 0 }))
      .filter(({ t, risk: r }) => {
        if (spec !== 'Todas' && t.specialty !== spec) return false;
        if (risk === 'Refuerzo' && !(needsReinforcement(t) || t.reinforcement)) return false;
        if (risk !== 'Todos' && risk !== 'Refuerzo' && r !== risk) return false;
        if (q && !`${t.name} ${t.depot} ${t.id}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      });
    const dir = sort.asc ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return a.t.name.localeCompare(b.t.name) * dir;
        case 'delegation':
          return (a.t.delegationScore - b.t.delegationScore) * dir;
        case 'retention':
          return (a.R - b.R) * dir;
        case 'score':
          return (a.score - b.score) * dir;
        default:
          return (RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.R - b.R) * dir;
      }
    });
    return list;
  }, [technicians, q, spec, risk, sort]);

  const selected = technicians.find((t) => t.id === focusId) ?? null;
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  const SortTh = ({ k, children, className = '' }: { k: SortKey; children: ReactNode; className?: string }) => (
    <th className={`th ${className}`}>
      <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-fg ${sort.key === k ? 'text-petrol-300' : ''}`}>
        {children}
        <ArrowDownUp size={11} />
      </button>
    </th>
  );

  const ScoreCell = ({ t }: { t: Technician }) => {
    const s = lastScore(t);
    if (s === null) return <span className="text-slate-500">—</span>;
    return <span className={`font-mono tabular-nums ${s < REINFORCEMENT_THRESHOLD ? 'text-amber-300' : 'text-slate-200'}`}>{s}/100</span>;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Vista 02 · Modularidad y retroalimentación"
        title="Matriz de Técnicos"
        desc="Especialidad detectada, nivel léxico asignado y avance por secciones con bloqueo progresivo. Haz clic en un técnico para ver su IRE y simular exámenes diferidos."
      />

      {(pendingCount > 0 || activeCount > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <GraduationCap size={18} className="shrink-0 text-amber-400" />
          <p className="min-w-0 flex-1 text-slate-300">
            <b className="text-amber-300">{pendingCount}</b> técnico{pendingCount === 1 ? '' : 's'} con evaluaciones bajo {REINFORCEMENT_THRESHOLD}/100 sin examen de refuerzo
            {activeCount > 0 && (
              <>
                {' '}· <b className="text-sky-300">{activeCount}</b> con refuerzo activo
              </>
            )}
            .
          </p>
          <button onClick={() => setRisk(risk === 'Refuerzo' ? 'Todos' : 'Refuerzo')} className="btn-ghost px-3 py-1.5 text-xs">
            {risk === 'Refuerzo' ? 'Ver todos' : 'Ver solo estos'}
          </button>
        </div>
      )}

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, depósito o ID…" className="input pl-9" />
        </div>
        <Filter size={14} className="hidden text-slate-500 sm:block" />
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-base-600 bg-base-850 p-0.5 text-xs">
          {(['Todas', 'Mecánica Pesada', 'Alto Voltaje', 'Refacciones/SBOM'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpec(s)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 transition-colors ${spec === s ? 'bg-petrol-500 text-white' : 'text-slate-400 hover:text-fg'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <select value={risk} onChange={(e) => setRisk(e.target.value as typeof risk)} className="input w-auto py-2 text-xs">
          <option value="Todos">Riesgo: todos</option>
          <option value="Alto">Riesgo alto</option>
          <option value="Medio">Riesgo medio</option>
          <option value="Bajo">Riesgo bajo</option>
          <option value="Refuerzo">Requieren refuerzo</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">{rows.length} técnicos</span>
      </div>

      {/* Escritorio / laptop: tabla */}
      <div className="card hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead className="border-b border-base-700 bg-base-850/60">
              <tr>
                <SortTh k="name">Técnico</SortTh>
                <th className="th">Especialidad detectada</th>
                <th className="th">Nivel léxico</th>
                <th className="th w-[220px]">Progreso modular</th>
                <SortTh k="retention" className="text-right">R(t)</SortTh>
                <SortTh k="score">Últ. evaluación</SortTh>
                <SortTh k="delegation">Delegación</SortTh>
                <SortTh k="risk">Riesgo</SortTh>
                <th className="th">Refuerzo</th>
                <th className="th w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-base-700">
              {rows.map(({ t, risk: r, R }) => (
                <tr
                  key={t.id}
                  onClick={() => onFocusChange(t.id)}
                  className={`group cursor-pointer transition-colors hover:bg-petrol-500/5 ${focusId === t.id ? 'bg-petrol-500/10' : ''}`}
                >
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar t={t} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-100">{t.name}</p>
                        <p className="max-w-[220px] truncate text-[11px] text-slate-500">
                          {t.id} · {t.depot}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <SpecialtyBadge s={t.specialty} />
                  </td>
                  <td className="td">
                    <LevelBadge l={t.lexicalLevel} />
                  </td>
                  <td className="td">
                    <SectionProgress sections={t.sections} />
                  </td>
                  <td className="td text-right font-mono tabular-nums">
                    <span className={R < 0.5 ? 'text-amber-300' : 'text-slate-200'}>{(R * 100).toFixed(0)} %</span>
                  </td>
                  <td className="td text-sm">
                    <ScoreCell t={t} />
                  </td>
                  <td className="td">
                    <DelegationBar v={t.delegationScore} />
                  </td>
                  <td className="td">
                    <RiskBadge risk={r} />
                  </td>
                  <td className="td">
                    <ReinforcementAction t={t} onActivate={() => onActivateExam(t.id)} onOpen={() => onFocusChange(t.id)} />
                  </td>
                  <td className="td">
                    <ChevronRight size={16} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-petrol-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Móvil / tableta: tarjetas */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
        {rows.map(({ t, risk: r, R }) => (
          <li key={t.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onFocusChange(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && onFocusChange(t.id)}
              className="card block w-full cursor-pointer p-4 text-left transition-colors hover:border-base-500"
            >
              <div className="flex items-start gap-3">
                <Avatar t={t} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{t.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {t.id} · {t.depot}
                  </p>
                </div>
                <RiskBadge risk={r} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SpecialtyBadge s={t.specialty} />
                <LevelBadge l={t.lexicalLevel} />
              </div>
              <div className="mt-3">
                <SectionProgress sections={t.sections} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">R(t)</p>
                  <p className={`font-mono ${R < 0.5 ? 'text-amber-300' : 'text-slate-200'}`}>{(R * 100).toFixed(0)} %</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Últ. eval.</p>
                  <ScoreCell t={t} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Delegación</p>
                  <p className="font-mono text-slate-200">{t.delegationScore}</p>
                </div>
              </div>
              {(needsReinforcement(t) || t.reinforcement) && (
                <div className="mt-3 border-t border-base-700 pt-3">
                  <ReinforcementAction t={t} onActivate={() => onActivateExam(t.id)} onOpen={() => onFocusChange(t.id)} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded bg-emerald-500" /> Sección aprobada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded bg-petrol-400" /> En curso
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="hazard-stripe h-2 w-4 rounded bg-base-700" /> Bloqueada (requiere sección previa)
        </span>
      </div>

      {selected && (
        <TechnicianDrawer
          tech={selected}
          onClose={() => onFocusChange(null)}
          onSimulate={() => onSimulate(selected.id)}
          onActivateExam={() => onActivateExam(selected.id)}
          onApplyExam={() => onApplyExam(selected.id)}
          onCancelExam={() => onCancelExam(selected.id)}
        />
      )}
    </div>
  );
}

function Avatar({ t }: { t: Technician }) {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-700 text-xs font-semibold text-slate-200">
      {t.initials}
      {t.hvCertified && (
        <span title="Certificado en Alto Voltaje" className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-2 ring-base-800">
          <Zap size={9} className="text-slate-950" />
        </span>
      )}
    </span>
  );
}

function DelegationBar({ v }: { v: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-base-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-petrol-400' : 'bg-amber-500'}`}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-slate-300">{v}</span>
    </div>
  );
}
