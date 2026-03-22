import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { db } from '../config/firebase-init.js';
import { findCustomerByPhone, createTenantCustomer } from './customer-service.js';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function getDateStringFromDate(date) {
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
}

function getWeekDayKey(date) {
  const day = date.getDay();

  if (day === 0) return 'sunday';
  if (day === 1) return 'monday';
  if (day === 2) return 'tuesday';
  if (day === 3) return 'wednesday';
  if (day === 4) return 'thursday';
  if (day === 5) return 'friday';

  return 'saturday';
}

function parseTimeToMinutes(value) {
  if (!value || !String(value).includes(':')) {
    return 0;
  }

  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
}

function formatMinutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
}

function getSpecialBusinessHoursForDate(tenant, dateString) {
  const special = tenant?.specialBusinessHours;

  if (Array.isArray(special)) {
    return special.find((item) => item?.date === dateString) || null;
  }

  if (special && typeof special === 'object') {
    return special[dateString] || null;
  }

  return null;
}

function isDateClosed(tenant, dateString) {
  const holidayDates = Array.isArray(tenant?.holidayDates) ? tenant.holidayDates : [];
  const closedDates = Array.isArray(tenant?.closedDates) ? tenant.closedDates : [];
  const unavailableDates = Array.isArray(tenant?.unavailableDates) ? tenant.unavailableDates : [];

  return holidayDates.includes(dateString) ||
    closedDates.includes(dateString) ||
    unavailableDates.includes(dateString);
}

function getBusinessHoursForDate(tenant, dateString) {
  if (isDateClosed(tenant, dateString)) {
    return {
      enabled: false,
      start: '',
      end: ''
    };
  }

  const specialBusinessHours = getSpecialBusinessHoursForDate(tenant, dateString);

  if (specialBusinessHours) {
    return {
      enabled: specialBusinessHours.enabled === true,
      start: specialBusinessHours.start || '',
      end: specialBusinessHours.end || ''
    };
  }

  const currentDate = new Date(`${dateString}T00:00:00`);
  const dayKey = getWeekDayKey(currentDate);
  const dayConfig = tenant?.businessHours?.[dayKey] || {};

  return {
    enabled: dayConfig.enabled === true,
    start: dayConfig.start || '',
    end: dayConfig.end || ''
  };
}

export async function getPublicTenantBySlug(slug) {
  const tenantsQuery = query(
    collection(db, 'tenants'),
    where('slug', '==', slug)
  );

  const snapshot = await getDocs(tenantsQuery);

  if (snapshot.empty) {
    return null;
  }

  const tenant = {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  };

  if (tenant.publicPageEnabled === false) {
    return null;
  }

  return tenant;
}

export async function listPublicServicesByTenant(tenantId) {
  const servicesQuery = query(
    collection(db, 'services'),
    where('tenantId', '==', tenantId),
    where('active', '==', true),
    orderBy('name')
  );

  const snapshot = await getDocs(servicesQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listAppointmentsByTenantAndDate(tenantId, dateString) {
  const startAt = new Date(`${dateString}T00:00:00`).toISOString();
  const endAt = new Date(`${dateString}T23:59:59`).toISOString();

  const appointmentsQuery = query(
    collection(db, 'appointments'),
    where('tenantId', '==', tenantId),
    where('startAt', '>=', startAt),
    where('startAt', '<=', endAt),
    orderBy('startAt')
  );

  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data()
  }));
}

export async function listAvailableSlotsForDate(tenant, service, dateString) {
  if (!tenant?.id || !service?.durationMinutes || !dateString) {
    return [];
  }

  const daySchedule = getBusinessHoursForDate(tenant, dateString);

  if (!daySchedule.enabled || !daySchedule.start || !daySchedule.end) {
    return [];
  }

  const appointments = await listAppointmentsByTenantAndDate(tenant.id, dateString);
  const durationMinutes = Number(service.durationMinutes || 0);
  const slotInterval = Number(tenant?.slotIntervalMinutes || 30);

  const startMinutes = parseTimeToMinutes(daySchedule.start);
  const endMinutes = parseTimeToMinutes(daySchedule.end);

  const blockedAppointments = appointments.filter((appointment) => {
    return appointment.status !== 'canceled' && appointment.status !== 'no_show';
  });

  const availableSlots = [];

  for (let current = startMinutes; current + durationMinutes <= endMinutes; current += slotInterval) {
    const slotStart = current;
    const slotEnd = current + durationMinutes;

    const hasConflict = blockedAppointments.some((appointment) => {
      const appointmentStartDate = new Date(appointment.startAt);
      const appointmentEndDate = new Date(appointment.endAt);

      const appointmentStartMinutes =
        (appointmentStartDate.getHours() * 60) + appointmentStartDate.getMinutes();

      const appointmentEndMinutes =
        (appointmentEndDate.getHours() * 60) + appointmentEndDate.getMinutes();

      return slotStart < appointmentEndMinutes && slotEnd > appointmentStartMinutes;
    });

    if (!hasConflict) {
      availableSlots.push(formatMinutesToTime(slotStart));
    }
  }

  return availableSlots;
}

export async function ensurePublicCustomer({
  tenantId,
  customerName,
  customerPhone,
  customerEmail
}) {
  const existingCustomer = await findCustomerByPhone(tenantId, customerPhone);

  if (existingCustomer) {
    return existingCustomer;
  }

  const createdReference = await createTenantCustomer({
    tenantId,
    name: customerName,
    phone: customerPhone,
    email: customerEmail,
    notes: 'Cliente criado pela página pública.'
  });

  return {
    id: createdReference.id,
    tenantId,
    name: customerName,
    phone: customerPhone,
    email: customerEmail
  };
}

export async function createPublicAppointment({
  tenantId,
  customerId,
  customerName,
  serviceId,
  serviceName,
  date,
  time,
  durationMinutes,
  price,
  notes
}) {
  const startAt = new Date(`${date}T${time}:00`).toISOString();
  const endAt = new Date(
    new Date(`${date}T${time}:00`).getTime() + (Number(durationMinutes || 0) * 60000)
  ).toISOString();

  return addDoc(collection(db, 'appointments'), {
    tenantId,
    customerId: customerId || null,
    customerName: customerName || '',
    serviceId: serviceId || null,
    serviceName: serviceName || '',
    startAt,
    endAt,
    price: Number(price || 0),
    status: 'scheduled',
    source: 'public',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function getSlugFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get('slug') || '';
}

export function formatPhoneForDisplay(phone) {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return '-';
  }

  return phone;
}

export function buildPublicWhatsAppMessageLink(phone, message) {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return '#';
  }

  return `https://wa.me/${normalized}?text=${encodeURIComponent(String(message || ''))}`;
}