export const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' }
];

export function getDefaultBusinessHours() {
  return {
    workingDays: ['1', '2', '3', '4', '5', '6'],
    openingTime: '08:00',
    closingTime: '19:00',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    slotIntervalMinutes: 30,
    holidays: [],
    blockedDates: [],
    specialDates: []
  };
}

export function normalizeBusinessHours(value = {}) {
  const defaults = getDefaultBusinessHours();

  return {
    workingDays: Array.isArray(value.workingDays) && value.workingDays.length > 0
      ? value.workingDays.map((item) => String(item))
      : defaults.workingDays,
    openingTime: String(value.openingTime || defaults.openingTime),
    closingTime: String(value.closingTime || defaults.closingTime),
    lunchStartTime: String(value.lunchStartTime || defaults.lunchStartTime),
    lunchEndTime: String(value.lunchEndTime || defaults.lunchEndTime),
    slotIntervalMinutes: Number(value.slotIntervalMinutes || defaults.slotIntervalMinutes),
    holidays: Array.isArray(value.holidays) ? value.holidays.map(String) : [],
    blockedDates: Array.isArray(value.blockedDates) ? value.blockedDates.map(String) : [],
    specialDates: Array.isArray(value.specialDates) ? value.specialDates.map((item) => ({
      date: String(item.date || ''),
      isClosed: Boolean(item.isClosed),
      openingTime: item.openingTime ? String(item.openingTime) : '',
      closingTime: item.closingTime ? String(item.closingTime) : '',
      lunchStartTime: item.lunchStartTime ? String(item.lunchStartTime) : '',
      lunchEndTime: item.lunchEndTime ? String(item.lunchEndTime) : '',
      slotIntervalMinutes: Number(item.slotIntervalMinutes || defaults.slotIntervalMinutes)
    })) : []
  };
}

export function timeStringToMinutes(timeString) {
  const [hours, minutes] = String(timeString || '00:00').split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getWeekdayFromDateInput(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return String(date.getDay());
}

export function getSpecialDateRule(dateString, businessHours) {
  const normalized = normalizeBusinessHours(businessHours);
  return normalized.specialDates.find((item) => item.date === dateString) || null;
}

export function isHoliday(dateString, businessHours) {
  const normalized = normalizeBusinessHours(businessHours);
  return normalized.holidays.includes(dateString);
}

export function isBlockedDate(dateString, businessHours) {
  const normalized = normalizeBusinessHours(businessHours);
  return normalized.blockedDates.includes(dateString);
}

export function isWorkingDay(dateString, businessHours) {
  const normalized = normalizeBusinessHours(businessHours);
  const weekday = getWeekdayFromDateInput(dateString);
  return normalized.workingDays.includes(weekday);
}

export function getEffectiveBusinessHoursForDate(dateString, businessHours) {
  const normalized = normalizeBusinessHours(businessHours);
  const specialDateRule = getSpecialDateRule(dateString, normalized);

  if (specialDateRule) {
    if (specialDateRule.isClosed) {
      return {
        isClosed: true
      };
    }

    return {
      isClosed: false,
      openingTime: specialDateRule.openingTime || normalized.openingTime,
      closingTime: specialDateRule.closingTime || normalized.closingTime,
      lunchStartTime: specialDateRule.lunchStartTime || normalized.lunchStartTime,
      lunchEndTime: specialDateRule.lunchEndTime || normalized.lunchEndTime,
      slotIntervalMinutes: Number(
        specialDateRule.slotIntervalMinutes || normalized.slotIntervalMinutes
      ),
      workingDays: normalized.workingDays,
      holidays: normalized.holidays,
      blockedDates: normalized.blockedDates,
      specialDates: normalized.specialDates
    };
  }

  if (isHoliday(dateString, normalized) || isBlockedDate(dateString, normalized)) {
    return {
      isClosed: true
    };
  }

  if (!isWorkingDay(dateString, normalized)) {
    return {
      isClosed: true
    };
  }

  return {
    isClosed: false,
    openingTime: normalized.openingTime,
    closingTime: normalized.closingTime,
    lunchStartTime: normalized.lunchStartTime,
    lunchEndTime: normalized.lunchEndTime,
    slotIntervalMinutes: normalized.slotIntervalMinutes,
    workingDays: normalized.workingDays,
    holidays: normalized.holidays,
    blockedDates: normalized.blockedDates,
    specialDates: normalized.specialDates
  };
}

export function isWithinLunchBreak(timeString, businessHours) {
  if (!businessHours || businessHours.isClosed) {
    return false;
  }

  if (!businessHours.lunchStartTime || !businessHours.lunchEndTime) {
    return false;
  }

  const current = timeStringToMinutes(timeString);
  const lunchStart = timeStringToMinutes(businessHours.lunchStartTime);
  const lunchEnd = timeStringToMinutes(businessHours.lunchEndTime);

  return current >= lunchStart && current < lunchEnd;
}

export function isWithinBusinessHours(timeString, durationMinutes, businessHours) {
  if (!businessHours || businessHours.isClosed) {
    return false;
  }

  const start = timeStringToMinutes(timeString);
  const end = start + Number(durationMinutes || 0);

  const opening = timeStringToMinutes(businessHours.openingTime);
  const closing = timeStringToMinutes(businessHours.closingTime);

  if (start < opening || end > closing) {
    return false;
  }

  if (businessHours.lunchStartTime && businessHours.lunchEndTime) {
    const lunchStart = timeStringToMinutes(businessHours.lunchStartTime);
    const lunchEnd = timeStringToMinutes(businessHours.lunchEndTime);

    const overlapsLunch = start < lunchEnd && end > lunchStart;

    if (overlapsLunch) {
      return false;
    }
  }

  return true;
}

export function generateBusinessTimeSlots(dateString, businessHours) {
  const effectiveHours = getEffectiveBusinessHoursForDate(dateString, businessHours);

  if (!effectiveHours || effectiveHours.isClosed) {
    return [];
  }

  const slots = [];
  const opening = timeStringToMinutes(effectiveHours.openingTime);
  const closing = timeStringToMinutes(effectiveHours.closingTime);
  const interval = Number(effectiveHours.slotIntervalMinutes || 30);

  for (let current = opening; current < closing; current += interval) {
    const timeString = minutesToTimeString(current);

    if (isWithinLunchBreak(timeString, effectiveHours)) {
      continue;
    }

    slots.push(timeString);
  }

  return slots;
}