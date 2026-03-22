import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { auth, db } from '../config/firebase-init.js';
import { setSession, clearSession } from '../state/session-store.js';

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);

  console.log('HoraLivre login autenticado com sucesso.');
  console.log('UID autenticado:', credential.user.uid);
  console.log('E-mail autenticado:', credential.user.email);
  console.log('Projeto Firebase em uso:', auth.app.options.projectId);

  const session = await resolveUserProfile(
    credential.user.uid,
    credential.user.email
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

export async function resolveUserProfile(uid, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  console.log('Tentando localizar admin por UID em:', `platformAdmins/${uid}`);

  const adminReference = doc(db, 'platformAdmins', uid);
  const adminSnapshot = await getDoc(adminReference);

  console.log('Admin encontrado por UID?', adminSnapshot.exists());

  if (adminSnapshot.exists()) {
    console.log('Documento admin por UID:', adminSnapshot.data());

    return {
      uid,
      email: normalizedEmail,
      role: 'admin',
      tenantId: null
    };
  }

  console.log('Tentando localizar admin por e-mail em platformAdmins...');

  const platformAdminsReference = collection(db, 'platformAdmins');
  const adminByEmailQuery = query(
    platformAdminsReference,
    where('email', '==', normalizedEmail),
    limit(1)
  );

  const adminByEmailSnapshot = await getDocs(adminByEmailQuery);

  console.log('Admin encontrado por e-mail?', !adminByEmailSnapshot.empty);

  if (!adminByEmailSnapshot.empty) {
    const adminData = adminByEmailSnapshot.docs[0].data();

    console.log('Documento admin por e-mail:', adminData);

    return {
      uid,
      email: normalizedEmail,
      role: 'admin',
      tenantId: null
    };
  }

  console.log('Tentando localizar tenant user por UID em:', `tenantUsers/${uid}`);

  const tenantUserReference = doc(db, 'tenantUsers', uid);
  const tenantUserSnapshot = await getDoc(tenantUserReference);

  console.log('Tenant user encontrado por UID?', tenantUserSnapshot.exists());

  if (tenantUserSnapshot.exists()) {
    const tenantUser = tenantUserSnapshot.data();

    console.log('Documento tenant user:', tenantUser);

    return {
      uid,
      email: normalizedEmail,
      role: 'tenant',
      tenantId: tenantUser.tenantId
    };
  }

  throw new Error('Usuário autenticado, mas sem perfil configurado na plataforma.');
}