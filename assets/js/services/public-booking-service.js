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

function getWeekDayLabel(dayKey) {
  if (dayKey === 'sunday') return 'Domingo';
  if (dayKey === 'monday') return 'Segunda-feira';
  if (dayKey === 'tuesday') return 'Terça-feira';
  if (dayKey === 'wednesday') return 'Quarta-feira';
  if (dayKey === 'thursday') return 'Quinta-feira';
  if (dayKey === 'friday') return 'Sexta-feira';

  return 'Sábado';
}

function parseTimeToMinutes(value) {
  if (!value || !String(value).includes(':')) {
    return 0;
  }

  const [hours, minutes] = String(value).split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return (hours * 60) + minutes;
}

function formatMinutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
}

function formatDateToIsoDay(date) {
  return [
    date.getFullYear(),
    padTwoDigits(date.getMonth() + 1),
    padTwoDigits(date.getDate())
  ].join('-');
}

function normalizeDateKey(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateToIsoDay(value);
  }

  return '';
}

function getTenantBusinessHours(tenant) {
  return tenant?.businessHours || {};
}

function getTenantSlotInterval(tenant) {
  const businessHours = getTenantBusinessHours(tenant);

  return Number(
    tenant?.slotIntervalMinutes ||
    businessHours?.slotIntervalMinutes ||
    30
  );
}

function getTenantHolidayDates(tenant) {
  const businessHours = getTenantBusinessHours(tenant);

  return [
    ...(Array.isArray(tenant?.holidayDates) ? tenant.holidayDates : []),
    ...(Array.isArray(businessHours?.holidays) ? businessHours.holidays : [])
  ].map(normalizeDateKey).filter(Boolean);
}

function getTenantClosedDates(tenant) {
  const businessHours = getTenantBusinessHours(tenant);

  return [
    ...(Array.isArray(tenant?.closedDates) ? tenant.closedDates : []),
    ...(Array.isArray(businessHours?.blockedDates) ? businessHours.blockedDates : [])
  ].map(normalizeDateKey).filter(Boolean);
}

function getTenantUnavailableDates(tenant) {
  return (Array.isArray(tenant?.unavailableDates) ? tenant.unavailableDates : [])
    .map(normalizeDateKey)
    .filter(Boolean);
}

function getSpecialBusinessHoursForDate(tenant, dateString) {
  const directSpecial = tenant?.specialBusinessHours;

  if (Array.isArray(directSpecial)) {
    const found = directSpecial.find((item) => normalizeDateKey(item?.date) === dateString);

    if (found) {
      return {
        enabled: found.enabled === true,
        start: found.start || '',
        end: found.end || ''
      };
    }
  }

  if (directSpecial && typeof directSpecial === 'object') {
    const found = directSpecial[dateString];

    if (found) {
      return {
        enabled: found.enabled === true,
        start: found.start || '',
        end: found.end || ''
      };
    }
  }

  const businessHours = getTenantBusinessHours(tenant);
  const specialDates = Array.isArray(businessHours?.specialDates)
    ? businessHours.specialDates
    : [];

  const foundSpecialDate = specialDates.find(
    (item) => normalizeDateKey(item?.date) === dateString
  );

  if (!foundSpecialDate) {
    return null;
  }

  return {
    enabled: foundSpecialDate.enabled !== false,
    start: foundSpecialDate.openingTime || foundSpecialDate.start || '',
    end: foundSpecialDate.closingTime || foundSpecialDate.end || '',
    lunchStartTime: foundSpecialDate.lunchStartTime || '',
    lunchEndTime: foundSpecialDate.lunchEndTime || ''
  };
}

function isDateClosed(tenant, dateString) {
  const holidayDates = getTenantHolidayDates(tenant);
  const closedDates = getTenantClosedDates(tenant);
  const unavailableDates = getTenantUnavailableDates(tenant);

  return (
    holidayDates.includes(dateString) ||
    closedDates.includes(dateString) ||
    unavailableDates.includes(dateString)
  );
}

