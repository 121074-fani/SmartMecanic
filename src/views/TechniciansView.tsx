import { useMemo, useState } from 'react';
import { ArrowDownUp, ChevronRight, Filter, Search, Zap } from 'lucide-react';
import { LevelBadge, PageHeader, RiskBadge, SectionProgress, SpecialtyBadge } from '../components/ui';
import TechnicianDrawer from '../components/TechnicianDrawer';
import { currentRetention, ireValue, riskOf } from '../lib/retention';
import type { RiskLevel, Specialty, Technician } from '../types';

type SortKey = 'name' | 'delegation' | 'risk' | 'retention';
const RISK_ORDER: Record<RiskLevel, number> = { Alto: 0, Medio: 1, Bajo: 2 };

export default function TechniciansView({
  technicians,
  onSimulate,
  focusId,
  onFocusChange,
}: {
  technicians: Technician[];
  onSimulate: (id: string) => void;
  focusId: string | null;
  onFocusChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [spec, setSpec] = useState<Specialty | 'Todas'>('Todas');
  const [risk, setRisk] = useState<RiskLevel | 'Todos'>('Todos');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'risk', asc: true });

  const rows = useMemo(() => {
    const list = technicians
      .map((t) => ({ t, risk: riskOf(t), R: currentRetention(t), ire: ireValue(t.ire) }))
      .filter(({ t, risk: r }) => {
        if (spec !== 'Todas' && t.specialty !== spec) return false;
        if (risk !== 'Todos' && r !== risk) return false;
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
        default:
          return (RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.R - b.R) * dir;
      }
    });
    return list;
  }, [technicians, q, spec, risk, sort]);

  const selected = technicians.find((t) => t.id === focusId) ?? null;
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  const SortTh = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`th ${className}`}>
      <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-white ${sort.key === k ? 'text-petrol-300' : ''}`}>
        {children}
        <ArrowDownUp size={11} />
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Vista 02 · Modularidad y retroalimentación"
        title="Matriz de Técnicos"
        desc="Especialidad detectada, nivel léxico asignado y avance por secciones con bloqueo progresivo. Haz clic en un técnico para ver su IRE y simular exámenes diferidos."
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, depósito o ID…"
            className="w-full rounded-lg border border-base-600 bg-base-850 py-2 pl-9 pr-3 text-sm focus:border-petrol-500 focus:outline-none"
          />
        </div>
        <Filter size={14} className="text-slate-500" />
        <div className="flex flex-wrap gap-1 rounded-lg border border-base-600 bg-base-850 p-0.5 text-xs">
          {(['Todas', 'Mecánica Pesada', 'Alto Voltaje', 'Refacciones/SBOM'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpec(s)}
              className={`rounded-md px-2.5 py-1 transition-colors ${spec === s ? 'bg-petrol-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={risk}
          onChange={(e) => setRisk(e.target.value as RiskLevel | 'Todos')}
          className="rounded-lg border border-base-600 bg-base-850 px-3 py-2 text-xs text-slate-300 focus:border-petrol-500 focus:outline-none"
        >
          <option value="Todos">Riesgo: todos</option>
          <option value="Alto">Riesgo alto</option>
          <option value="Medio">Riesgo medio</option>
          <option value="Bajo">Riesgo bajo</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">{rows.length} técnicos</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px]">
            <thead className="border-b border-base-700 bg-base-850/60">
              <tr>
                <SortTh k="name">Técnico</SortTh>
                <th className="th">Especialidad detectada</th>
                <th className="th">Nivel léxico</th>
                <th className="th w-[260px]">Progreso modular</th>
                <SortTh k="retention" className="text-right">R(t)</SortTh>
                <SortTh k="delegation">Delegación</SortTh>
                <SortTh k="risk">Riesgo</SortTh>
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
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-700 text-xs font-semibold text-slate-200">
                        {t.initials}
                        {t.hvCertified && (
                          <span title="Certificado en Alto Voltaje" className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-2 ring-base-800">
                            <Zap size={9} className="text-base-950" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-100">{t.name}</p>
                        <p className="text-[11px] text-slate-500">
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
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-base-700">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${t.delegationScore >= 80 ? 'bg-emerald-500' : t.delegationScore >= 60 ? 'bg-petrol-400' : 'bg-amber-500'}`}
                          style={{ width: `${t.delegationScore}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-300 tabular-nums">{t.delegationScore}</span>
                    </div>
                  </td>
                  <td className="td">
                    <RiskBadge risk={r} />
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

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-emerald-500" /> Sección aprobada</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-petrol-400" /> En curso</span>
        <span className="inline-flex items-center gap-1.5"><span className="hazard-stripe h-2 w-4 rounded bg-base-700" /> Bloqueada (requiere sección previa)</span>
      </div>

      {selected && <TechnicianDrawer tech={selected} onClose={() => onFocusChange(null)} onSimulate={() => onSimulate(selected.id)} />}
    </div>
  );
}
