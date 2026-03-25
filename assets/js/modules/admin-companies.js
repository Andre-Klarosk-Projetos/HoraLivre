import { requireAdmin } from '../utils/guards.js';
import {
  listTenants,
  updateTenant
} from '../services/tenant-service.js';
import {
  listPlans
} from '../services/plan-service.js';
import {
  saveBillingSettingsForTenant
} from '../services/billing-service.js';
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

function getCompaniesListElement(elementId = 'companies-list') {
  return document.getElementById(elementId);
}

function getNewCompanyFormElement() {
  return getElementByIds('new-company-form');
}

function getEditCompanyFormElement() {
  return getElementByIds('edit-company-form');
}

function getNewCompanyFeedbackElement() {
  return getElementByIds('new-company-feedback');
}

function getEditCompanyFeedbackElement() {
  return getElementByIds('edit-company-feedback');
}

function getEditCompanyCardElement() {
  const form = getEditCompanyFormElement();

  if (!form) {
    return null;
  }

  return form.closest('.admin-panel-card');
}

function getCompanyFilterState() {
  return {
    search: getElementByIds('companies-search-input', 'company-search-input')?.value?.trim()?.toLowerCase() || '',
    planId: getElementByIds('companies-plan-filter', 'company-plan-filter')?.value || '',
    status: getElementByIds('companies-status-filter', 'company-status-filter')?.value || '',
    billingMode: getElementByIds('companies-billing-filter', 'company-billing-filter')?.value || ''
  };
}

function getPlanName(planId) {
  return cachedPlans.find((plan) => plan.id === planId)?.name || planId || '-';
}

function normalizeBooleanString(value, fallback = 'false') {
  if (value === 'true') {
    return 'true';
  }

  if (value === 'false') {
    return 'false';
  }

  return fallback;
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

function scrollToEditCompanyForm() {
  const card = getEditCompanyCardElement();

  if (!card) {
    return;
  }

  card.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function resetEditCompanyForm() {
  const form = getEditCompanyFormElement();

  form?.reset();
  setFieldValue('', 'edit-company-tenant-id');

  const whatsappLink = getElementByIds('edit-company-whatsapp-link');

  if (whatsappLink) {
    whatsappLink.href = '#';
  }
}

function resetNewCompanyForm() {
  const form = getNewCompanyFormElement();

  form?.reset();

  setFieldValue('trial', 'new-company-form-subscription-status', 'subscriptionStatus');
  setFieldValue('free', 'new-company-form-billing-mode', 'billingMode');
  setFieldValue('true', 'new-company-form-public-page-enabled', 'publicPageEnabled');
  setFieldValue('true', 'new-company-form-reports-enabled', 'reportsEnabled');
}

function populatePlanSelect(selectElement, includePlaceholder = true) {
  if (!selectElement) {
    return;
  }

  selectElement.innerHTML = includePlaceholder
    ? '<option value="">Selecione um plano</option>'
    : '';

  cachedPlans.forEach((plan) => {
    const option = document.createElement('option');
    option.value = plan.id;
    option.textContent = plan.name || '-';
    selectElement.appendChild(option);
  });
}

export async function populateCompanyPlanFilters() {
  cachedPlans = await listPlans();

  populatePlanSelect(getElementByIds('new-company-plan-select'));
  populatePlanSelect(getElementByIds('edit-company-plan-select', 'company-admin-plan-id'));

  const planFilter = getElementByIds('companies-plan-filter', 'company-plan-filter');

  if (planFilter) {
    planFilter.innerHTML = '<option value="">Todos</option>';

    cachedPlans.forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name || '-';
      planFilter.appendChild(option);
    });
  }
}