function getRegularBusinessHoursForDate(tenant, dateString) {
  const currentDate = new Date(`${dateString}T00:00:00`);
  const dayKey = getWeekDayKey(currentDate);
  const businessHours = getTenantBusinessHours(tenant);
  const dayConfig = businessHours?.[dayKey];

  if (dayConfig && typeof dayConfig === 'object') {
    if (dayConfig.enabled !== true || !dayConfig.start || !dayConfig.end) {
      return {
        enabled: false,
        start: '',
        end: '',
        lunchStartTime: '',
        lunchEndTime: '',
        reason: 'non_working_day',
        message: `${getWeekDayLabel(dayKey)} não é um dia de atendimento da empresa.`
      };
    }

    return {
      enabled: true,
      start: dayConfig.start || '',
      end: dayConfig.end || '',
      lunchStartTime: dayConfig.lunchStartTime || businessHours?.lunchStartTime || '',
      lunchEndTime: dayConfig.lunchEndTime || businessHours?.lunchEndTime || '',
      reason: 'regular_hours',
      message: `Horário de atendimento: ${dayConfig.start || '--:--'} às ${dayConfig.end || '--:--'}.`
    };
  }

  const workingDays = Array.isArray(businessHours?.workingDays)
    ? businessHours.workingDays
    : [];

  const openingTime = businessHours?.openingTime || '';
  const closingTime = businessHours?.closingTime || '';

  if (!workingDays.includes(dayKey) || !openingTime || !closingTime) {
    return {
      enabled: false,
      start: '',
      end: '',
      lunchStartTime: '',
      lunchEndTime: '',
      reason: 'non_working_day',
      message: `${getWeekDayLabel(dayKey)} não é um dia de atendimento da empresa.`
    };
  }

  return {
    enabled: true,
    start: openingTime,
    end: closingTime,
    lunchStartTime: businessHours?.lunchStartTime || '',
    lunchEndTime: businessHours?.lunchEndTime || '',
    reason: 'regular_hours',
    message: `Horário de atendimento: ${openingTime || '--:--'} às ${closingTime || '--:--'}.`
  };
}

function isInsideLunchBreak(slotStart, slotEnd, lunchStartTime, lunchEndTime) {
  if (!lunchStartTime || !lunchEndTime) {
    return false;
  }

  const lunchStartMinutes = parseTimeToMinutes(lunchStartTime);
  const lunchEndMinutes = parseTimeToMinutes(lunchEndTime);

  if (!lunchStartMinutes && !lunchEndMinutes) {
    return false;
  }

  return slotStart < lunchEndMinutes && slotEnd > lunchStartMinutes;
}

export function getBusinessHoursForDate(tenant, dateString) {
  if (isDateClosed(tenant, dateString)) {
    return {
      enabled: false,
      start: '',
      end: '',
      lunchStartTime: '',
      lunchEndTime: '',
      reason: 'closed_date',
      message: 'A empresa está fechada nesta data.'
    };
  }

  const specialBusinessHours = getSpecialBusinessHoursForDate(tenant, dateString);

  if (specialBusinessHours) {
    return {
      enabled: specialBusinessHours.enabled === true,
      start: specialBusinessHours.start || '',
      end: specialBusinessHours.end || '',
      lunchStartTime: specialBusinessHours.lunchStartTime || '',
      lunchEndTime: specialBusinessHours.lunchEndTime || '',
      reason: specialBusinessHours.enabled === true ? 'special_hours' : 'special_closed',
      message: specialBusinessHours.enabled === true
        ? `Expediente especial nesta data: ${specialBusinessHours.start || '--:--'} às ${specialBusinessHours.end || '--:--'}.`
        : 'A empresa definiu esta data como indisponível.'
    };
  }

  return getRegularBusinessHoursForDate(tenant, dateString);
}

export function getReadableBusinessHours(tenant) {
  const businessHours = getTenantBusinessHours(tenant);
  const orderedDays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ];

  return orderedDays.map((dayKey) => {
    const dayConfig = businessHours?.[dayKey];

    if (dayConfig && typeof dayConfig === 'object') {
      const enabled = dayConfig.enabled === true && dayConfig.start && dayConfig.end;

      return {
        dayKey,
        label: getWeekDayLabel(dayKey),
        text: enabled ? `${dayConfig.start} às ${dayConfig.end}` : 'Fechado',
        enabled
      };
    }

    const workingDays = Array.isArray(businessHours?.workingDays)
      ? businessHours.workingDays
      : [];

    const enabled = (
      workingDays.includes(dayKey) &&
      businessHours?.openingTime &&
      businessHours?.closingTime
    );

    return {
      dayKey,
      label: getWeekDayLabel(dayKey),
      text: enabled
        ? `${businessHours.openingTime} às ${businessHours.closingTime}`
        : 'Fechado',
      enabled
    };
  });
}

