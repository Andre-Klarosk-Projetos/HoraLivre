import {
  addDoc,
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
  const tenantsQuery = query(
    collection(db, 'tenants'),
    orderBy('businessName')
  );

  const snapshot = await getDocs(tenantsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getTenantById(tenantId) {
  if (!tenantId) {
    return null;
  }

  const reference = doc(db, 'tenants', tenantId);
  const snapshot = await getDoc(reference);

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

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function createTenant(data) {
  return addDoc(collection(db, 'tenants'), {
    businessName: data.businessName || '',
    slug: data.slug || '',
    whatsapp: data.whatsapp || '',
    description: data.description || '',
    logoUrl: data.logoUrl || '',
    instagram: data.instagram || '',
    address: data.address || '',
    planId: data.planId || '',
    billingMode: data.billingMode || 'free',
    fixedMonthlyPrice: Number(data.fixedMonthlyPrice || 0),
    annualPrice: Number(data.annualPrice || 0),
    pricePerExecutedService: Number(data.pricePerExecutedService || 0),
    subscriptionStatus: data.subscriptionStatus || 'trial',
    publicPageEnabled: data.publicPageEnabled !== false,
    reportsEnabled: data.reportsEnabled !== false,
    trialEndsAt: data.trialEndsAt || null,
    isBlocked: data.isBlocked === true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function updateTenant(tenantId, data) {
  const reference = doc(db, 'tenants', tenantId);

  await updateDoc(reference, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}