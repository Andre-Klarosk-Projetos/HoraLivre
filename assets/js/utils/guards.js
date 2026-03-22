import { getSession, isAdmin, isTenantUser } from '../state/session-store.js';

export function requireAuth() {
  const session = getSession();

  if (!session) {
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

export function requireAdmin() {
  const session = getSession();

  if (!session) {
    window.location.href = 'login.html';
    return false;
  }

  if (!isAdmin()) {
    window.location.href = 'cliente.html';
    return false;
  }

  return true;
}

export function requireTenantUser() {
  const session = getSession();

  if (!session) {
    window.location.href = 'login.html';
    return false;
  }

  if (!isTenantUser()) {
    window.location.href = 'admin.html';
    return false;
  }

  return true;
}