import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

import {
  deleteDoc,
  doc,
  getDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db, secondaryAuth } from '../config/firebase-init.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function mapAuthError(error) {
  const code = String(error?.code || '').trim();

  if (code === 'auth/email-already-in-use') {
    return new Error('Este e-mail já está em uso por outro usuário.');
  }

  if (code === 'auth/invalid-email') {
    return new Error('O e-mail informado é inválido.');
  }

  if (code === 'auth/weak-password') {
    return new Error('A senha é muito fraca. Use pelo menos 6 caracteres.');
  }

  return error instanceof Error
    ? error
    : new Error('Não foi possível criar o usuário do tenant.');
}

export async function createPendingTenantUserAccount({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const safePassword = String(password || '');

  if (!normalizedEmail) {
    throw new Error('E-mail do usuário do tenant é obrigatório.');
  }

  if (!safePassword) {
    throw new Error('Senha inicial do usuário do tenant é obrigatória.');
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      normalizedEmail,
      safePassword
    );

    return {
      uid: credential.user.uid,
      email: credential.user.email || normalizedEmail
    };
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function saveTenantUserProfile(uid, data = {}) {
  if (!uid) {
    throw new Error('UID do usuário do tenant é obrigatório.');
  }

  const payload = {
    uid,
    tenantId: normalizeString(data.tenantId),
    email: normalizeEmail(data.email),
    name: normalizeString(data.name || data.contactName || data.businessName),
    contactName: normalizeString(data.contactName),
    businessName: normalizeString(data.businessName),
    whatsapp: normalizeString(data.whatsapp),
    role: 'tenant',
    isActive: data.isActive !== false,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!payload.tenantId) {
    throw new Error('tenantId é obrigatório para salvar o perfil do tenant.');
  }

  await setDoc(doc(db, 'tenantUsers', uid), payload, { merge: true });

  return payload;
}

export async function getTenantUserProfile(uid) {
  if (!uid) {
    return null;
  }

  const snapshot = await getDoc(doc(db, 'tenantUsers', uid));

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function finalizePendingTenantUserAccount() {
  try {
    await signOut(secondaryAuth);
  } catch (error) {
    console.error('Falha ao encerrar secondaryAuth após criação do tenant.', error);
  }
}

export async function rollbackPendingTenantUserAccount(uid) {
  try {
    if (uid) {
      await deleteDoc(doc(db, 'tenantUsers', uid));
    }
  } catch (error) {
    console.error('Falha ao remover perfil tenantUsers no rollback.', error);
  }

  try {
    const currentUser = secondaryAuth.currentUser;

    if (currentUser && (!uid || currentUser.uid === uid)) {
      await deleteUser(currentUser);
    }
  } catch (error) {
    console.error('Falha ao remover usuário Auth no rollback.', error);
  }

  try {
    await signOut(secondaryAuth);
  } catch (error) {
    console.error('Falha ao encerrar secondaryAuth no rollback.', error);
  }
}
