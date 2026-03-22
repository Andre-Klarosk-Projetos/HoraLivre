import { getTenantBySlug } from './tenant-service.js';
import { listActiveServicesByTenant } from './service-service.js';
import {
  findCustomerByPhone,
  createCustomer,
  updateCustomer
} from './customer-service.js';
import {
  createAppointment,
  listBusyAppointmentsByTenantAndDay
} from './appointment-service.js';

export async function getPublicTenantBySlug(slug) {
  const tenant = await getTenantBySlug(slug);

  if (!tenant) {
    return null;
  }

  if (tenant.publicPageEnabled === false) {
    return null;
  }

  if (tenant.isBlocked === true) {
    return null;
  }

  if (tenant.subscriptionStatus === 'blocked') {
    return null;
  }

  return tenant;
}

export async function listPublicServices(slug) {
  const tenant = await getPublicTenantBySlug(slug);

  if (!tenant) {
    return [];
  }

  return listActiveServicesByTenant(tenant.id);
}

export async function listBusyPublicAppointmentsByDate(slug, date) {
  const tenant = await getPublicTenantBySlug(slug);

  if (!tenant) {
    return [];
  }

  const startIso = new Date(`${date}T00:00:00`).toISOString();
  const endIso = new Date(`${date}T23:59:59`).toISOString();

  return listBusyAppointmentsByTenantAndDay(tenant.id, startIso, endIso);
}

export function appointmentOverlaps({
  slotStartIso,
  slotDurationMinutes,
  appointmentStartIso,
  appointmentEndIso
}) {
  const slotStart = new Date(slotStartIso).getTime();
  const slotEnd = slotStart + Number(slotDurationMinutes || 0) * 60000;

  const appointmentStart = new Date(appointmentStartIso).getTime();
  const appointmentEnd = new Date(appointmentEndIso).getTime();

  return slotStart < appointmentEnd && slotEnd > appointmentStart;
}

export async function createPublicBooking({
  slug,
  customerName,
  customerPhone,
  customerEmail,
  serviceId,
  serviceName,
  date,
  time,
  durationMinutes,
  price
}) {
  const tenant = await getPublicTenantBySlug(slug);

  if (!tenant) {
    throw new Error('Empresa não encontrada ou página pública indisponível.');
  }

  const normalizedPhone = String(customerPhone || '').trim();
  const normalizedEmail = String(customerEmail || '').trim();
  const normalizedName = String(customerName || '').trim();

  const existingCustomer = await findCustomerByPhone(tenant.id, normalizedPhone);

  let customerId = null;
  const appointmentDateIso = new Date(`${date}T${time}:00`).toISOString();

  if (existingCustomer) {
    customerId = existingCustomer.id;

    await updateCustomer(existingCustomer.id, {
      name: normalizedName,
      email: normalizedEmail || existingCustomer.email || '',
      lastAppointmentAt: appointmentDateIso
    });
  } else {
    const createdCustomer = await createCustomer({
      tenantId: tenant.id,
      name: normalizedName,
      phone: normalizedPhone,
      email: normalizedEmail,
      notes: '',
      totalAppointments: 0,
      totalSpent: 0,
      lastAppointmentAt: appointmentDateIso
    });

    customerId = createdCustomer.id;
  }

  const startAt = new Date(`${date}T${time}:00`).toISOString();
  const startDate = new Date(startAt);
  const endDate = new Date(
    startDate.getTime() + Number(durationMinutes || 0) * 60000
  );
  const endAt = endDate.toISOString();

  const busyAppointments = await listBusyAppointmentsByTenantAndDay(
    tenant.id,
    new Date(`${date}T00:00:00`).toISOString(),
    new Date(`${date}T23:59:59`).toISOString()
  );

  const hasConflict = busyAppointments.some((appointment) =>
    appointmentOverlaps({
      slotStartIso: startAt,
      slotDurationMinutes: durationMinutes,
      appointmentStartIso: appointment.startAt,
      appointmentEndIso: appointment.endAt
    })
  );

  if (hasConflict) {
    throw new Error('Este horário não está mais disponível. Escolha outro horário.');
  }

  return createAppointment({
    tenantId: tenant.id,
    customerId,
    customerName: normalizedName,
    serviceId,
    serviceName,
    startAt,
    endAt,
    price: Number(price || 0),
    status: 'scheduled',
    source: 'public_page',
    notes: ''
  });
}