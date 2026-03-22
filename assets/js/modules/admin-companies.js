import { requireAdmin } from '../utils/guards.js';
import { listTenants, updateTenant } from '../services/tenant-service.js';
import { listPlans } from '../services/plan-service.js';
import { saveBillingSettingsForTenant } from '../services/billing-service.js';
import {
  clearElement,
  createListItem,
  showFeedback
} from '../utils/dom-utils.js';
import {
  formatBillingMode,
  formatSubscriptionStatus,
  buildWhatsAppLink,
  formatPhone,
  formatCurrencyBRL
} from '../utils/formatters.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

let cachedCompanies = [];

function getCompanyFilterState() {
  return {
    search: document.getElementById('company-search-input')?.value?.trim()?.toLowerCase() || '',
    planId: document.getElementById('company-plan-filter')?.value || '',
    status: document.getElementById('company-status-filter')?.value || '',
    billingMode: document.getElementById('company-billing-filter')?.value || ''
  };
}

function applyCompanyFilters(companies, filters) {
  return companies.filter((company) => {
    const matchesSearch =
      !filters.search ||
      String(company.businessName || '').toLowerCase().includes(filters.search);

    const matchesPlan = !filters.planId || String(company.planId || '') === filters.planId;
    const matchesStatus = !filters.status || String(company.subscriptionStatus || '') === filters.status;
    const matchesBilling = !filters.billingMode || String(company.billingMode || '') === filters.billingMode;

    return matchesSearch && matchesPlan && matchesStatus && matchesBilling;
  });
}

export async function populateCompanyPlanFilters() {
  const plans = await listPlans();
  const planFilter = document.getElementById('company-plan-filter');
  const planSelect = document.getElementById('company-admin-plan-id');

  if (planFilter) {
    planFilter.innerHTML = '<option value="">Todos</option>';

    plans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name;
      planFilter.appendChild(option);
    });
  }

  if (planSelect) {
    planSelect.innerHTML = '<option value="">Selecione um plano</option>';

    plans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name;
      planSelect.appendChild(option);
    });
  }
}

export async function renderAdminCompaniesList(elementId = 'companies-list') {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  cachedCompanies = await listTenants();
  const filters = getCompanyFilterState();
  const companies = applyCompanyFilters(cachedCompanies, filters);

  clearElement(element);

  if (!companies.length) {
    element.appendChild(createListItem(`
      <strong>Nenhuma empresa encontrada</strong><br>
      Ajuste a busca ou os filtros para localizar uma empresa cliente.
    `));
    return;
  }

  companies.forEach((company) => {
    element.appendChild(createListItem(`
      <strong>${company.businessName || '-'}</strong><br>
      WhatsApp: ${formatPhone(company.whatsapp || '-')}<br>
      Plano: ${company.planId || '-'}<br>
      Cobrança: ${formatBillingMode(company.billingMode)}<br>
      Status: ${formatSubscriptionStatus(company.subscriptionStatus)}<br>
      Preço mensal: ${formatCurrencyBRL(company.fixedMonthlyPrice || 0)}<br>
      Preço anual: ${formatCurrencyBRL(company.annualPrice || 0)}<br>
      Preço por serviço: ${formatCurrencyBRL(company.pricePerExecutedService || 0)}<br>
      Página pública: ${company.publicPageEnabled === false ? 'Não' : 'Sim'}<br>
      Trial até: ${company.trialEndsAt || '-'}<br><br>
      <button class="button" type="button" data-company-action="edit" data-company-id="${company.id}">
        Editar
      </button>
    `));
  });

  bindCompanyActions(companies);
}

function bindCompanyActions(companies) {
  const container = document.getElementById('companies-list');
  const feedbackElement = document.getElementById('company-admin-feedback');

  if (!container) {
    return;
  }

  const buttons = container.querySelectorAll('[data-company-action="edit"][data-company-id]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const companyId = button.getAttribute('data-company-id');
      const company = companies.find((item) => item.id === companyId);

      if (!company) {
        return;
      }

      fillCompanyAdminForm(company);
      showFeedback(feedbackElement, 'Empresa carregada para edição.', 'success');
    });
  });
}

