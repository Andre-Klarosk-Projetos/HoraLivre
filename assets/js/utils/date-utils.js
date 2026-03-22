function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

export function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = padTwoDigits(now.getMonth() + 1);
  const day = padTwoDigits(now.getDate());

  return `${year}-${month}-${day}`;
}

export function formatDateTimeForDisplay(isoString) {
  if (!isoString) {
    return '-';
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = padTwoDigits(date.getDate());
  const month = padTwoDigits(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatDateForDisplay(dateString) {
  if (!dateString) {
    return '-';
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = padTwoDigits(date.getDate());
  const month = padTwoDigits(date.getMonth() + 1);
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function buildStartOfDayIsoFromDateInput(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

export function buildEndOfDayIsoFromDateInput(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(`${dateString}T23:59:59`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

export function getStartAndEndOfCurrentMonth() {
  const now = new Date();

  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString()
  };
}

export function normalizeMonthReference(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  if (/^\d{4}\/\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return raw.replace('-', '/');
  }

  if (/^\d{4}\/\d{1}$/.test(raw)) {
    const [year, month] = raw.split('/');
    return `${year}/${padTwoDigits(month)}`;
  }

  if (/^\d{4}-\d{1}$/.test(raw)) {
    const [year, month] = raw.split('-');
    return `${year}/${padTwoDigits(month)}`;
  }

  return raw;
}

export function getMonthReference(date = new Date()) {
  const currentDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(currentDate.getTime())) {
    return '';
  }

  const year = currentDate.getFullYear();
  const month = padTwoDigits(currentDate.getMonth() + 1);

  return `${year}/${month}`;
}

export function convertMonthReferenceToInputValue(monthReference) {
  const normalized = normalizeMonthReference(monthReference);

  if (!normalized) {
    return '';
  }

  return normalized.replace('/', '-');
}

export function getMonthNumberFromReference(monthReference) {
  const normalized = normalizeMonthReference(monthReference);

  if (!normalized) {
    return 0;
  }

  const parts = normalized.split('/');

  if (parts.length !== 2) {
    return 0;
  }

  return Number(parts[1] || 0);
}

export function getYearFromReference(monthReference) {
  const normalized = normalizeMonthReference(monthReference);

  if (!normalized) {
    return 0;
  }

  const parts = normalized.split('/');

  if (parts.length !== 2) {
    return 0;
  }

  return Number(parts[0] || 0);
}

export function getStartAndEndOfMonth(monthReference) {
  const normalized = normalizeMonthReference(monthReference);

  if (!normalized) {
    return {
      startIso: '',
      endIso: ''
    };
  }

  const year = getYearFromReference(normalized);
  const monthNumber = getMonthNumberFromReference(normalized);

  if (!year || !monthNumber) {
    return {
      startIso: '',
      endIso: ''
    };
  }

  const startDate = new Date(year, monthNumber - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, monthNumber, 0, 23, 59, 59, 999);

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString()
  };
}

export function getPreviousMonthReference(monthReference) {
  const normalized = normalizeMonthReference(monthReference || getMonthReference());

  if (!normalized) {
    return '';
  }

  const year = getYearFromReference(normalized);
  const monthNumber = getMonthNumberFromReference(normalized);

  if (!year || !monthNumber) {
    return '';
  }

  const previousMonthDate = new Date(year, monthNumber - 2, 1);

  return getMonthReference(previousMonthDate);
}

export function getNextMonthReference(monthReference) {
  const normalized = normalizeMonthReference(monthReference || getMonthReference());

  if (!normalized) {
    return '';
  }

  const year = getYearFromReference(normalized);
  const monthNumber = getMonthNumberFromReference(normalized);

  if (!year || !monthNumber) {
    return '';
  }

  const nextMonthDate = new Date(year, monthNumber, 1);

  return getMonthReference(nextMonthDate);
}

export function isDateWithinRange(isoString, startIso, endIso) {
  if (!isoString) {
    return false;
  }

  const current = new Date(isoString).getTime();

  if (Number.isNaN(current)) {
    return false;
  }

  const start = startIso ? new Date(startIso).getTime() : null;
  const end = endIso ? new Date(endIso).getTime() : null;

  if (start !== null && !Number.isNaN(start) && current < start) {
    return false;
  }

  if (end !== null && !Number.isNaN(end) && current > end) {
    return false;
  }

  return true;
}

export function getDateInputValueFromIso(isoString) {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());

  return `${year}-${month}-${day}`;
}

export function getTimeInputValueFromIso(isoString) {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hours = padTwoDigits(date.getHours());
  const minutes = padTwoDigits(date.getMinutes());

  return `${hours}:${minutes}`;
}