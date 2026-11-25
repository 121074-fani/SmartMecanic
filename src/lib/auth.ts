/**
 * Fachada de compatibilidad: la lógica vive en `src/services/authService.ts`.
 * Se mantiene este módulo para no tocar las vistas que ya lo importan (LoginView, AccessModal).
 */
export {
  DEMO_PASSWORD,
  isValidEmail,
  loadRequests,
  loadSession,
  loadUsers,
  normalize,
  saveRequests,
  saveSession,
  saveUsers,
  today,
  type AccessRequest,
  type AuthorizedUser,
  type Role,
  type Session,
} from '../services/authService';
