/* =========================================================
   Puente de sesión con el login unificado (Portal Gerencial)
   ---------------------------------------------------------
   Se carga ANTES que app.js. Lee la sesión del técnico que escribe el login
   de `/?app=tecnico` y la expone en `window.FA_AUTH`.
   - Sin sesión válida → redirige al login unificado.
   - Abierta sola (file:// o servidor propio sin el portal) → modo local sin login.
   Las claves deben coincidir con HUB_KEYS de src/services/hubClient.ts.
   ========================================================= */
(function () {
  'use strict';
  var KEYS = { session: 'fa-session-tecnico', hub: 'fa-hub' };
  var CHANNEL = 'fa-hub';

  function read(k) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  var hub = read(KEYS.hub);
  // Integrada con el portal: el portal ya anunció su login o la app se sirve bajo /tecnicos-del-manana/
  var integrated = location.protocol !== 'file:' && (!!hub || /\/tecnicos-del-manana\//.test(location.pathname));
  var loginUrl = (hub && hub.loginUrl) || location.origin + '/?app=tecnico';

  // login abierto (demo): basta una sesión de técnico vigente, con cualquier usuario
  function isAuthorized(s) {
    if (!s || !s.email || s.role !== 'Técnico') return false;
    return !(s.expiresAt && s.expiresAt < Date.now());
  }

  function toLogin() {
    document.documentElement.style.visibility = 'hidden'; // evita ver la app un instante antes de salir
    location.replace(loginUrl);
  }

  var session = read(KEYS.session);
  if (!isAuthorized(session)) session = null;

  function logout() {
    var prev = read(KEYS.session);
    try { localStorage.removeItem(KEYS.session); } catch (e) { /* sin almacenamiento */ }
    try { if (typeof BroadcastChannel !== 'undefined') { var ch = new BroadcastChannel(CHANNEL); ch.postMessage({ topic: 'session', at: Date.now() }); ch.close(); } } catch (e) { /* sin canal */ }
    if (prev && prev.token) {
      try {
        fetch('/api/auth/logout', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: prev.token }) }).catch(function () {});
      } catch (e) { /* sin API */ }
    }
    toLogin();
  }

  window.FA_AUTH = { integrated: integrated, session: session, loginUrl: loginUrl, logout: logout };

  if (integrated && !session) { toLogin(); return; }

  // Si la sesión se cierra en otra pestaña, esta también sale.
  window.addEventListener('storage', function (e) {
    if (!integrated) return;
    if (e.key === KEYS.session || e.key === null) {
      if (!isAuthorized(read(KEYS.session))) toLogin();
    }
  });
})();
