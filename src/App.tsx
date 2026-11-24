import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, ChevronDown, LogOut, Menu, Moon, Search, ShieldCheck, Sun } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AccessModal from './components/AccessModal';
import ExecutiveView from './views/ExecutiveView';
import TechniciansView from './views/TechniciansView';
import IngestionView from './views/IngestionView';
import AuditView from './views/AuditView';
import LoginView from './views/LoginView';
import { BASE_ACTIVE_MODULES, INITIAL_PUBLISHED, INITIAL_TECHNICIANS } from './data/mock';
import {
  activateReinforcement,
  applyReinforcementExam,
  cancelReinforcement,
  riskOf,
  simulateDeferredExam,
} from './lib/retention';
import { loadSession, loadUsers, saveSession, type Session } from './lib/auth';
import { useTheme } from './lib/theme';
import type { PublishedModule, Technician, ViewId } from './types';

const VIEWS: ViewId[] = ['resumen', 'tecnicos', 'ingesta', 'auditoria'];
const params = new URLSearchParams(window.location.search);
const initialView = (VIEWS as string[]).includes(params.get('view') ?? '') ? (params.get('view') as ViewId) : 'resumen';

/** Restaura la sesión solo si el correo sigue autorizado (un supervisor pudo revocarlo). */
const restoreSession = (): Session | null => {
  const s = loadSession();
  if (!s) return null;
  const u = loadUsers().find((x) => x.email === s.email);
  return u ? { email: u.email, name: u.name, role: u.role } : null;
};

const initialsOf = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function App() {
  const { theme, toggle } = useTheme();
  const [session, setSession] = useState<Session | null>(restoreSession);
  const [view, setView] = useState<ViewId>(initialView);
  const [technicians, setTechnicians] = useState<Technician[]>(INITIAL_TECHNICIANS);
  const [published, setPublished] = useState<PublishedModule[]>(INITIAL_PUBLISHED);
  const [focusTechId, setFocusTechId] = useState<string | null>(params.get('tech'));
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const activeModules = BASE_ACTIVE_MODULES + (published.length - INITIAL_PUBLISHED.length);
  const highRisk = useMemo(() => technicians.filter((t) => riskOf(t) === 'Alto').length, [technicians]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const updateTech = (id: string, fn: (t: Technician) => Technician) =>
    setTechnicians((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  const simulate = (id: string) => updateTech(id, simulateDeferredExam);

  const activateExam = (id: string) => {
    const t = technicians.find((x) => x.id === id);
    updateTech(id, activateReinforcement);
    if (t) showToast(`Examen de refuerzo activado solo para ${t.name}`);
  };
  const applyExam = (id: string) => updateTech(id, applyReinforcementExam);
  const cancelExam = (id: string) => updateTech(id, cancelReinforcement);

  const publish = (m: PublishedModule) => {
    setPublished((p) => [m, ...p]);
    showToast(`${m.code} publicado en App Móvil y Visor AR`);
  };

  const openTechnician = (id: string) => {
    setFocusTechId(id);
    setView('tecnicos');
  };

  const login = (s: Session) => {
    saveSession(s);
    setSession(s);
  };
  const logout = () => {
    saveSession(null);
    setSession(null);
    setMenuOpen(false);
    setFocusTechId(null);
  };

  if (!session) return <LoginView onLogin={login} />;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        view={view}
        onChange={setView}
        activeModules={activeModules}
        alerts={highRisk}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-base-700 bg-base-950/85 px-4 py-3 backdrop-blur sm:gap-4 lg:px-8">
          <button onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-base-800 lg:hidden" aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input placeholder="Buscar técnico, unidad, código SBOM…" className="input bg-base-900 pl-9" />
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-400 sm:gap-3">
            <span className="hidden items-center gap-1.5 xl:flex">
              <CalendarDays size={14} /> Flota MX — 4 depósitos
            </span>
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-base-800"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="relative rounded-lg p-2 hover:bg-base-800" aria-label="Notificaciones">
              <Bell size={16} />
              {highRisk > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />}
            </button>
            <div ref={menuRef} className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-base-800 sm:pr-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-petrol-700 text-xs font-semibold text-white">{initialsOf(session.name)}</span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-slate-200">{session.name}</span>
                  <span className="block text-[11px] text-slate-500">{session.role}</span>
                </span>
                <ChevronDown size={14} className="hidden sm:block" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 animate-fade-up rounded-xl border border-base-600 bg-base-900 p-1.5 shadow-2xl">
                  <div className="border-b border-base-700 px-3 py-2.5">
                    <p className="text-sm text-slate-100">{session.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{session.email}</p>
                  </div>
                  {session.role === 'Supervisor' && (
                    <button
                      onClick={() => {
                        setAccessOpen(true);
                        setMenuOpen(false);
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-base-800"
                    >
                      <ShieldCheck size={15} className="text-emerald-400" /> Autorizar accesos
                    </button>
                  )}
                  <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400">
                    <LogOut size={15} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main key={view} className="animate-fade-up px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {view === 'resumen' && <ExecutiveView technicians={technicians} onOpenTechnician={openTechnician} />}
          {view === 'tecnicos' && (
            <TechniciansView
              technicians={technicians}
              onSimulate={simulate}
              onActivateExam={activateExam}
              onApplyExam={applyExam}
              onCancelExam={cancelExam}
              focusId={focusTechId}
              onFocusChange={setFocusTechId}
            />
          )}
          {view === 'ingesta' && <IngestionView published={published} onPublish={publish} activeModules={activeModules} />}
          {view === 'auditoria' && <AuditView onOpenTechnician={openTechnician} />}
        </main>
      </div>

      {accessOpen && <AccessModal session={session} onClose={() => setAccessOpen(false)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-fade-up rounded-lg border border-emerald-500/40 bg-base-900 px-4 py-3 text-center text-sm text-emerald-300 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