export function fillCompanyAdminForm(company) {
  document.getElementById('company-admin-edit-id').value = company.id || '';
  document.getElementById('company-admin-business-name').value = company.businessName || '';
  document.getElementById('company-admin-slug').value = company.slug || '';
  document.getElementById('company-admin-whatsapp').value = company.whatsapp || '';
  document.getElementById('company-admin-status').value = company.subscriptionStatus || 'trial';
  document.getElementById('company-admin-plan-id').value = company.planId || '';
  document.getElementById('company-admin-billing-mode').value = company.billingMode || 'free';
  document.getElementById('company-admin-fixed-price').value = company.fixedMonthlyPrice || 0;
  document.getElementById('company-admin-annual-price').value = company.annualPrice || 0;
  document.getElementById('company-admin-price-per-service').value = company.pricePerExecutedService || 0;
  document.getElementById('company-admin-public-page-enabled').value = String(company.publicPageEnabled !== false);
  document.getElementById('company-admin-trial-ends-at').value = company.trialEndsAt ? String(company.trialEndsAt).slice(0, 10) : '';

  const whatsappButton = document.getElementById('company-admin-whatsapp-button');

  if (whatsappButton) {
    whatsappButton.href = buildWhatsAppLink(
      company.whatsapp || '',
      'Olá, estou entrando em contato sobre a sua empresa no HoraLivre.'
    );
  }
}

export function resetCompanyAdminForm() {
  const form = document.getElementById('company-admin-form');
  const editId = document.getElementById('company-admin-edit-id');

  form?.reset();

  if (editId) {
    editId.value = '';
  }

  const whatsappButton = document.getElementById('company-admin-whatsapp-button');

  if (whatsappButton) {
    whatsappButton.href = '#';
  }
}

export async function submitSaveCompanyAdmin(feedbackElement) {
  const companyId = document.getElementById('company-admin-edit-id').value.trim();
  const businessName = document.getElementById('company-admin-business-name').value.trim();
  const slug = document.getElementById('company-admin-slug').value.trim();
  const whatsapp = document.getElementById('company-admin-whatsapp').value.trim();
  const subscriptionStatus = document.getElementById('company-admin-status').value;
  const planId = document.getElementById('company-admin-plan-id').value;
  const billingMode = document.getElementById('company-admin-billing-mode').value;
  const fixedMonthlyPrice = Number(document.getElementById('company-admin-fixed-price').value || 0);
  const annualPrice = Number(document.getElementById('company-admin-annual-price').value || 0);
  const pricePerExecutedService = Number(document.getElementById('company-admin-price-per-service').value || 0);
  const publicPageEnabled = document.getElementById('company-admin-public-page-enabled').value === 'true';
  const trialEndsAt = document.getElementById('company-admin-trial-ends-at').value || null;

  if (!companyId) {
    showFeedback(feedbackElement, 'Selecione uma empresa para editar.', 'error');
    return false;
  }

  if (!businessName) {
    showFeedback(feedbackElement, 'Nome da empresa é obrigatório.', 'error');
    return false;
  }

  await updateTenant(companyId, {
    businessName,
    slug,
    whatsapp,
    subscriptionStatus,
    planId,
    billingMode,
    fixedMonthlyPrice,
    annualPrice,
    pricePerExecutedService,
    publicPageEnabled,
    isBlocked: subscriptionStatus === 'blocked',
    trialEndsAt
  });

  await saveBillingSettingsForTenant(companyId, {
    billingMode,
    fixedMonthlyPrice,
    annualPrice,
    pricePerExecutedService
  });

  showFeedback(feedbackElement, 'Empresa cliente atualizada com sucesso.', 'success');
  return true;
}

export function bindCompanyFilters(onChange) {
  [
    'company-search-input',
    'company-plan-filter',
    'company-status-filter',
    'company-billing-filter'
  ].forEach((id) => {
    const element = document.getElementById(id);

    element?.addEventListener('input', onChange);
    element?.addEventListener('change', onChange);
  });
}