export async function getPublicTenantBySlug(slug) {
  const tenantsQuery = query(
    collection(db, 'tenants'),
    where('slug', '==', slug),
    where('publicPageEnabled', '==', true),
    where('isBlocked', '==', false)
  );

  const snapshot = await getDocs(tenantsQuery);

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data()
  };
}

export async function listPublicServicesByTenant(tenantId) {
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

export async function getAvailabilityForDate(tenant, service, dateString) {
  if (!tenant?.id || !service?.durationMinutes || !dateString) {
    return {
      status: 'invalid',
      message: 'Dados insuficientes para consultar disponibilidade.',
      slots: [],
      schedule: null
    };
  }

  const daySchedule = getBusinessHoursForDate(tenant, dateString);

  if (!daySchedule.enabled || !daySchedule.start || !daySchedule.end) {
    return {
      status: 'closed',
      message: daySchedule.message || 'A empresa não atende nesta data.',
      slots: [],
      schedule: daySchedule
    };
  }

  const appointments = await listAppointmentsByTenantAndDate(tenant.id, dateString);
  const durationMinutes = Number(service?.durationMinutes || 0);
  const slotInterval = getTenantSlotInterval(tenant);

  if (!durationMinutes || durationMinutes <= 0) {
    return {
      status: 'invalid',
      message: 'A duração do serviço é inválida.',
      slots: [],
      schedule: daySchedule
    };
  }

  const startMinutes = parseTimeToMinutes(daySchedule.start);
  const endMinutes = parseTimeToMinutes(daySchedule.end);

  if (startMinutes >= endMinutes) {
    return {
      status: 'invalid',
      message: 'A configuração de horário da empresa está inválida.',
      slots: [],
      schedule: daySchedule
    };
  }

  const blockedAppointments = appointments.filter((appointment) => {
    return appointment.status !== 'canceled' && appointment.status !== 'no_show';
  });

  const availableSlots = [];

  for (
    let current = startMinutes;
    current + durationMinutes <= endMinutes;
    current += slotInterval
  ) {
    const slotStart = current;
    const slotEnd = current + durationMinutes;

    if (
      isInsideLunchBreak(
        slotStart,
        slotEnd,
        daySchedule.lunchStartTime,
        daySchedule.lunchEndTime
      )
    ) {
      continue;
    }

    const hasConflict = blockedAppointments.some((appointment) => {
      const appointmentStartDate = new Date(appointment.startAt);
      const appointmentEndDate = new Date(appointment.endAt);

      const appointmentStartMinutes = (
        appointmentStartDate.getHours() * 60
      ) + appointmentStartDate.getMinutes();

      const appointmentEndMinutes = (
        appointmentEndDate.getHours() * 60
      ) + appointmentEndDate.getMinutes();

      return slotStart < appointmentEndMinutes && slotEnd > appointmentStartMinutes;
    });

    if (!hasConflict) {
      availableSlots.push(formatMinutesToTime(slotStart));
    }
  }

  if (!availableSlots.length) {
    return {
      status: 'full',
      message: 'Não há horários livres para esta data.',
      slots: [],
      schedule: daySchedule
    };
  }

  return {
    status: daySchedule.reason === 'special_hours' ? 'special_hours' : 'available',
    message: daySchedule.message || 'Horários disponíveis carregados com sucesso.',
    slots: availableSlots,
    schedule: daySchedule
  };
}

export async function listAvailableSlotsForDate(tenant, service, dateString) {
  const availability = await getAvailabilityForDate(tenant, service, dateString);
  return availability.slots || [];
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
  if (!tenantId || !serviceId || !date || !time) {
    throw new Error('Dados obrigatórios do agendamento não informados.');
  }

  const parsedDurationMinutes = Number(durationMinutes || 0);

  if (!parsedDurationMinutes || parsedDurationMinutes <= 0) {
    throw new Error('Duração inválida para o serviço.');
  }

  const startAt = new Date(`${date}T${time}:00`).toISOString();
  const endAt = new Date(
    new Date(`${date}T${time}:00`).getTime() + (parsedDurationMinutes * 60000)
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
    source: 'public_page',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function getSlugFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get('slug') || '';
}

export function buildPublicWhatsAppMessageLink(phone, message) {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return '#';
  }

  return `https://wa.me/${normalized}?text=${encodeURIComponent(String(message || ''))}`;
}
