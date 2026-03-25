import { requireAdmin } from '../utils/guards.js';
import {
  listTenants,
  updateTenant
} from '../services/tenant-service.js';
import { listPlans } from '../services/plan-service.js';
import { saveBillingSettingsForTenant } from '../services/billing-service.js';
import {
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';
import {
  formatBillingMode,
  formatSubscriptionStatus,
  buildWhatsAppLink,
  formatPhone,
  formatCurrencyBRL,
  formatMonthNumberToName
} from '../utils/formatters.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

let cachedCompanies = [];
let cachedPlans = [];

function getElementByIds(...ids) {
  for (const id of ids) {
    const element = document.getElementById(id);

    if (element) {
      return element;
    }
  }

  return null;
}

function getCompanyFilterState() {
  return {
    search: getElementByIds('companies-search-input', 'company-search-input')?.value?.trim()?.toLowerCase() || '',
    planId: getElementByIds('companies-plan-filter', 'company-plan-filter')?.value || '',
    status: getElementByIds('companies-status-filter', 'company-status-filter')?.value || '',
    billingMode: getElementByIds('companies-billing-filter', 'company-billing-filter')?.value || ''
  };
}

function applyCompanyFilters(companies, filters) {
  return companies.filter((company) => {
    const matchesSearch = !filters.search
      || String(company.businessName || '').toLowerCase().includes(filters.search)
      || String(company.slug || '').toLowerCase().includes(filters.search)
      || String(company.whatsapp || '').toLowerCase().includes(filters.search);

    const matchesPlan = !filters.planId || String(company.planId || '') === filters.planId;
    const matchesStatus = !filters.status || String(company.subscriptionStatus || '') === filters.status;
    const matchesBilling = !filters.billingMode || String(company.billingMode || '') === filters.billingMode;

    return matchesSearch && matchesPlan && matchesStatus && matchesBilling;
  });
}

function setFieldValue(value, ...ids) {
  const element = getElementByIds(...ids);

  if (!element) {
    return;
  }

  element.value = value ?? '';
}

function getFieldValue(...ids) {
  return getElementByIds(...ids)?.value ?? '';
}

export async function populateCompanyPlanFilters() {
  cachedPlans = await listPlans();

  const planFilter = getElementByIds('companies-plan-filter', 'company-plan-filter');
  const newCompanyPlanSelect = getElementByIds('new-company-plan-select');
  const editCompanyPlanSelect = getElementByIds('edit-company-plan-select', 'company-admin-plan-id');

  if (planFilter) {
    planFilter.innerHTML = '<option value="">Todos</option>';

    cachedPlans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name || '-';
      planFilter.appendChild(option);
    });
  }

  [newCompanyPlanSelect, editCompanyPlanSelect].forEach((select) => {
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Selecione um plano</option>';

    cachedPlans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name || '-';
      select.appendChild(option);
    });
  });
}

function buildCompanyCardHtml(company) {
  const publicLink = company.slug
    ? `./agendar.html?slug=${company.slug}`
    : '#';

  return `
    <div class="entity-card-header">
      <div>
        <h3>${company.businessName || '-'}</h3>
        <span class="entity-badge">${formatSubscriptionStatus(company.subscriptionStatus)}</span>
      </div>
    </div>

    <div class="entity-card-body">
      <p><strong>WhatsApp</strong><br>${formatPhone(company.whatsapp || '-')}</p>
      <p><strong>Slug</strong><br>${company.slug || '-'}</p>
      <p><strong>Plano</strong><br>${company.planId || '-'}</p>
      <p><strong>Cobrança</strong><br>${formatBillingMode(company.billingMode)}</p>
      <p><strong>Preço mensal</strong><br>${formatCurrencyBRL(company.fixedMonthlyPrice || 0)}</p>
      <p><strong>Preço anual</strong><br>${formatCurrencyBRL(company.annualPrice || 0)}</p>
      <p><strong>Mês anual</strong><br>${company.annualBillingMonth ? formatMonthNumberToName(company.annualBillingMonth) : '-'}</p>
      <p><strong>Por serviço</strong><br>${formatCurrencyBRL(company.pricePerExecutedService || 0)}</p>
      <p><strong>Página pública</strong><br>${company.publicPageEnabled === false ? 'Não' : 'Sim'}</p>
      <p><strong>Trial até</strong><br>${company.trialEndsAt || '-'}</p>
    </div>

    <div class="entity-card-actions">
      <button type="button" data-company-action="edit" data-company-id="${company.id}">
        Editar
      </button>
      <a href="${publicLink}" target="_blank" rel="noopener noreferrer">
        Página pública
      </a>
    </div>
  `;
}

export async function renderAdminCompaniesList(elementId = 'companies-list') {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  cachedCompanies = await listTenants();
  const companies = applyCompanyFilters(cachedCompanies, getCompanyFilterState());

  clearElement(element);

  if (!companies.length) {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card empty-state-item';
    listItem.innerHTML = `
      <h3>Nenhuma empresa encontrada</h3>
      <p>Ajuste a busca ou os filtros para localizar uma empresa cliente.</p>
    `;
    element.appendChild(listItem);
    return;
  }

  companies.forEach((company) => {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card';
    listItem.innerHTML = buildCompanyCardHtml(company);
    element.appendChild(listItem);
  });

  bindCompanyActions(elementId);
}

