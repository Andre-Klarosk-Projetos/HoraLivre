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

const APPOINTMENTS_COLLECTION = 'appointments';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value, fallback = 'pending') {
  return normalizeString(value, fallback) || fallback;
}

function mapAppointmentDocument(documentItem) {
  return {
    id: documentItem.id,
    ...documentItem.data()
  };
}

export async function listAppointmentsByTenant(tenantId) {
  if (!tenantId) {
    return [];
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('startAt', 'desc')
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map(mapAppointmentDocument);
}

export async function listRecentAppointmentsByTenant(tenantId, maxResults = 5) {
  if (!tenantId) {
    return [];
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('startAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map(mapAppointmentDocument);
}

export async function listAppointmentsByCustomer(customerId) {
  if (!customerId) {
    return [];
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('customerId', '==', customerId),
    orderBy('startAt', 'desc')
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map(mapAppointmentDocument);
}

export async function countCompletedAppointmentsByTenant(tenantId) {
  if (!tenantId) {
    return 0;
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    where('status', '==', 'completed')
  );

  const snapshot = await getDocs(appointmentsQuery);
  return snapshot.size;
}

export async function createAppointment(data = {}) {
  const payload = {
    tenantId: normalizeString(data.tenantId),
    customerId: normalizeString(data.customerId),
    customerName: normalizeString(data.customerName),
    serviceName: normalizeString(data.serviceName),
    status: normalizeStatus(data.status, 'pending'),
    startAt: normalizeString(data.startAt),
    endAt: normalizeString(data.endAt),
    price: normalizeNumber(data.price, 0),
    notes: normalizeString(data.notes),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return addDoc(collection(db, APPOINTMENTS_COLLECTION), payload);
}