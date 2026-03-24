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

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const session = await resolveUserProfile(credential.user.uid, credential.user.email);
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

export async function resolveUserProfile(uid, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const adminReference = doc(db, 'platformAdmins', uid);
  const adminSnapshot = await getDoc(adminReference);

  if (adminSnapshot.exists()) {
    return {
      uid,
      email: normalizedEmail,
      role: 'admin',
      tenantId: null
    };
  }

  const tenantUserReference = doc(db, 'tenantUsers', uid);
  const tenantUserSnapshot = await getDoc(tenantUserReference);

  if (tenantUserSnapshot.exists()) {
    const tenantUser = tenantUserSnapshot.data();

    return {
      uid,
      email: normalizedEmail,
      role: 'tenant',
      tenantId: tenantUser.tenantId
    };
  }

  throw new Error('Usuário autenticado, mas sem perfil configurado na plataforma.');
}