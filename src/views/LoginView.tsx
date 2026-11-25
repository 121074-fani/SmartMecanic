import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowRight, Bus, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, Moon, ShieldCheck, Sun, Zap } from 'lucide-react';
import {
  DEMO_PASSWORD,
  isValidEmail,
  loadRequests,
  loadUsers,
  normalize,
  saveRequests,
  today,
  type Session,
} from '../lib/auth';
import { useTheme } from '../lib/theme';

type Notice = { kind: 'error' | 'unauthorized' | 'requested'; text: string } | null;

export default function LoginView({ onLogin }: { onLogin: (s: Session) => void }) {
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const em = normalize(email);
    if (!isValidEmail(em)) return setNotice({ kind: 'error', text: 'Escribe un correo electrónico válido.' });
    const user = loadUsers().find((u) => u.email === em);
    if (!user) {
      const pending = loadRequests().some((r) => r.email === em);
      return setNotice({
        kind: pending ? 'requested' : 'unauthorized',
        text: pending
          ? 'Tu solicitud de acceso ya está pendiente de autorización por un supervisor.'
          : 'Este correo no cuenta con autorización de supervisor para acceder al portal.',
      });
    }
    if (password !== DEMO_PASSWORD) return setNotice({ kind: 'error', text: 'Contraseña incorrecta.' });
    setLoading(true);
    window.setTimeout(() => onLogin({ email: user.email, name: user.name, role: user.role }), 500);
  };

  const requestAccess = () => {
    const em = normalize(email);
    const reqs = loadRequests();
    if (!reqs.some((r) => r.email === em)) saveRequests([{ email: em, date: today() }, ...reqs]);
    setNotice({ kind: 'requested', text: 'Solicitud enviada. Un supervisor debe autorizar tu correo antes de que puedas entrar.' });
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
          <p className="mt-1 text-sm text-slate-400">Acceso restringido a correos autorizados por un supervisor.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Correo corporativo</span>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNotice(null);
                  }}
                  placeholder="nombre@fleetacademy.mx"
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
              <div
                className={`animate-fade-up rounded-lg border p-3 text-xs ${
                  notice.kind === 'requested' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                <p className="flex items-start gap-2">
                  {notice.kind === 'requested' ? <ShieldCheck size={14} className="mt-0.5 shrink-0" /> : notice.kind === 'unauthorized' ? <Lock size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                  {notice.text}
                </p>
                {notice.kind === 'unauthorized' && (
                  <button type="button" onClick={requestAccess} className="mt-2 font-semibold underline underline-offset-2 hover:no-underline">
                    Solicitar autorización al supervisor
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Verificando…' : 'Entrar'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-dashed border-base-600 p-3 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-300">Credenciales de la demo</p>
            <p className="mt-1 font-mono">supervisor@fleetacademy.mx</p>
            <p className="font-mono">gerencia@fleetacademy.mx</p>
            <p className="mt-1">
              Contraseña: <span className="font-mono text-slate-200">{DEMO_PASSWORD}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
