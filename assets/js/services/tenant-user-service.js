import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listTenantUsersByTenant(tenantId) {
  const tenantUsersQuery = query(
    collection(db, 'tenantUsers'),
    where('tenantId', '==', tenantId)
  );

  const snapshot = await getDocs(tenantUsersQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getTenantUserByUid(uid) {
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

export async function createOrUpdateTenantUser(data) {
  const reference = doc(db, 'tenantUsers', data.uid);

  await setDoc(
    reference,
    {
      tenantId: data.tenantId,
      uid: data.uid,
      name: data.name,
      email: data.email,
      role: data.role || 'owner',
      createdAt: data.createdAt || new Date().toISOString()
    },
    { merge: true }
  );

  return {
    id: data.uid
  };
}