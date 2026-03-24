import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function buildServiceCreatePayload(data = {}) {
  return {
    tenantId: normalizeString(data.tenantId),
    name: normalizeString(data.name),
    description: normalizeString(data.description),
    durationMinutes: normalizeNumber(data.durationMinutes, 0),
    price: normalizeNumber(data.price, 0),
    isActive: normalizeBoolean(data.isActive, true),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildServiceUpdatePayload(data = {}) {
  const payload = {};

  if ('tenantId' in data) {
    payload.tenantId = normalizeString(data.tenantId);
  }

  if ('name' in data) {
    payload.name = normalizeString(data.name);
  }

  if ('description' in data) {
    payload.description = normalizeString(data.description);
  }

  if ('durationMinutes' in data) {
    payload.durationMinutes = normalizeNumber(data.durationMinutes, 0);
  }

  if ('price' in data) {
    payload.price = normalizeNumber(data.price, 0);
  }

  if ('isActive' in data) {
    payload.isActive = normalizeBoolean(data.isActive, true);
  }

  payload.updatedAt = new Date().toISOString();

  return payload;
}

export async function listServicesByTenant(tenantId) {
  const servicesQuery = query(
    collection(db, 'services'),
    where('tenantId', '==', tenantId),
    orderBy('name')
  );

  const snapshot = await getDocs(servicesQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listActiveServicesByTenant(tenantId) {
  const servicesQuery = query(
    collection(db, 'services'),
    where('tenantId', '==', tenantId),
    where('isActive', '==', true),
    orderBy('name')
  );

  const snapshot = await getDocs(servicesQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function createService(data) {
  const payload = buildServiceCreatePayload(data);

  return addDoc(collection(db, 'services'), payload);
}

export async function updateService(serviceId, data) {
  const reference = doc(db, 'services', serviceId);
  const payload = buildServiceUpdatePayload(data);

  await updateDoc(reference, payload);
}

export async function toggleServiceActive(serviceId, isActive) {
  const reference = doc(db, 'services', serviceId);

  await updateDoc(reference, {
    isActive: Boolean(isActive),
    updatedAt: new Date().toISOString()
  });
}

export async function deleteService(serviceId) {
  const reference = doc(db, 'services', serviceId);
  await deleteDoc(reference);
}