function fillCompanyEditForm(company) {
  setFieldValue(company.id || '', 'edit-company-tenant-id');
  setFieldValue(company.businessName || '', 'edit-company-form-business-name', 'businessName');
  setFieldValue(company.slug || '', 'edit-company-form-slug', 'slug');
  setFieldValue(company.whatsapp || '', 'edit-company-form-whatsapp', 'whatsapp');
  setFieldValue(company.subscriptionStatus || 'trial', 'edit-company-form-subscription-status', 'subscriptionStatus');
  setFieldValue(company.planId || '', 'edit-company-plan-select', 'company-admin-plan-id');
  setFieldValue(company.billingMode || 'free', 'edit-company-form-billing-mode', 'billingMode');
  setFieldValue(company.fixedMonthlyPrice || 0, 'edit-company-form-fixed-price', 'fixedMonthlyPrice');
  setFieldValue(company.annualPrice || 0, 'edit-company-form-annual-price', 'annualPrice');
  setFieldValue(company.annualBillingMonth || '', 'edit-company-form-annual-billing-month', 'annualBillingMonth');
  setFieldValue(company.pricePerExecutedService || 0, 'edit-company-form-price-per-service', 'pricePerExecutedService');
  setFieldValue(String(company.publicPageEnabled !== false), 'edit-company-form-public-page-enabled', 'publicPageEnabled');
  setFieldValue(String(company.reportsEnabled !== false), 'edit-company-form-reports-enabled', 'reportsEnabled');
  setFieldValue(company.trialEndsAt ? String(company.trialEndsAt).slice(0, 10) : '', 'edit-company-form-trial-ends-at', 'trialEndsAt');

  const whatsappLink = getElementByIds('edit-company-whatsapp-link');

  if (whatsappLink) {
    whatsappLink.href = buildWhatsAppLink(
      company.whatsapp || '',
      `Olá ${company.businessName || ''}, estou entrando em contato pelo HoraLivre.`
    );
  }
}

function bindCompanyActions(elementId = 'companies-list') {
  const container = document.getElementById(elementId);
  const feedbackElement = getElementByIds('edit-company-feedback');

  if (!container) {
    return;
  }

  container.querySelectorAll('[data-company-action="edit"][data-company-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const companyId = button.getAttribute('data-company-id');
      const company = cachedCompanies.find((item) => item.id === companyId);

      if (!company) {
        return;
      }

      fillCompanyEditForm(company);
      showFeedback(feedbackElement, 'Empresa carregada para edição.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function submitEditCompanyForm(event) {
  event.preventDefault();

  const feedbackElement = getElementByIds('edit-company-feedback');
  const tenantId = getFieldValue('edit-company-tenant-id').trim();

  if (!tenantId) {
    showFeedback(feedbackElement, 'Selecione uma empresa para editar.', 'error');
    return;
  }

  const payload = {
    businessName: getFieldValue('edit-company-form-business-name', 'businessName').trim(),
    slug: getFieldValue('edit-company-form-slug', 'slug').trim(),
    whatsapp: getFieldValue('edit-company-form-whatsapp', 'whatsapp').trim(),
    subscriptionStatus: getFieldValue('edit-company-form-subscription-status', 'subscriptionStatus') || 'trial',
    planId: getFieldValue('edit-company-plan-select', 'company-admin-plan-id'),
    billingMode: getFieldValue('edit-company-form-billing-mode', 'billingMode') || 'free',
    fixedMonthlyPrice: Number(getFieldValue('edit-company-form-fixed-price', 'fixedMonthlyPrice') || 0),
    annualPrice: Number(getFieldValue('edit-company-form-annual-price', 'annualPrice') || 0),
    annualBillingMonth: Number(getFieldValue('edit-company-form-annual-billing-month', 'annualBillingMonth') || 0) || null,
    pricePerExecutedService: Number(getFieldValue('edit-company-form-price-per-service', 'pricePerExecutedService') || 0),
    publicPageEnabled: getFieldValue('edit-company-form-public-page-enabled', 'publicPageEnabled') === 'true',
    reportsEnabled: getFieldValue('edit-company-form-reports-enabled', 'reportsEnabled') === 'true',
    trialEndsAt: getFieldValue('edit-company-form-trial-ends-at', 'trialEndsAt') || null
  };

  try {
    await updateTenant(tenantId, payload);

    await saveBillingSettingsForTenant(tenantId, {
      tenantId,
      billingMode: payload.billingMode,
      fixedMonthlyPrice: payload.fixedMonthlyPrice,
      annualPrice: payload.annualPrice,
      annualBillingMonth: payload.annualBillingMonth,
      pricePerExecutedService: payload.pricePerExecutedService
    });

    await renderAdminCompaniesList();
    showFeedback(feedbackElement, 'Empresa atualizada com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(
      feedbackElement,
      error.message || 'Não foi possível atualizar a empresa.',
      'error'
    );
  }
}

function resetEditCompanyForm() {
  const form = getElementByIds('edit-company-form');
  form?.reset();
  setFieldValue('', 'edit-company-tenant-id');
}

function bindCompanyFilters() {
  [
    getElementByIds('companies-search-input', 'company-search-input'),
    getElementByIds('companies-plan-filter', 'company-plan-filter'),
    getElementByIds('companies-status-filter', 'company-status-filter'),
    getElementByIds('companies-billing-filter', 'company-billing-filter')
  ].forEach((element) => {
    element?.addEventListener('input', () => renderAdminCompaniesList());
    element?.addEventListener('change', () => renderAdminCompaniesList());
  });
}

function bindCompanyEditForm() {
  const form = getElementByIds('edit-company-form');
  const cancelButton = getElementByIds('cancel-company-edit-button');
  const feedbackElement = getElementByIds('edit-company-feedback');

  form?.addEventListener('submit', submitEditCompanyForm);

  cancelButton?.addEventListener('click', () => {
    resetEditCompanyForm();
    showFeedback(feedbackElement, 'Edição cancelada.', 'success');
  });
}

async function initAdminCompanies() {
  await populateCompanyPlanFilters();
  bindCompanyFilters();
  bindCompanyEditForm();
  await renderAdminCompaniesList();
}

initAdminCompanies();
