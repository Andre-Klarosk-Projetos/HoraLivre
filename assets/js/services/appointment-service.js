import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';

export async function listAppointmentsByTenant(tenantId) {
  const appointmentsQuery = query(
    collection(db, 'appointments'),
    where('tenantId', '==', tenantId),
    orderBy('startAt', 'asc')
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso) {
  const appointmentsQuery = query(
    collection(db, 'appointments'),
    where('tenantId', '==', tenantId),
    where('startAt', '>=', startIso),
    where('startAt', '<=', endIso),
    orderBy('startAt', 'asc')
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listAppointmentsByCustomer(customerId) {
  const appointmentsQuery = query(
    collection(db, 'appointments'),
    where('customerId', '==', customerId),
    orderBy('startAt', 'asc')
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function getAppointmentById(appointmentId) {
  const reference = doc(db, 'appointments', appointmentId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

export async function listBusyAppointmentsByTenantAndDay(tenantId, startIso, endIso) {
  const appointments = await listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso);

  return appointments.filter((appointment) =>
    ['scheduled', 'confirmed', 'completed'].includes(appointment.status)
  );
}

export async function createAppointment(data) {
  const payload = {
    tenantId: data.tenantId,
    customerId: data.customerId || null,
    customerName: data.customerName || '',
    serviceId: data.serviceId || null,
    serviceName: data.serviceName || '',
    startAt: data.startAt,
    endAt: data.endAt,
    price: Number(data.price || 0),
    status: data.status || 'scheduled',
    source: data.source || 'panel',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return addDoc(collection(db, 'appointments'), payload);
}

export async function updateAppointment(appointmentId, data) {
  const reference = doc(db, 'appointments', appointmentId);

  await updateDoc(reference, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function updateAppointmentStatus(appointmentId, status) {
  const reference = doc(db, 'appointments', appointmentId);

  await updateDoc(reference, {
    status,
    updatedAt: new Date().toISOString()
  });
}

export async function countCompletedAppointments(tenantId, startIso, endIso) {
  const appointments = await listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso);

  return appointments.filter((appointment) => appointment.status === 'completed').length;
}

export async function sumCompletedAppointmentsAmount(tenantId, startIso, endIso) {
  const appointments = await listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso);

  return appointments
    .filter((appointment) => appointment.status === 'completed')
    .reduce((total, appointment) => total + Number(appointment.price || 0), 0);
}

export async function calculateCustomerStatsFromAppointments(customerId) {
  const appointments = await listAppointmentsByCustomer(customerId);

  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === 'completed'
  );

  const totalAppointments = completedAppointments.length;
  const totalSpent = completedAppointments.reduce(
    (total, appointment) => total + Number(appointment.price || 0),
    0
  );

  const lastAppointmentAt = completedAppointments.length > 0
    ? completedAppointments[completedAppointments.length - 1].startAt
    : null;

  return {
    totalAppointments,
    totalSpent,
    lastAppointmentAt
  };
}