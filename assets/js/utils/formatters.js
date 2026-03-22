export function formatCurrencyBRL(value) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numericValue);
}

export function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return phone || '';
}

export function formatSubscriptionStatus(status) {
  const labels = {
    trial: 'Trial',
    active: 'Ativo',
    expired: 'Expirado',
    blocked: 'Bloqueado',
    canceled: 'Cancelado'
  };

  return labels[status] || status || '-';
}

export function formatBillingMode(mode) {
  const labels = {
    free: 'Gratuito',
    fixed_plan: 'Plano fixo',
    per_service: 'Por serviço concluído'
  };

  return labels[mode] || mode || '-';
}

export function formatAppointmentStatus(status) {
  const labels = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    canceled: 'Cancelado',
    no_show: 'Faltou'
  };

  return labels[status] || status || '-';
}

export function buildWhatsAppLink(phone, message = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message || '');

  return `https://wa.me/${digits}?text=${encodedMessage}`;
}