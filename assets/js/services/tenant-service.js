import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listTenants() {
  const tenantsQuery = query(collection(db, 'tenants'), orderBy('businessName'));
  const snapshot = await getDocs(tenantsQuery);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data()
  }));
}

export async function getTenantById(tenantId) {
  const ref = doc(db, 'tenants', tenantId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function getTenantBySlug(slug) {
  const tenantsQuery = query(
    collection(db, 'tenants'),
    where('slug', '==', slug),
    limit(1)
  );

  const snapshot = await getDocs(tenantsQuery);

  if (snapshot.empty) {
    return null;
  }

  const docItem = snapshot.docs[0];

  return {
    id: docItem.id,
    ...docItem.data()
  };
}

export async function updateTenant(tenantId, data) {
  const ref = doc(db, 'tenants', tenantId);

  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function setTenantBlocked(tenantId, isBlocked) {
  const ref = doc(db, 'tenants', tenantId);

  await updateDoc(ref, {
    isBlocked: Boolean(isBlocked),
    subscriptionStatus: isBlocked ? 'blocked' : 'active',
    updatedAt: new Date().toISOString()
  });
}

export async function setTenantSubscriptionStatus(tenantId, subscriptionStatus) {
  const ref = doc(db, 'tenants', tenantId);

  await updateDoc(ref, {
    subscriptionStatus,
    updatedAt: new Date().toISOString()
  });
}