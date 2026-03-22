export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthReference(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getStartAndEndOfCurrentMonth() {
  const now = new Date();

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function getStartAndEndOfDay(dateInput = new Date()) {
  const date = new Date(dateInput);

  const start = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0
  ));

  const end = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999
  ));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function getStartAndEndOfWeek(dateInput = new Date()) {
  const date = new Date(dateInput);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    startIso: monday.toISOString(),
    endIso: sunday.toISOString()
  };
}

export function formatDateTimeForDisplay(isoString) {
  if (!isoString) {
    return '-';
  }

  const date = new Date(isoString);

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function isSameDay(isoString, dateString) {
  if (!isoString || !dateString) {
    return false;
  }

  return new Date(isoString).toISOString().slice(0, 10) === dateString;
}

export function buildStartOfDayIsoFromDateInput(dateString) {
  if (!dateString) {
    return null;
  }

  return new Date(`${dateString}T00:00:00`).toISOString();
}

export function buildEndOfDayIsoFromDateInput(dateString) {
  if (!dateString) {
    return null;
  }

  return new Date(`${dateString}T23:59:59`).toISOString();
}