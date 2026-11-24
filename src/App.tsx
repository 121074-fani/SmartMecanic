import { useMemo, useState } from 'react';
import { Bell, CalendarDays, Search } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ExecutiveView from './views/ExecutiveView';
import TechniciansView from './views/TechniciansView';
import IngestionView from './views/IngestionView';
import AuditView from './views/AuditView';
import { BASE_ACTIVE_MODULES, INITIAL_PUBLISHED, INITIAL_TECHNICIANS } from './data/mock';
import { riskOf, simulateDeferredExam } from './lib/retention';
import type { PublishedModule, Technician, ViewId } from './types';

const VIEWS: ViewId[] = ['resumen', 'tecnicos', 'ingesta', 'auditoria'];
const params = new URLSearchParams(window.location.search);
const initialView = (VIEWS as string[]).includes(params.get('view') ?? '') ? (params.get('view') as ViewId) : 'resumen';

export default function App() {
  const [view, setView] = useState<ViewId>(initialView);
  const [technicians, setTechnicians] = useState<Technician[]>(INITIAL_TECHNICIANS);
  const [published, setPublished] = useState<PublishedModule[]>(INITIAL_PUBLISHED);
  const [focusTechId, setFocusTechId] = useState<string | null>(params.get('tech'));
  const [toast, setToast] = useState<string | null>(null);

  const activeModules = BASE_ACTIVE_MODULES + (published.length - INITIAL_PUBLISHED.length);
  const highRisk = useMemo(() => technicians.filter((t) => riskOf(t) === 'Alto').length, [technicians]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const simulate = (id: string) =>
    setTechnicians((ts) => ts.map((t) => (t.id === id ? simulateDeferredExam(t) : t)));

  const publish = (m: PublishedModule) => {
    setPublished((p) => [m, ...p]);
    showToast(`${m.code} publicado en App Móvil y Visor AR`);
  };

  const openTechnician = (id: string) => {
    setFocusTechId(id);
    setView('tecnicos');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar view={view} onChange={setView} activeModules={activeModules} alerts={highRisk} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-base-700 bg-base-950/85 px-8 py-3 backdrop-blur">
          <div className="relative max-w-md flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              placeholder="Buscar técnico, unidad, código SBOM…"
              className="w-full rounded-lg border border-base-700 bg-base-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-petrol-500 focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
            <span className="hidden items-center gap-1.5 md:flex">
              <CalendarDays size={14} /> 23 nov 2026 · Flota MX — 4 depósitos
            </span>
            <button className="relative rounded-lg p-2 hover:bg-base-800" aria-label="Notificaciones">
              <Bell size={16} />
              {highRisk > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-petrol-700 text-xs font-semibold text-white">GO</span>
              <div className="hidden leading-tight sm:block">
                <p className="text-slate-200">Gerencia de Operaciones</p>
                <p className="text-[11px] text-slate-500">Administrador</p>
              </div>
            </div>
          </div>
        </header>

        <main key={view} className="animate-fade-up px-8 py-7">
          {view === 'resumen' && <ExecutiveView technicians={technicians} onOpenTechnician={openTechnician} />}
          {view === 'tecnicos' && (
            <TechniciansView
              technicians={technicians}
              onSimulate={simulate}
              focusId={focusTechId}
              onFocusChange={setFocusTechId}
            />
          )}
          {view === 'ingesta' && <IngestionView published={published} onPublish={publish} activeModules={activeModules} />}
          {view === 'auditoria' && <AuditView onOpenTechnician={openTechnician} />}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-lg border border-emerald-500/40 bg-base-900 px-4 py-3 text-sm text-emerald-200 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
