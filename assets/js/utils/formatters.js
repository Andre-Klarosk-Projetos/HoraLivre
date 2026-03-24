function normalizeString(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function tryFormatDate(dateValue, options = {}) {
  if (!dateValue) {
    return '-';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function formatCurrencyBRL(value) {
  const amount = normalizeNumber(value, 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

export function formatPhone(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return '-';
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length > 11) {
    const countryCode = digits.slice(0, digits.length - 11);
    const local = digits.slice(-11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');

    return `+${countryCode} ${local}`;
  }

  return digits;
}

export function formatSubscriptionStatus(value) {
  const normalized = normalizeString(value).toLowerCase();

  if (normalized === 'trial') {
    return 'Em teste';
  }

  if (normalized === 'active') {
    return 'Ativo';
  }

  if (normalized === 'inactive') {
    return 'Inativo';
  }

  if (normalized === 'blocked') {
    return 'Bloqueado';
  }

  if (normalized === 'canceled') {
    return 'Cancelado';
  }

  if (normalized === 'past_due') {
    return 'Pagamento pendente';
  }

  return normalized || '-';
}

export function formatBillingMode(value) {
  const normalized = normalizeString(value).toLowerCase();

  if (normalized === 'free') {
    return 'Gratuito';
  }

  if (normalized === 'fixed') {
    return 'Mensal fixo';
  }

  if (normalized === 'annual') {
    return 'Anual';
  }

  if (normalized === 'per_service') {
    return 'Por serviço executado';
  }

  if (normalized === 'fixed_plus_per_service') {
    return 'Fixo + por serviço';
  }

  return normalized || '-';
}

export function formatAppointmentStatus(value) {
  const normalized = normalizeString(value).toLowerCase();

  if (normalized === 'scheduled') {
    return 'Agendado';
  }

  if (normalized === 'confirmed') {
    return 'Confirmado';
  }

  if (normalized === 'completed') {
    return 'Concluído';
  }

  if (normalized === 'canceled') {
    return 'Cancelado';
  }

  if (normalized === 'no_show') {
    return 'Faltou';
  }

  return normalized || '-';
}

export function formatDateBR(value) {
  return tryFormatDate(value, {
    dateStyle: 'short'
  });
}

export function formatDateTimeBR(value) {
  return tryFormatDate(value, {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export function formatDateTimeForDisplay(value) {
  return formatDateTimeBR(value);
}

export function formatDateForDisplay(value) {
  return formatDateBR(value);
}

export function buildWhatsAppLink(phone, message = '') {
  const digits = normalizePhoneDigits(phone);

  if (!digits) {
    return '#';
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(String(message || ''))}`;
}

export function formatPercent(value, fractionDigits = 2) {
  const amount = normalizeNumber(value, 0) / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(amount);
}

export function formatPlainNumber(value) {
  const amount = normalizeNumber(value, 0);

  return new Intl.NumberFormat('pt-BR').format(amount);
}

export function formatSlug(value) {
  return normalizeString(value).toLowerCase();
}