function applyCompanyFilters(companies, filters) {
  return companies.filter((company) => {
    const searchableText = [
      company.businessName || '',
      company.slug || '',
      company.whatsapp || '',
      company.planId || ''
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = !filters.search || searchableText.includes(filters.search);
    const matchesPlan = !filters.planId || String(company.planId || '') === filters.planId;
    const matchesStatus = !filters.status || String(company.subscriptionStatus || '') === filters.status;
    const matchesBillingMode = !filters.billingMode || String(company.billingMode || '') === filters.billingMode;

    return matchesSearch && matchesPlan && matchesStatus && matchesBillingMode;
  });
}

function buildCompactMetric(label, value) {
  return `
    <div class="admin-compact-metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function buildCompanyCardHtml(company) {
  const publicLink = company.slug
    ? `./agendar.html?slug=${company.slug}`
    : '#';

  const whatsappLink = buildWhatsAppLink(
    company.whatsapp || '',
    `Olá ${company.businessName || ''}, estou entrando em contato pelo HoraLivre.`
  );

  return `
    <div class="entity-card-header">
      <div>
        <h3>${company.businessName || '-'}</h3>
        <span class="entity-badge">
          ${formatSubscriptionStatus(company.subscriptionStatus)}
        </span>
      </div>
    </div>

    <div class="admin-company-card-meta">
      <span><strong>Plano:</strong> ${getPlanName(company.planId)}</span>
      <span><strong>Cobrança:</strong> ${formatBillingMode(company.billingMode)}</span>
      <span><strong>Slug:</strong> ${company.slug || '-'}</span>
      <span><strong>WhatsApp:</strong> ${formatPhone(company.whatsapp || '-')}</span>
    </div>

    <div class="admin-compact-metrics-grid">
      ${buildCompactMetric('Mensal', formatCurrencyBRL(company.fixedMonthlyPrice || 0))}
      ${buildCompactMetric('Anual', formatCurrencyBRL(company.annualPrice || 0))}
      ${buildCompactMetric('Por serviço', formatCurrencyBRL(company.pricePerExecutedService || 0))}
      ${buildCompactMetric('Mês anual', company.annualBillingMonth ? formatMonthNumberToName(company.annualBillingMonth) : '-')}
    </div>

    <div class="admin-company-card-flags">
      <span class="admin-flag ${company.publicPageEnabled === false ? 'off' : 'on'}">
        Página pública: ${company.publicPageEnabled === false ? 'Não' : 'Sim'}
      </span>
      <span class="admin-flag ${company.reportsEnabled === false ? 'off' : 'on'}">
        Relatórios: ${company.reportsEnabled === false ? 'Não' : 'Sim'}
      </span>
      <span class="admin-flag ${company.isBlocked === true ? 'off' : 'on'}">
        Bloqueado: ${company.isBlocked === true ? 'Sim' : 'Não'}
      </span>
    </div>

    <div class="entity-card-actions">
      <button type="button" data-company-action="edit" data-company-id="${company.id}">
        Editar
      </button>
      <a href="${publicLink}" target="_blank" rel="noopener noreferrer">
        Página pública
      </a>
      <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
    </div>
  `;
}

export async function renderAdminCompaniesList(elementId = 'companies-list') {
  const element = getCompaniesListElement(elementId);

  if (!element) {
    return;
  }

  cachedCompanies = await listTenants();
  const filteredCompanies = applyCompanyFilters(cachedCompanies, getCompanyFilterState());

  clearElement(element);

  if (!filteredCompanies.length) {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card empty-state-item';
    listItem.innerHTML = `
      <h3>Nenhuma empresa encontrada</h3>
      <p>Ajuste a busca ou os filtros para localizar uma empresa cliente.</p>
    `;
    element.appendChild(listItem);
    return;
  }

  filteredCompanies.forEach((company) => {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card admin-compact-entity-card';
    listItem.innerHTML = buildCompanyCardHtml(company);
    element.appendChild(listItem);
  });

  bindCompanyActions(elementId);
}

function fillCompanyEditForm(company) {
  setFieldValue(company.id || '', 'edit-company-tenant-id');
  setFieldValue(company.businessName || '', 'businessName');
  setFieldValue(company.slug || '', 'slug');
  setFieldValue(company.whatsapp || '', 'whatsapp');
  setFieldValue(company.subscriptionStatus || 'trial', 'subscriptionStatus');
  setFieldValue(company.planId || '', 'edit-company-plan-select', 'company-admin-plan-id');
  setFieldValue(company.billingMode || 'free', 'billingMode');
  setFieldValue(company.fixedMonthlyPrice || 0, 'fixedMonthlyPrice');
  setFieldValue(company.annualPrice || 0, 'annualPrice');
  setFieldValue(company.annualBillingMonth || '', 'annualBillingMonth');
  setFieldValue(company.pricePerExecutedService || 0, 'pricePerExecutedService');
  setFieldValue(
    normalizeBooleanString(String(company.publicPageEnabled !== false), 'true'),
    'publicPageEnabled'
  );
  setFieldValue(
    normalizeBooleanString(String(company.reportsEnabled !== false), 'true'),
    'reportsEnabled'
  );
  setFieldValue(
    company.trialEndsAt ? String(company.trialEndsAt).slice(0, 10) : '',
    'trialEndsAt'
  );

  const whatsappLink = getElementByIds('edit-company-whatsapp-link');

  if (whatsappLink) {
    whatsappLink.href = buildWhatsAppLink(
      company.whatsapp || '',
      `Olá ${company.businessName || ''}, estou entrando em contato pelo HoraLivre.`
    );
  }
}

function openCompanyForEdit(companyId) {
  const company = cachedCompanies.find((item) => item.id === companyId);

  if (!company) {
    return;
  }

  fillCompanyEditForm(company);
  showFeedback(getEditCompanyFeedbackElement(), 'Empresa carregada para edição.', 'success');
  scrollToEditCompanyForm();
}

function bindCompanyActions(elementId = 'companies-list') {
  const container = getCompaniesListElement(elementId);

  if (!container) {
    return;
  }

  container
    .querySelectorAll('[data-company-action="edit"][data-company-id]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const companyId = button.getAttribute('data-company-id');

        if (!companyId) {
          return;
        }

        openCompanyForEdit(companyId);
      });
    });
}

async function submitEditCompanyForm(event) {
  event.preventDefault();

  const feedbackElement = getEditCompanyFeedbackElement();
  const tenantId = getFieldValue('edit-company-tenant-id').trim();

  if (!tenantId) {
    showFeedback(feedbackElement, 'Selecione uma empresa para editar.', 'error');
    return;
  }

  const payload = {
    businessName: getFieldValue('businessName').trim(),
    slug: getFieldValue('slug').trim(),
    whatsapp: getFieldValue('whatsapp').trim(),
    subscriptionStatus: getFieldValue('subscriptionStatus') || 'trial',
    planId: getFieldValue('edit-company-plan-select', 'company-admin-plan-id'),
    billingMode: getFieldValue('billingMode') || 'free',
    fixedMonthlyPrice: Number(getFieldValue('fixedMonthlyPrice') || 0),
    annualPrice: Number(getFieldValue('annualPrice') || 0),
    annualBillingMonth: Number(getFieldValue('annualBillingMonth') || 0) || null,
    pricePerExecutedService: Number(getFieldValue('pricePerExecutedService') || 0),
    publicPageEnabled: getFieldValue('publicPageEnabled') === 'true',
    reportsEnabled: getFieldValue('reportsEnabled') === 'true',
    trialEndsAt: getFieldValue('trialEndsAt') || null
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
  const form = getEditCompanyFormElement();
  const cancelButton = getElementByIds('cancel-company-edit-button');
  const feedbackElement = getEditCompanyFeedbackElement();

  form?.addEventListener('submit', submitEditCompanyForm);

  cancelButton?.addEventListener('click', () => {
    resetEditCompanyForm();
    showFeedback(feedbackElement, 'Edição cancelada.', 'success');
  });
}

function bindNewCompanyFormPlaceholder() {
  const form = getNewCompanyFormElement();
  const feedbackElement = getNewCompanyFeedbackElement();

  if (!form) {
    return;
  }

  form.addEventListener('submit', () => {
    if (feedbackElement && !feedbackElement.textContent?.trim()) {
      showFeedback(
        feedbackElement,
        'O formulário de criação está pronto para integração com o fluxo de cadastro completo.',
        'success'
      );
    }
  });
}

function bindOpenCompanyFromDashboardEvent() {
  window.addEventListener('horalivre:open-admin-company', async (event) => {
    const tenantId = event?.detail?.tenantId;

    if (!tenantId) {
      return;
    }

    if (!cachedCompanies.length) {
      await renderAdminCompaniesList();
    }

    openCompanyForEdit(tenantId);
  });
}

async function initAdminCompanies() {
  try {
    await populateCompanyPlanFilters();
    bindCompanyFilters();
    bindCompanyEditForm();
    bindNewCompanyFormPlaceholder();
    bindOpenCompanyFromDashboardEvent();
    resetNewCompanyForm();
    resetEditCompanyForm();
    await renderAdminCompaniesList();
  } catch (error) {
    console.error('Erro ao inicializar empresas do admin.', error);
  }
}

initAdminCompanies();
