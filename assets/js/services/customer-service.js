import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

const CUSTOMERS_COLLECTION = 'customers';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function mapCustomerDocument(documentItem) {
  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function listCustomersByTenant(tenantId) {
  if (!tenantId) {
    return [];
  }

  const customersQuery = query(
    collection(db, CUSTOMERS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map(mapCustomerDocument);
}

export async function listRecentCustomersByTenant(tenantId, maxResults = 5) {
  if (!tenantId) {
    return [];
  }

  const customersQuery = query(
    collection(db, CUSTOMERS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map(mapCustomerDocument);
}

export async function createCustomer(data = {}) {
  const payload = {
    tenantId: normalizeString(data.tenantId),
    name: normalizeString(data.name),
    email: normalizeString(data.email),
    whatsapp: normalizeString(data.whatsapp),
    notes: normalizeString(data.notes),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return addDoc(collection(db, CUSTOMERS_COLLECTION), payload);
}