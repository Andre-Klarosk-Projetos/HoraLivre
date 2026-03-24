import {
  addDoc,
  collection,
  deleteDoc,
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

const CUSTOMERS_COLLECTION = 'customers';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNullableString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildCustomerCreatePayload(data = {}) {
  const phone = normalizeString(data.phone);

  return {
    tenantId: normalizeString(data.tenantId),
    name: normalizeString(data.name),
    phone,
    phoneNormalized: normalizePhone(phone),
    email: normalizeString(data.email),
    notes: normalizeString(data.notes),
    totalAppointments: normalizeNumber(data.totalAppointments, 0),
    completedAppointments: normalizeNumber(data.completedAppointments, 0),
    lastAppointmentAt: normalizeNullableString(data.lastAppointmentAt),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildCustomerUpdatePayload(data = {}) {
  const payload = {};

  if ('tenantId' in data) {
    payload.tenantId = normalizeString(data.tenantId);
  }

  if ('name' in data) {
    payload.name = normalizeString(data.name);
  }

  if ('phone' in data) {
    const phone = normalizeString(data.phone);

    payload.phone = phone;
    payload.phoneNormalized = normalizePhone(phone);
  }

  if ('email' in data) {
    payload.email = normalizeString(data.email);
  }

  if ('notes' in data) {
    payload.notes = normalizeString(data.notes);
  }

  if ('totalAppointments' in data) {
    payload.totalAppointments = normalizeNumber(data.totalAppointments, 0);
  }

  if ('completedAppointments' in data) {
    payload.completedAppointments = normalizeNumber(data.completedAppointments, 0);
  }

  if ('lastAppointmentAt' in data) {
    payload.lastAppointmentAt = normalizeNullableString(data.lastAppointmentAt);
  }

  payload.updatedAt = new Date().toISOString();

  return payload;
}

function buildCustomerStatsPayload(stats = {}) {
  const payload = {};

  if ('totalAppointments' in stats) {
    payload.totalAppointments = normalizeNumber(stats.totalAppointments, 0);
  }

  if ('completedAppointments' in stats) {
    payload.completedAppointments = normalizeNumber(stats.completedAppointments, 0);
  }

  if ('lastAppointmentAt' in stats) {
    payload.lastAppointmentAt = normalizeNullableString(stats.lastAppointmentAt);
  }

  payload.updatedAt = new Date().toISOString();

  return payload;
}

export async function listTenantCustomers(tenantId) {
  if (!tenantId) {
    return [];
  }

  const customersQuery = query(
    collection(db, CUSTOMERS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('name')
  );

  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listTenantCustomersForSelect(tenantId) {
  return listTenantCustomers(tenantId);
}

export async function getTenantCustomerById(customerId) {
  if (!customerId) {
    return null;
  }

  const reference = doc(db, CUSTOMERS_COLLECTION, customerId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function findCustomerByPhone(tenantId, phone) {
  if (!tenantId || !phone) {
    return null;
  }

  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const customersQuery = query(
    collection(db, CUSTOMERS_COLLECTION),
    where('tenantId', '==', tenantId),
    where('phoneNormalized', '==', normalizedPhone),
    limit(1)
  );

  const snapshot = await getDocs(customersQuery);

  if (snapshot.empty) {
    return null;
  }

  const documentItem = snapshot.docs[0];

  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function createTenantCustomer(data) {
  const payload = buildCustomerCreatePayload(data);
  return addDoc(collection(db, CUSTOMERS_COLLECTION), payload);
}

export async function updateTenantCustomer(customerId, data) {
  if (!customerId) {
    throw new Error('Cliente inválido para atualização.');
  }

  const reference = doc(db, CUSTOMERS_COLLECTION, customerId);
  const payload = buildCustomerUpdatePayload(data);

  await updateDoc(reference, payload);
}

export async function deleteTenantCustomer(customerId) {
  if (!customerId) {
    throw new Error('Cliente inválido para exclusão.');
  }

  await deleteDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
}

export async function updateCustomerStats(customerId, stats = {}) {
  if (!customerId) {
    throw new Error('Cliente inválido para atualizar estatísticas.');
  }

  const reference = doc(db, CUSTOMERS_COLLECTION, customerId);
  const payload = buildCustomerStatsPayload(stats);

  await updateDoc(reference, payload);
}

export async function saveTenantCustomer(customerId, data) {
  if (customerId) {
    await updateTenantCustomer(customerId, data);
    return { id: customerId };
  }

  return createTenantCustomer(data);
}

/* aliases de compatibilidade */
export async function listCustomersByTenant(tenantId) {
  return listTenantCustomers(tenantId);
}

export async function listCustomersForSelect(tenantId) {
  return listTenantCustomersForSelect(tenantId);
}

export async function getCustomerById(customerId) {
  return getTenantCustomerById(customerId);
}

export async function createCustomer(data) {
  return createTenantCustomer(data);
}

export async function updateCustomer(customerId, data) {
  return updateTenantCustomer(customerId, data);
}

export async function deleteCustomer(customerId) {
  return deleteTenantCustomer(customerId);
}
