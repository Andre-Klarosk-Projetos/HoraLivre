const SESSION_KEY = 'horalivre_session';

function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalizeString(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeRole(value) {
  const normalized = normalizeString(value, '');

  if (normalized === 'admin') {
    return 'admin';
  }

  if (normalized === 'tenant') {
    return 'tenant';
  }

  return null;
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const normalized = {
    uid: normalizeString(session.uid),
    email: normalizeString(session.email),
    role: normalizeRole(session.role),
    tenantId: normalizeString(session.tenantId)
  };

  if (!normalized.uid || !normalized.role) {
    return null;
  }

  if (normalized.role === 'admin') {
    normalized.tenantId = null;
  }

  if (normalized.role === 'tenant' && !normalized.tenantId) {
    return null;
  }

  return normalized;
}

export function getSession() {
  if (!isBrowserEnvironment()) {
    return null;
  }

  const raw = localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeSession(parsed);

    if (!normalized) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return normalized;
  } catch (error) {
    console.error('Sessão inválida no armazenamento local.', error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(session) {
  if (!isBrowserEnvironment()) {
    return;
  }

  const normalized = normalizeSession(session);

  if (!normalized) {
    throw new Error('Sessão inválida para armazenamento.');
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
}

export function clearSession() {
  if (!isBrowserEnvironment()) {
    return;
  }

  localStorage.removeItem(SESSION_KEY);
}

export function hasSession() {
  return Boolean(getSession());
}

export function getSessionRole() {
  return getSession()?.role || null;
}

export function getSessionUid() {
  return getSession()?.uid || null;
}

export function getSessionEmail() {
  return getSession()?.email || null;
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
