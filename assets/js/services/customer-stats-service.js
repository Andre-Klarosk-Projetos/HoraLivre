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

function buildAppointmentCreatePayload(data = {}) {
  return {
    tenantId: normalizeString(data.tenantId),
    customerId: normalizeString(data.customerId),
    customerName: normalizeString(data.customerName),
    serviceId: normalizeString(data.serviceId),
    serviceName: normalizeString(data.serviceName),
    status: normalizeStatus(data.status, 'pending'),
    startAt: normalizeString(data.startAt),
    endAt: normalizeString(data.endAt),
    price: normalizeNumber(data.price, 0),
    source: normalizeString(data.source),
    notes: normalizeString(data.notes),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildAppointmentUpdatePayload(data = {}) {
  const payload = {
    updatedAt: new Date().toISOString()
  };

  if ('customerId' in data) {
    payload.customerId = data.customerId ? normalizeString(data.customerId) : null;
  }

  if ('customerName' in data) {
    payload.customerName = normalizeString(data.customerName);
  }

  if ('serviceId' in data) {
    payload.serviceId = data.serviceId ? normalizeString(data.serviceId) : null;
  }

  if ('serviceName' in data) {
    payload.serviceName = normalizeString(data.serviceName);
  }

  if ('startAt' in data) {
    payload.startAt = normalizeString(data.startAt);
  }

  if ('endAt' in data) {
    payload.endAt = normalizeString(data.endAt);
  }

  if ('price' in data) {
    payload.price = normalizeNumber(data.price, 0);
  }

  if ('status' in data) {
    payload.status = normalizeStatus(data.status, 'pending');
  }

  if ('source' in data) {
    payload.source = normalizeString(data.source);
  }

  if ('notes' in data) {
    payload.notes = normalizeString(data.notes);
  }

  return payload;
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

export async function listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso) {
  if (!tenantId) {
    return [];
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('startAt', 'desc')
  );

  const snapshot = await getDocs(appointmentsQuery);
  const appointments = snapshot.docs.map(mapAppointmentDocument);

  return appointments.filter((appointment) => {
    const startAt = String(appointment.startAt || '').trim();

    if (!startAt) {
      return false;
    }

    if (startIso && startAt < startIso) {
      return false;
    }

    if (endIso && startAt > endIso) {
      return false;
    }

    return true;
  });
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

export async function getAppointmentById(appointmentId) {
  if (!appointmentId) {
    return null;
  }

  const reference = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return mapAppointmentDocument(snapshot);
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
  const payload = buildAppointmentCreatePayload(data);
  return addDoc(collection(db, APPOINTMENTS_COLLECTION), payload);
}

export async function updateAppointment(appointmentId, data = {}) {
  if (!appointmentId) {
    throw new Error('Agendamento inválido para atualização.');
  }

  const payload = buildAppointmentUpdatePayload(data);

  await updateDoc(doc(db, APPOINTMENTS_COLLECTION, appointmentId), payload);
}

export async function updateAppointmentStatus(appointmentId, status) {
  if (!appointmentId) {
    throw new Error('Agendamento inválido para atualização de status.');
  }

  await updateDoc(doc(db, APPOINTMENTS_COLLECTION, appointmentId), {
    status: normalizeStatus(status, 'pending'),
    updatedAt: new Date().toISOString()
  });
}