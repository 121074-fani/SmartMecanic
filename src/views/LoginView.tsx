import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, Bus, CheckCircle2, Eye, EyeOff, KeyRound, LayoutDashboard, Moon, Sun, User, Wrench, Zap } from 'lucide-react';
import { loadUsers, normalize, type Session } from '../lib/auth';
import { useTheme } from '../lib/theme';

type Notice = { kind: 'error'; text: string } | null;

/** Los dos menús a los que da acceso el login único. */
export type Portal = 'tecnico' | 'supervision';

const PORTALS: Record<Portal, { label: string; hint: string; icon: typeof Wrench }> = {
  tecnico: { label: 'Técnico', hint: 'Entrenamiento, práctica en 3D y evaluaciones.', icon: Wrench },
  supervision: { label: 'Supervisor', hint: 'Portal gerencial: equipo, retención e ingesta de manuales.', icon: LayoutDashboard },
};

/** "ana.lopez@x.mx" → "Ana Lopez" */
const nameFrom = (id: string) =>
  id
    .split('@')[0]
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ') || 'Usuario';

export default function LoginView({ onLogin, defaultPortal = 'supervision' }: { onLogin: (s: Session) => void; defaultPortal?: Portal }) {
  const { theme, toggle } = useTheme();
  const [portal, setPortal] = useState<Portal>(defaultPortal);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);

  /** Demo abierta: cualquier usuario y contraseña; la opción elegida decide a qué pantalla se entra. */
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = normalize(email);
    if (!id || !password) return setNotice({ kind: 'error', text: 'Escribe tu usuario y tu contraseña.' });
    const known = loadUsers().find((u) => u.email === id);
    const role: Session['role'] = portal === 'tecnico' ? 'Técnico' : known && known.role !== 'Técnico' ? known.role : 'Supervisor';
    setLoading(true);
    window.setTimeout(() => onLogin({ email: id, name: known?.name ?? nameFrom(id), role }), 400);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="nav-navy nav-gradient relative hidden flex-col justify-between overflow-hidden border-r border-base-700 bg-base-900 p-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-petrol-500 to-petrol-700 shadow-lg shadow-petrol-900/40">
            <Bus size={22} className="text-white" />
            <Zap size={13} className="absolute -right-1 -top-1 rounded-full bg-amber-500 p-0.5 text-slate-950" />
          </div>
          <div>
            <p className="font-semibold text-fg">Fleet Academy</p>
            <p className="text-xs text-slate-400">Portal Gerencial</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-petrol-400">Capacitación técnica modular</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-fg">
            Retención, certificación en alto voltaje y soporte en ruta, en un solo tablero.
          </h1>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            {['Analítica predictiva de retención R(t) = e^(−t/S)', 'Ingesta de manuales con IA + RAG y SBOM', 'Auditoría del copiloto de diagnóstico visual'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="hazard-stripe h-1.5 w-full rounded-full" />
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <button onClick={toggle} className="btn-ghost absolute right-4 top-4 px-2.5" aria-label="Cambiar tema">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-petrol-500 to-petrol-700">
              <Bus size={20} className="text-white" />
            </div>
            <p className="font-semibold text-fg">Fleet Academy</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-fg">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-400">Elige a qué menú quieres entrar.</p>

          <div role="tablist" aria-label="Tipo de acceso" className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-base-600 bg-base-900 p-1">
            {(Object.keys(PORTALS) as Portal[]).map((p) => {
              const { label, icon: Icon } = PORTALS[p];
              const active = portal === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setPortal(p);
                    setNotice(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-petrol-600 text-white shadow' : 'text-slate-400 hover:bg-base-800 hover:text-slate-200'
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">{PORTALS[portal].hint}</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Usuario o correo</span>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNotice(null);
                  }}
                  placeholder="tu usuario"
                  className="input pl-9"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Contraseña</span>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setNotice(null);
                  }}
                  placeholder="••••••••"
                  className="input pl-9 pr-10"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300" aria-label="Mostrar contraseña">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {notice && (
              <p className="flex animate-fade-up items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {notice.text}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Entrando…' : `Entrar como ${PORTALS[portal].label.toLowerCase()}`} <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-500">Demo: funciona con cualquier usuario y contraseña.</p>
        </div>
      </div>
    </div>
  );
}
