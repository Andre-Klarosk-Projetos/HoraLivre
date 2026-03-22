import { requireAdmin } from '../utils/guards.js';
import { listPlans } from '../services/plan-service.js';
import { showFeedback } from '../utils/dom-utils.js';
import { createCompanyClientWithAccess } from '../services/company-user-service.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

export async function populateNewCompanyPlans() {
  const plans = await listPlans();
  const select = document.getElementById('new-company-plan-id');

  if (!select) {
    return;
  }

  select.innerHTML = '<option value="">Selecione um plano</option>';

  plans.forEach((plan) => {
    const option = document.createElement('option');
    option.value = plan.id;
    option.textContent = plan.name;
    select.appendChild(option);
  });
}

export async function submitNewCompany(feedbackElement) {
  const businessName = document.getElementById('new-company-business-name').value.trim();
  const ownerName = document.getElementById('new-company-owner-name').value.trim();
  const email = document.getElementById('new-company-email').value.trim();
  const password = document.getElementById('new-company-password').value.trim();
  const whatsapp = document.getElementById('new-company-whatsapp').value.trim();
  const slug = document.getElementById('new-company-slug').value.trim();
  const planId = document.getElementById('new-company-plan-id').value;
  const subscriptionStatus = document.getElementById('new-company-status').value;
  const billingMode = document.getElementById('new-company-billing-mode').value;
  const fixedMonthlyPrice = Number(document.getElementById('new-company-fixed-price').value || 0);
  const annualPrice = Number(document.getElementById('new-company-annual-price').value || 0);
  const pricePerExecutedService = Number(document.getElementById('new-company-price-per-service').value || 0);
  const publicPageEnabled = document.getElementById('new-company-public-page-enabled').value === 'true';
  const reportsEnabled = document.getElementById('new-company-reports-enabled').value === 'true';
  const trialEndsAt = document.getElementById('new-company-trial-ends-at').value || null;

  if (!businessName || !ownerName || !email || !password || !whatsapp || !slug) {
    showFeedback(feedbackElement, 'Preencha todos os campos obrigatórios.', 'error');
    return false;
  }

  await createCompanyClientWithAccess({
    businessName,
    slug,
    whatsapp,
    email,
    password,
    planId,
    subscriptionStatus,
    billingMode,
    fixedMonthlyPrice,
    annualPrice,
    pricePerExecutedService,
    publicPageEnabled,
    reportsEnabled,
    trialEndsAt,
    ownerName
  });

  showFeedback(feedbackElement, 'Empresa cliente criada com sucesso.', 'success');
  return true;
}