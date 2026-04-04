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
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

const APPOINTMENTS_COLLECTION = 'appointments';
const BUSY_STATUSES = ['scheduled', 'confirmed', 'completed'];
const COMPLETED_STATUS = 'completed';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNullableString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value, fallback = 'scheduled') {
  const normalized = normalizeString(value, fallback);

  if (!normalized) {
    return fallback;
  }

  return normalized;
}

function normalizeSource(value, fallback = 'panel') {
  const normalized = normalizeString(value, fallback);

  if (!normalized) {
    return fallback;
  }

  return normalized;
}

function mapAppointmentDocument(documentItem) {
  return {
    id: documentItem.id,
    ...documentItem.data(),
  };
}

function buildAppointmentCreatePayload(data = {}) {
  return {
    tenantId: normalizeString(data.tenantId),
    customerId: normalizeNullableString(data.customerId),
    customerName: normalizeString(data.customerName),
    serviceId: normalizeNullableString(data.serviceId),
    serviceName: normalizeString(data.serviceName),
    startAt: normalizeString(data.startAt),
    endAt: normalizeString(data.endAt),
    price: normalizeNumber(data.price, 0),
    status: normalizeStatus(data.status, 'scheduled'),
    source: normalizeSource(data.source, 'panel'),
    notes: normalizeString(data.notes),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildAppointmentUpdatePayload(data = {}) {
  const payload = {};

  if ('tenantId' in data) {
    payload.tenantId = normalizeString(data.tenantId);
  }

  if ('customerId' in data) {
    payload.customerId = normalizeNullableString(data.customerId);
  }

  if ('customerName' in data) {
    payload.customerName = normalizeString(data.customerName);
  }

  if ('serviceId' in data) {
    payload.serviceId = normalizeNullableString(data.serviceId);
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
    payload.status = normalizeStatus(data.status, 'scheduled');
  }

  if ('source' in data) {
    payload.source = normalizeSource(data.source, 'panel');
  }

  if ('notes' in data) {
    payload.notes = normalizeString(data.notes);
  }

  payload.updatedAt = new Date().toISOString();

  return payload;
}

function isBusyStatus(status) {
  return BUSY_STATUSES.includes(status);
}

function isCompletedStatus(status) {
  return status === COMPLETED_STATUS;
}

export async function listAppointmentsByTenant(tenantId) {
  if (!tenantId) {
    return [];
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('startAt', 'asc'),
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map(mapAppointmentDocument);
}

export async function listRecentAppointmentsByTenant(tenantId, maxResults = 5) {
  if (!tenantId) {
    return [];
  }

  const safeLimit = Number.isFinite(Number(maxResults))
    ? Math.max(1, Number(maxResults))
    : 5;

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('startAt', 'desc'),
    limit(safeLimit),
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map(mapAppointmentDocument);
}

export async function listAppointmentsByTenantAndPeriod(
  tenantId,
  startIso,
  endIso,
) {
  if (!tenantId || !startIso || !endIso) {
    return [];
  }

  const appointmentsQuery = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    where('startAt', '>=', startIso),
    where('startAt', '<=', endIso),
    orderBy('startAt', 'asc'),
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
    orderBy('startAt', 'asc'),
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

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function listBusyAppointmentsByTenantAndDay(
  tenantId,
  startIso,
  endIso,
) {
  const appointments = await listAppointmentsByTenantAndPeriod(
    tenantId,
    startIso,
    endIso,
  );

  return appointments.filter((appointment) => isBusyStatus(appointment.status));
}

export async function createAppointment(data) {
  const payload = buildAppointmentCreatePayload(data);
  return addDoc(collection(db, APPOINTMENTS_COLLECTION), payload);
}

export async function updateAppointment(appointmentId, data) {
  if (!appointmentId) {
    throw new Error('Agendamento inválido para atualização.');
  }

  const reference = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
  const payload = buildAppointmentUpdatePayload(data);

  await updateDoc(reference, payload);
}

export async function updateAppointmentStatus(appointmentId, status) {
  if (!appointmentId) {
    throw new Error('Agendamento inválido para atualização de status.');
  }

  const reference = doc(db, APPOINTMENTS_COLLECTION, appointmentId);

  await updateDoc(reference, {
    status: normalizeStatus(status, 'scheduled'),
    updatedAt: new Date().toISOString(),
  });
}

export async function countCompletedAppointments(tenantId, startIso, endIso) {
  const appointments = await listAppointmentsByTenantAndPeriod(
    tenantId,
    startIso,
    endIso,
  );

  return appointments.filter((appointment) =>
    isCompletedStatus(appointment.status),
  ).length;
}

export async function sumCompletedAppointmentsAmount(
  tenantId,
  startIso,
  endIso,
) {
  const appointments = await listAppointmentsByTenantAndPeriod(
    tenantId,
    startIso,
    endIso,
  );

  return appointments
    .filter((appointment) => isCompletedStatus(appointment.status))
    .reduce(
      (total, appointment) => total + normalizeNumber(appointment.price, 0),
      0,
    );
}

export async function calculateCustomerStatsFromAppointments(customerId) {
  const appointments = await listAppointmentsByCustomer(customerId);

  const completedAppointments = appointments.filter((appointment) =>
    isCompletedStatus(appointment.status),
  );

  const totalAppointments = completedAppointments.length;
  const totalSpent = completedAppointments.reduce(
    (total, appointment) => total + normalizeNumber(appointment.price, 0),
    0,
  );

  const lastAppointmentAt = completedAppointments.length
    ? completedAppointments[completedAppointments.length - 1].startAt
    : null;

  return {
    totalAppointments,
    totalSpent,
    lastAppointmentAt,
  };
}