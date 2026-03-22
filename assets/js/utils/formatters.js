export function formatCurrencyBRL(value) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numericValue);
}

export function formatPhone(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  return raw;
}

export function buildWhatsAppLink(phone, message = '') {
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(String(message || ''));

  if (!normalizedPhone) {
    return '#';
  }

  if (!encodedMessage) {
    return `https://wa.me/${normalizedPhone}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

export function formatAppointmentStatus(status) {
  if (status === 'scheduled') {
    return 'Agendado';
  }

  if (status === 'confirmed') {
    return 'Confirmado';
  }

  if (status === 'completed') {
    return 'Concluído';
  }

  if (status === 'canceled') {
    return 'Cancelado';
  }

  if (status === 'no_show') {
    return 'Faltou';
  }

  return status || '-';
}

export function formatSubscriptionStatus(status) {
  if (status === 'trial') {
    return 'Trial';
  }

  if (status === 'active') {
    return 'Ativo';
  }

  if (status === 'blocked') {
    return 'Bloqueado';
  }

  return status || '-';
}

export function formatBillingMode(mode) {
  if (mode === 'free') {
    return 'Gratuito';
  }

  if (mode === 'fixed_plan') {
    return 'Plano mensal';
  }

  if (mode === 'annual_plan') {
    return 'Plano anual';
  }

  if (mode === 'per_service') {
    return 'Por serviço concluído';
  }

  return mode || '-';
}

export function formatMonthNumberToName(monthNumber) {
  const month = Number(monthNumber || 0);

  if (month === 1) {
    return 'Janeiro';
  }

  if (month === 2) {
    return 'Fevereiro';
  }

  if (month === 3) {
    return 'Março';
  }

  if (month === 4) {
    return 'Abril';
  }

  if (month === 5) {
    return 'Maio';
  }

  if (month === 6) {
    return 'Junho';
  }

  if (month === 7) {
    return 'Julho';
  }

  if (month === 8) {
    return 'Agosto';
  }

  if (month === 9) {
    return 'Setembro';
  }

  if (month === 10) {
    return 'Outubro';
  }

  if (month === 11) {
    return 'Novembro';
  }

  if (month === 12) {
    return 'Dezembro';
  }

  return '-';
}