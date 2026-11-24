import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, ShieldCheck, Trash2, UserCheck, X } from 'lucide-react';
import {
  isValidEmail,
  loadRequests,
  loadUsers,
  normalize,
  saveRequests,
  saveUsers,
  today,
  type AccessRequest,
  type AuthorizedUser,
  type Role,
  type Session,
} from '../lib/auth';

/** Panel del supervisor: autoriza solicitudes, agrega o revoca correos. */
export default function AccessModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [users, setUsers] = useState<AuthorizedUser[]>(loadUsers);
  const [requests, setRequests] = useState<AccessRequest[]>(loadRequests);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Gerente');
  const [err, setErr] = useState('');

  useEffect(() => saveUsers(users), [users]);
  useEffect(() => saveRequests(requests), [requests]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const authorize = (em: string, r: Role = 'Gerente') => {
    const e = normalize(em);
    if (users.some((u) => u.email === e)) return;
    const name = e.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    setUsers((u) => [...u, { email: e, name, role: r, authorizedBy: session.email, date: today() }]);
    setRequests((q) => q.filter((x) => x.email !== e));
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return setErr('Correo no válido.');
    if (users.some((u) => u.email === normalize(email))) return setErr('Ese correo ya está autorizado.');
    authorize(email, role);
    setEmail('');
    setErr('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-base-950/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl animate-fade-up flex-col rounded-t-2xl border border-base-600 bg-base-900 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-base-700 px-5 py-4">
          <ShieldCheck size={18} className="text-emerald-400" />
          <div className="flex-1">
            <h2 className="font-semibold text-fg">Autorización de accesos</h2>
            <p className="text-xs text-slate-400">Solo los correos autorizados por un supervisor pueden iniciar sesión.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-base-800 hover:text-fg" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Solicitudes pendientes ({requests.length})</h3>
            {requests.length === 0 ? (
              <p className="rounded-lg border border-dashed border-base-600 p-3 text-center text-xs text-slate-500">Sin solicitudes pendientes.</p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.email} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-slate-200">{r.email}</p>
                      <p className="text-[11px] text-slate-500">Solicitado el {r.date}</p>
                    </div>
                    <button onClick={() => authorize(r.email)} className="btn-primary px-3 py-1.5 text-xs">
                      <Check size={13} /> Autorizar
                    </button>
                    <button onClick={() => setRequests((q) => q.filter((x) => x.email !== r.email))} className="btn-ghost px-3 py-1.5 text-xs">
                      Rechazar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Autorizar nuevo correo</h3>
            <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@fleetacademy.mx" className="input flex-1" />
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input sm:w-36">
                <option>Gerente</option>
                <option>Supervisor</option>
              </select>
              <button className="btn-primary">
                <Plus size={15} /> Agregar
              </button>
            </form>
            {err && <p className="mt-1.5 text-xs text-amber-400">{err}</p>}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Correos autorizados ({users.length})</h3>
            <ul className="divide-y divide-base-700 rounded-lg border border-base-700">
              {users.map((u) => (
                <li key={u.email} className="flex items-center gap-3 px-3 py-2.5">
                  <UserCheck size={16} className="shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">{u.email}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {u.role} · autorizado por {u.authorizedBy} · {u.date}
                    </p>
                  </div>
                  {u.email === session.email ? (
                    <span className="chip border-petrol-500/30 bg-petrol-500/10 text-petrol-300">Tú</span>
                  ) : (
                    <button
                      onClick={() => setUsers((list) => list.filter((x) => x.email !== u.email))}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Revocar ${u.email}`}
                      title="Revocar acceso"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
