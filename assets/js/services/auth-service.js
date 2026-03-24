import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { auth, db } from '../config/firebase-init.js';
import { setSession, clearSession } from '../state/session-store.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildAdminSession(uid, email) {
  return {
    uid,
    email: normalizeEmail(email),
    role: 'admin',
    tenantId: null
  };
}

function buildTenantSession(uid, email, tenantId) {
  return {
    uid,
    email: normalizeEmail(email),
    role: 'tenant',
    tenantId: tenantId || null
  };
}

async function findPlatformAdminByUid(uid) {
  if (!uid) {
    return null;
  }

  const reference = doc(db, 'platformAdmins', uid);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

async function findTenantUserByUid(uid) {
  if (!uid) {
    return null;
  }

  const reference = doc(db, 'tenantUsers', uid);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function resolveUserProfile(uid, email) {
  const normalizedEmail = normalizeEmail(email);

  try {
    const adminByUid = await findPlatformAdminByUid(uid);

    if (adminByUid) {
      return buildAdminSession(uid, normalizedEmail);
    }
  } catch (error) {
    console.error('Falha ao verificar platformAdmins por UID.', error);
  }

  try {
    const tenantUser = await findTenantUserByUid(uid);

    if (tenantUser) {
      if (!tenantUser.tenantId) {
        throw new Error('Usuário do tenant sem tenantId configurado.');
      }

      return buildTenantSession(uid, normalizedEmail, tenantUser.tenantId);
    }
  } catch (error) {
    console.error('Falha ao verificar tenantUsers por UID.', error);
    throw error;
  }

  throw new Error('Usuário autenticado, mas sem perfil configurado na plataforma.');
}

export async function loginWithEmail(email, password) {
  const normalizedEmail = normalizeEmail(email);

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  const session = await resolveUserProfile(
    credential.user.uid,
    credential.user.email || normalizedEmail
  );

  setSession(session);

  return session;
}

export async function logoutUser() {
  await signOut(auth);
  clearSession();
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
