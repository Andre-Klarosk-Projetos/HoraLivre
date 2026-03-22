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