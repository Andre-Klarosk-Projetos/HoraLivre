const DEFAULT_BUSINESS_HOURS = {
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  openingTime: '08:00',
  closingTime: '18:00',
  lunchStartTime: '',
  lunchEndTime: '',
  slotIntervalMinutes: 30,
  holidays: [],
  blockedDates: [],
  specialDates: []
};

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeSpecialDates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      date: normalizeString(item?.date),
      openingTime: normalizeString(item?.openingTime || item?.start),
      closingTime: normalizeString(item?.closingTime || item?.end),
      lunchStartTime: normalizeString(item?.lunchStartTime),
      lunchEndTime: normalizeString(item?.lunchEndTime),
      enabled: item?.enabled !== false
    }))
    .filter((item) => item.date);
}

function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function getWeekDayKeyFromDate(date) {
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

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return (hours * 60) + minutes;
}

function formatDateToIsoDay(date) {
  return [
    date.getFullYear(),
    padTwoDigits(date.getMonth() + 1),
    padTwoDigits(date.getDate())
  ].join('-');
}

function normalizeDateInput(dateInput) {
  if (!dateInput) {
    return '';
  }

  if (typeof dateInput === 'string') {
    return dateInput.slice(0, 10);
  }

  if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    return formatDateToIsoDay(dateInput);
  }

  return '';
}

function getSpecialDateForDate(dateString, businessHours) {
  return businessHours.specialDates.find((item) => item.date === dateString) || null;
}

function isBlockedDate(dateString, businessHours) {
  return (
    businessHours.holidays.includes(dateString)
    || businessHours.blockedDates.includes(dateString)
  );
}

export function normalizeBusinessHours(value = {}) {
  return {
    workingDays: normalizeStringArray(value.workingDays).length
      ? normalizeStringArray(value.workingDays)
      : [...DEFAULT_BUSINESS_HOURS.workingDays],
    openingTime: normalizeString(
      value.openingTime,
      DEFAULT_BUSINESS_HOURS.openingTime
    ),
    closingTime: normalizeString(
      value.closingTime,
      DEFAULT_BUSINESS_HOURS.closingTime
    ),
    lunchStartTime: normalizeString(value.lunchStartTime),
    lunchEndTime: normalizeString(value.lunchEndTime),
    slotIntervalMinutes: normalizeNumber(
      value.slotIntervalMinutes,
      DEFAULT_BUSINESS_HOURS.slotIntervalMinutes
    ),
    holidays: normalizeStringArray(value.holidays),
    blockedDates: normalizeStringArray(value.blockedDates),
    specialDates: normalizeSpecialDates(value.specialDates)
  };
}

export function isWorkingDay(dateInput, rawBusinessHours = {}) {
  const businessHours = normalizeBusinessHours(rawBusinessHours);
  const dateString = normalizeDateInput(dateInput);

  if (!dateString) {
    return false;
  }

  if (isBlockedDate(dateString, businessHours)) {
    return false;
  }

  const specialDate = getSpecialDateForDate(dateString, businessHours);

  if (specialDate) {
    return specialDate.enabled === true
      && Boolean(specialDate.openingTime)
      && Boolean(specialDate.closingTime);
  }

  const date = new Date(`${dateString}T00:00:00`);
  const dayKey = getWeekDayKeyFromDate(date);

  return businessHours.workingDays.includes(dayKey);
}

export function getBusinessHoursForDate(dateInput, rawBusinessHours = {}) {
  const businessHours = normalizeBusinessHours(rawBusinessHours);
  const dateString = normalizeDateInput(dateInput);

  if (!dateString) {
    return {
      enabled: false,
      openingTime: '',
      closingTime: '',
      lunchStartTime: '',
      lunchEndTime: '',
      slotIntervalMinutes: businessHours.slotIntervalMinutes
    };
  }

  if (isBlockedDate(dateString, businessHours)) {
    return {
      enabled: false,
      openingTime: '',
      closingTime: '',
      lunchStartTime: '',
      lunchEndTime: '',
      slotIntervalMinutes: businessHours.slotIntervalMinutes
    };
  }

  const specialDate = getSpecialDateForDate(dateString, businessHours);

  if (specialDate) {
    return {
      enabled: specialDate.enabled === true,
      openingTime: specialDate.openingTime || '',
      closingTime: specialDate.closingTime || '',
      lunchStartTime: specialDate.lunchStartTime || '',
      lunchEndTime: specialDate.lunchEndTime || '',
      slotIntervalMinutes: businessHours.slotIntervalMinutes
    };
  }

  const date = new Date(`${dateString}T00:00:00`);
  const dayKey = getWeekDayKeyFromDate(date);
  const enabled = businessHours.workingDays.includes(dayKey);

  return {
    enabled,
    openingTime: enabled ? businessHours.openingTime : '',
    closingTime: enabled ? businessHours.closingTime : '',
    lunchStartTime: enabled ? businessHours.lunchStartTime : '',
    lunchEndTime: enabled ? businessHours.lunchEndTime : '',
    slotIntervalMinutes: businessHours.slotIntervalMinutes
  };
}

export function isWithinBusinessHours(
  time,
  durationMinutes,
  rawBusinessHours = {},
  dateInput = null
) {
  const businessHours = dateInput
    ? getBusinessHoursForDate(dateInput, rawBusinessHours)
    : getBusinessHoursForDate(new Date(), rawBusinessHours);

  if (!businessHours.enabled) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(time);
  const duration = normalizeNumber(durationMinutes, 0);
  const endMinutes = startMinutes + duration;

  const openingMinutes = parseTimeToMinutes(businessHours.openingTime);
  const closingMinutes = parseTimeToMinutes(businessHours.closingTime);

  if (!startMinutes && time !== '00:00') {
    return false;
  }

  if (!duration || duration <= 0) {
    return false;
  }

  if (openingMinutes >= closingMinutes) {
    return false;
  }

  if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
    return false;
  }

  const lunchStartMinutes = parseTimeToMinutes(businessHours.lunchStartTime);
  const lunchEndMinutes = parseTimeToMinutes(businessHours.lunchEndTime);

  if (lunchStartMinutes < lunchEndMinutes) {
    const overlapsLunch =
      startMinutes < lunchEndMinutes && endMinutes > lunchStartMinutes;

    if (overlapsLunch) {
      return false;
    }
  }

  return true;
}

export function getAvailableSlotsForDate(
  dateInput,
  durationMinutes,
  rawBusinessHours = {}
) {
  const businessHours = getBusinessHoursForDate(dateInput, rawBusinessHours);

  if (!businessHours.enabled) {
    return [];
  }

  const duration = normalizeNumber(durationMinutes, 0);

  if (!duration || duration <= 0) {
    return [];
  }

  const openingMinutes = parseTimeToMinutes(businessHours.openingTime);
  const closingMinutes = parseTimeToMinutes(businessHours.closingTime);
  const interval = normalizeNumber(businessHours.slotIntervalMinutes, 30);

  if (openingMinutes >= closingMinutes || interval <= 0) {
    return [];
  }

  const slots = [];

  for (
    let current = openingMinutes;
    current + duration <= closingMinutes;
    current += interval
  ) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;
    const time = `${padTwoDigits(hour)}:${padTwoDigits(minute)}`;

    if (isWithinBusinessHours(time, duration, rawBusinessHours, dateInput)) {
      slots.push(time);
    }
  }

  return slots;
}
