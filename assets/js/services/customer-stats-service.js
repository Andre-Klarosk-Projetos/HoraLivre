import { getCustomerById, updateCustomerStats } from './customer-service.js';
import { listAppointmentsByCustomer } from './appointment-service.js';

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isCompletedStatus(status) {
  return status === 'completed';
}

function buildEmptyCustomerStats() {
  return {
    totalAppointments: 0,
    completedAppointments: 0,
    totalSpent: 0,
    lastAppointmentAt: null
  };
}

function calculateCustomerStatsFromAppointments(appointments = []) {
  if (!Array.isArray(appointments) || !appointments.length) {
    return buildEmptyCustomerStats();
  }

  const sortedAppointments = [...appointments].sort((a, b) => {
    const first = String(a?.startAt || '');
    const second = String(b?.startAt || '');
    return first.localeCompare(second);
  });

  const completedAppointments = sortedAppointments.filter((appointment) =>
    isCompletedStatus(appointment?.status)
  );

  const totalAppointments = sortedAppointments.length;
  const completedAppointmentsCount = completedAppointments.length;
  const totalSpent = completedAppointments.reduce(
    (total, appointment) => total + normalizeNumber(appointment?.price, 0),
    0
  );

  const lastAppointmentAt = sortedAppointments.length
    ? sortedAppointments[sortedAppointments.length - 1].startAt || null
    : null;

  return {
    totalAppointments,
    completedAppointments: completedAppointmentsCount,
    totalSpent,
    lastAppointmentAt
  };
}

export async function getCustomerStats(customerId) {
  if (!customerId) {
    return buildEmptyCustomerStats();
  }

  const appointments = await listAppointmentsByCustomer(customerId);
  return calculateCustomerStatsFromAppointments(appointments);
}

export async function syncCustomerStats(customerId) {
  if (!customerId) {
    return null;
  }

  const customer = await getCustomerById(customerId);

  if (!customer) {
    return null;
  }

  const stats = await getCustomerStats(customerId);
  await updateCustomerStats(customerId, stats);

  return {
    customerId,
    ...stats
  };
}

export async function syncManyCustomersStats(customerIds = []) {
  if (!Array.isArray(customerIds) || !customerIds.length) {
    return [];
  }

  const uniqueCustomerIds = [...new Set(customerIds.filter(Boolean))];
  const results = [];

  for (const customerId of uniqueCustomerIds) {
    const result = await syncCustomerStats(customerId);

    if (result) {
      results.push(result);
    }
  }

  return results;
}