import { listAppointmentsByTenant } from './appointment-service.js';
import {
  getCustomerById,
  listCustomersByTenant,
  updateCustomerStats
} from './customer-service.js';

function getLatestAppointmentDate(appointments = []) {
  if (!appointments.length) {
    return null;
  }

  const sortedAppointments = [...appointments].sort((firstItem, secondItem) => {
    const firstTime = new Date(firstItem.startAt || 0).getTime();
    const secondTime = new Date(secondItem.startAt || 0).getTime();

    return secondTime - firstTime;
  });

  return sortedAppointments[0]?.startAt || null;
}

export async function syncCustomerStats(customerId) {
  if (!customerId) {
    return;
  }

  const customer = await getCustomerById(customerId);

  if (!customer?.tenantId) {
    return;
  }

  const appointments = await listAppointmentsByTenant(customer.tenantId);
  const customerAppointments = appointments.filter((appointment) => appointment.customerId === customerId);

  const totalAppointments = customerAppointments.length;
  const completedAppointments = customerAppointments.filter(
    (appointment) => appointment.status === 'completed'
  ).length;

  const lastAppointmentAt = getLatestAppointmentDate(customerAppointments);

  await updateCustomerStats(customerId, {
    totalAppointments,
    completedAppointments,
    lastAppointmentAt
  });
}

export async function syncAllTenantCustomersStats(tenantId) {
  if (!tenantId) {
    return;
  }

  const [customers, appointments] = await Promise.all([
    listCustomersByTenant(tenantId),
    listAppointmentsByTenant(tenantId)
  ]);

  for (const customer of customers) {
    const customerAppointments = appointments.filter(
      (appointment) => appointment.customerId === customer.id
    );

    const totalAppointments = customerAppointments.length;
    const completedAppointments = customerAppointments.filter(
      (appointment) => appointment.status === 'completed'
    ).length;

    const lastAppointmentAt = getLatestAppointmentDate(customerAppointments);

    await updateCustomerStats(customer.id, {
      totalAppointments,
      completedAppointments,
      lastAppointmentAt
    });
  }
}