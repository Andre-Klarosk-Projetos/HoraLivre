import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

const CUSTOMERS_COLLECTION = 'customers';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNullableString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).trim();
}

function resolvePhone(data = {}) {
  return normalizeString(data.phone || data.whatsapp);
}

function mapCustomerDocument(documentItem) {
  const data = documentItem.data();

  return {
    id: documentItem.id,
    ...data,
    phone: data.phone || data.whatsapp || '',
    whatsapp: data.whatsapp || data.phone || '',
    totalAppointments: normalizeNumber(data.totalAppointments, 0),
    totalSpent: normalizeNumber(data.totalSpent, 0),
    lastAppointmentAt: data.lastAppointmentAt || null
  };
}

function buildCustomerCreatePayload(data = {}) {
  const phone = resolvePhone(data);

  return {
    tenantId: normalizeString(data.tenantId),
    name: normalizeString(data.name),
    email: normalizeString(data.email),
    phone,
    whatsapp: phone,
    notes: normalizeString(data.notes),
    totalAppointments: normalizeNumber(data.totalAppointments, 0),
    totalSpent: normalizeNumber(data.totalSpent, 0),
    lastAppointmentAt: normalizeNullableString(data.lastAppointmentAt),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildCustomerUpdatePayload(data = {}) {
  const payload = {
    updatedAt: new Date().toISOString()
  };

  if ('name' in data) {
    payload.name = normalizeString(data.name);
  }

  if ('email' in data) {
    payload.email = normalizeString(data.email);
  }

  if ('notes' in data) {
    payload.notes = normalizeString(data.notes);
  }

  if ('phone' in data || 'whatsapp' in data) {
    const phone = resolvePhone(data);
    payload.phone = phone;
    payload.whatsapp = phone;
  }

  if ('totalAppointments' in data) {
    payload.totalAppointments = normalizeNumber(data.totalAppointments, 0);
  }

  if ('totalSpent' in data) {
    payload.totalSpent = normalizeNumber(data.totalSpent, 0);
  }

  if ('lastAppointmentAt' in data) {
    payload.lastAppointmentAt = normalizeNullableString(data.lastAppointmentAt);
  }

  return payload;
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
  const payload = buildCustomerCreatePayload(data);
  return addDoc(collection(db, CUSTOMERS_COLLECTION), payload);
}

export async function updateCustomer(customerId, data = {}) {
  if (!customerId) {
    throw new Error('Cliente inválido para atualização.');
  }

  const payload = buildCustomerUpdatePayload(data);

  await updateDoc(doc(db, CUSTOMERS_COLLECTION, customerId), payload);
}

export async function deleteCustomer(customerId) {
  if (!customerId) {
    throw new Error('Cliente inválido para exclusão.');
  }

  await deleteDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
}