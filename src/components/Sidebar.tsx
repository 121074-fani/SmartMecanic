import { Activity, Bus, FileCog, ScanEye, Users, Zap } from 'lucide-react';
import type { ViewId } from '../types';

const NAV: { id: ViewId; label: string; sub: string; icon: typeof Activity }[] = [
  { id: 'resumen', label: 'Resumen Ejecutivo', sub: 'KPIs y analítica predictiva', icon: Activity },
  { id: 'tecnicos', label: 'Matriz de Técnicos', sub: 'Modularidad y retroalimentación', icon: Users },
  { id: 'ingesta', label: 'Ingesta de Manuales', sub: 'IA + RAG y SBOM', icon: FileCog },
  { id: 'auditoria', label: 'Auditoría Visual', sub: 'Copiloto IA en campo', icon: ScanEye },
];

export default function Sidebar({
  view,
  onChange,
  activeModules,
  alerts,
}: {
  view: ViewId;
  onChange: (v: ViewId) => void;
  activeModules: number;
  alerts: number;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-base-700 bg-base-900">
      <div className="flex items-center gap-3 border-b border-base-700 px-5 py-5">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-petrol-500 to-petrol-700 shadow-lg shadow-petrol-900/50">
          <Bus size={20} className="text-white" />
          <Zap size={12} className="absolute -right-1 -top-1 rounded-full bg-amber-500 p-0.5 text-base-950" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Fleet Academy</p>
          <p className="text-[11px] text-slate-400">Portal Gerencial</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Vistas</p>
        {NAV.map((n, i) => {
          const active = n.id === view;
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              onClick={() => onChange(n.id)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                active ? 'bg-petrol-500/15 text-white' : 'text-slate-400 hover:bg-base-800 hover:text-slate-200'
              }`}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-petrol-400" />}
              <Icon size={18} className={active ? 'text-petrol-300' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{n.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{n.sub}</span>
              </span>
              <span className="font-mono text-[10px] text-slate-600">0{i + 1}</span>
              {n.id === 'tecnicos' && alerts > 0 && (
                <span className="absolute right-8 top-2 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-base-950">{alerts}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-base-700 bg-base-850 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Módulos activos</p>
        <p key={activeModules} className="mt-1 animate-fade-up text-2xl font-semibold text-white tabular-nums">{activeModules}</p>
        <p className="text-[11px] text-slate-500">Publicados en App Móvil y Visor AR</p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Modo demo · 100 % local
        </div>
      </div>
    </aside>
  );
}
