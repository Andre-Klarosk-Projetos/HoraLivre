const SESSION_KEY = 'horalivre_session';

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getTenantId() {
  return getSession()?.tenantId || null;
}

export function isAdmin() {
  return getSession()?.role === 'admin';
}

export function isTenantUser() {
  return getSession()?.role === 'tenant';
}
