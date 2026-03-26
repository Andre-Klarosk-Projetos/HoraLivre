import { requireAdmin } from '../utils/guards.js';
import {
  createTenant,
  deleteTenant,
  listTenants,
  updateTenant,
  getTenantBySlug
} from '../services/tenant-service.js';
import {
  listPlans
} from '../services/plan-service.js';
import {
  saveBillingSettingsForTenant
} from '../services/billing-service.js';
import {
  createPendingTenantUserAccount,
  saveTenantUserProfile,
  finalizePendingTenantUserAccount,
  rollbackPendingTenantUserAccount
} from '../services/tenant-user-service.js';
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
  const panel = getElementByIds('company-edit-panel');

  if (!panel) {
    return null;
  }

  return panel.closest('.admin-panel-card');
}

function getEditFormField(name) {
  return getEditCompanyFormElement()?.querySelector(`[name="${name}"]`) || null;
}

function getNewFormField(name) {
  return getNewCompanyFormElement()?.querySelector(`[name="${name}"]`) || null;
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

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function setEditFieldValue(name, value) {
  const field = getEditFormField(name);

  if (!field) {
    return;
  }

  field.value = value ?? '';
}

function getEditFieldValue(name) {
  return getEditFormField(name)?.value ?? '';
}

function setNewFieldValue(name, value) {
  const field = getNewFormField(name);

  if (!field) {
    return;
  }

  field.value = value ?? '';
}

function getNewFieldValue(name) {
  return getNewFormField(name)?.value ?? '';
}

function emitAdminDataChanged() {
  window.dispatchEvent(new CustomEvent('horalivre:admin-data-changed'));
}

function setCompanyMode(mode) {
  const createButton = getElementByIds('company-mode-create-button');
  const editButton = getElementByIds('company-mode-edit-button');
  const createPanel = getElementByIds('company-create-panel');
  const editPanel = getElementByIds('company-edit-panel');

  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';

  createButton?.classList.toggle('active', isCreate);
  editButton?.classList.toggle('active', isEdit);

  if (createPanel) {
    createPanel.classList.toggle('active', isCreate);
    createPanel.hidden = !isCreate;
  }

  if (editPanel) {
    editPanel.classList.toggle('active', isEdit);
    editPanel.hidden = !isEdit;
  }
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

  const hiddenId = getElementByIds('edit-company-tenant-id');

  if (hiddenId) {
    hiddenId.value = '';
  }

  const whatsappLink = getElementByIds('edit-company-whatsapp-link');

  if (whatsappLink) {
    whatsappLink.href = '#';
  }
}

function resetNewCompanyForm() {
  const form = getNewCompanyFormElement();

  form?.reset();
  setNewFieldValue('subscriptionStatus', 'trial');
  setNewFieldValue('billingMode', 'free');
  setNewFieldValue('publicPageEnabled', 'true');
  setNewFieldValue('reportsEnabled', 'true');
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
  const hiddenId = getElementByIds('edit-company-tenant-id');

  if (hiddenId) {
    hiddenId.value = company.id || '';
  }

  setEditFieldValue('businessName', company.businessName || '');
  setEditFieldValue('slug', company.slug || '');
  setEditFieldValue('whatsapp', company.whatsapp || '');
  setEditFieldValue('subscriptionStatus', company.subscriptionStatus || 'trial');
  setEditFieldValue('planId', company.planId || '');
  setEditFieldValue('billingMode', company.billingMode || 'free');
  setEditFieldValue('fixedMonthlyPrice', company.fixedMonthlyPrice || 0);
  setEditFieldValue('annualPrice', company.annualPrice || 0);
  setEditFieldValue('annualBillingMonth', company.annualBillingMonth || '');
  setEditFieldValue('pricePerExecutedService', company.pricePerExecutedService || 0);
  setEditFieldValue(
    'publicPageEnabled',
    normalizeBooleanString(String(company.publicPageEnabled !== false), 'true')
  );
  setEditFieldValue(
    'reportsEnabled',
    normalizeBooleanString(String(company.reportsEnabled !== false), 'true')
  );
  setEditFieldValue(
    'trialEndsAt',
    company.trialEndsAt ? String(company.trialEndsAt).slice(0, 10) : ''
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
  setCompanyMode('edit');
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

async function validateNewTenantPayload(payload) {
  if (!payload.businessName) {
    throw new Error('Informe o nome da empresa.');
  }

  if (!payload.email) {
    throw new Error('Informe o e-mail de acesso da empresa.');
  }

  if (!payload.password || payload.password.length < 6) {
    throw new Error('A senha inicial deve ter pelo menos 6 caracteres.');
  }

  if (!payload.planId) {
    throw new Error('Selecione um plano para a empresa.');
  }

  if (!payload.slug) {
    throw new Error('Não foi possível gerar o slug da empresa.');
  }

  const tenantBySlug = await getTenantBySlug(payload.slug);

  if (tenantBySlug) {
    throw new Error('Já existe uma empresa usando este slug. Ajuste o slug e tente novamente.');
  }
}

async function submitNewCompanyForm(event) {
  event.preventDefault();

  const feedbackElement = getNewCompanyFeedbackElement();

  const businessName = getNewFieldValue('businessName').trim();
  const contactName = getNewFieldValue('contactName').trim();
  const email = getNewFieldValue('email').trim().toLowerCase();
  const password = getNewFieldValue('password').trim();
  const slug = slugify(getNewFieldValue('slug').trim() || businessName);

  const payload = {
    businessName,
    contactName,
    email,
    password,
    slug,
    whatsapp: getNewFieldValue('whatsapp').trim(),
    planId: getNewFieldValue('planId'),
    subscriptionStatus: getNewFieldValue('subscriptionStatus') || 'trial',
    billingMode: getNewFieldValue('billingMode') || 'free',
    fixedMonthlyPrice: Number(getNewFieldValue('fixedMonthlyPrice') || 0),
    annualPrice: Number(getNewFieldValue('annualPrice') || 0),
    annualBillingMonth: Number(getNewFieldValue('annualBillingMonth') || 0) || null,
    pricePerExecutedService: Number(getNewFieldValue('pricePerExecutedService') || 0),
    publicPageEnabled: getNewFieldValue('publicPageEnabled') === 'true',
    reportsEnabled: getNewFieldValue('reportsEnabled') === 'true',
    trialEndsAt: getNewFieldValue('trialEndsAt') || null
  };

  let createdTenantRef = null;
  let createdTenantUserUid = null;

  try {
    await validateNewTenantPayload(payload);

    showFeedback(feedbackElement, 'Criando tenant...', 'success');

    createdTenantRef = await createTenant({
      businessName: payload.businessName,
      contactName: payload.contactName,
      ownerEmail: payload.email,
      slug: payload.slug,
      whatsapp: payload.whatsapp,
      planId: payload.planId,
      billingMode: payload.billingMode,
      fixedMonthlyPrice: payload.fixedMonthlyPrice,
      annualPrice: payload.annualPrice,
      annualBillingMonth: payload.annualBillingMonth,
      pricePerExecutedService: payload.pricePerExecutedService,
      subscriptionStatus: payload.subscriptionStatus,
      publicPageEnabled: payload.publicPageEnabled,
      reportsEnabled: payload.reportsEnabled,
      trialEndsAt: payload.trialEndsAt
    });

    const createdAuthUser = await createPendingTenantUserAccount({
      email: payload.email,
      password: payload.password
    });

    createdTenantUserUid = createdAuthUser.uid;

    await saveTenantUserProfile(createdTenantUserUid, {
      tenantId: createdTenantRef.id,
      email: createdAuthUser.email,
      name: payload.contactName || payload.businessName,
      contactName: payload.contactName,
      businessName: payload.businessName,
      whatsapp: payload.whatsapp
    });

    await updateTenant(createdTenantRef.id, {
      ownerUid: createdTenantUserUid,
      ownerEmail: createdAuthUser.email,
      contactName: payload.contactName,
      slug: payload.slug
    });

    await saveBillingSettingsForTenant(createdTenantRef.id, {
      tenantId: createdTenantRef.id,
      billingMode: payload.billingMode,
      fixedMonthlyPrice: payload.fixedMonthlyPrice,
      annualPrice: payload.annualPrice,
      annualBillingMonth: payload.annualBillingMonth,
      pricePerExecutedService: payload.pricePerExecutedService
    });

    await finalizePendingTenantUserAccount();

    resetNewCompanyForm();
    await renderAdminCompaniesList();
    emitAdminDataChanged();

    showFeedback(
      feedbackElement,
      'Empresa cliente criada com sucesso. O acesso do cliente já está habilitado.',
      'success'
    );

    openCompanyForEdit(createdTenantRef.id);
  } catch (error) {
    console.error(error);

    if (createdTenantUserUid) {
      await rollbackPendingTenantUserAccount(createdTenantUserUid);
    }

    if (createdTenantRef?.id) {
      try {
        await deleteTenant(createdTenantRef.id);
      } catch (rollbackError) {
        console.error('Falha ao desfazer criação do tenant.', rollbackError);
      }
    }

    showFeedback(
      feedbackElement,
      error.message || 'Não foi possível criar a empresa cliente.',
      'error'
    );
  }
}

async function submitEditCompanyForm(event) {
  event.preventDefault();

  const feedbackElement = getEditCompanyFeedbackElement();
  const tenantId = getElementByIds('edit-company-tenant-id')?.value?.trim() || '';

  if (!tenantId) {
    showFeedback(feedbackElement, 'Selecione uma empresa para editar.', 'error');
    return;
  }

  const payload = {
    businessName: getEditFieldValue('businessName').trim(),
    slug: slugify(getEditFieldValue('slug').trim()),
    whatsapp: getEditFieldValue('whatsapp').trim(),
    subscriptionStatus: getEditFieldValue('subscriptionStatus') || 'trial',
    planId: getEditFieldValue('planId'),
    billingMode: getEditFieldValue('billingMode') || 'free',
    fixedMonthlyPrice: Number(getEditFieldValue('fixedMonthlyPrice') || 0),
    annualPrice: Number(getEditFieldValue('annualPrice') || 0),
    annualBillingMonth: Number(getEditFieldValue('annualBillingMonth') || 0) || null,
    pricePerExecutedService: Number(getEditFieldValue('pricePerExecutedService') || 0),
    publicPageEnabled: getEditFieldValue('publicPageEnabled') === 'true',
    reportsEnabled: getEditFieldValue('reportsEnabled') === 'true',
    trialEndsAt: getEditFieldValue('trialEndsAt') || null
  };

  try {
    if (!payload.businessName) {
      throw new Error('Informe o nome da empresa.');
    }

    if (!payload.slug) {
      throw new Error('Informe um slug válido para a empresa.');
    }

    const tenantBySlug = await getTenantBySlug(payload.slug);

    if (tenantBySlug && tenantBySlug.id !== tenantId) {
      throw new Error('Já existe outra empresa usando este slug.');
    }

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
    emitAdminDataChanged();

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
    setCompanyMode('create');
    showFeedback(feedbackElement, 'Edição cancelada.', 'success');
  });
}

function bindCompanyCreateForm() {
  const form = getNewCompanyFormElement();

  form?.addEventListener('submit', submitNewCompanyForm);
}

function bindCompanyModeSwitcher() {
  const createButton = getElementByIds('company-mode-create-button');
  const editButton = getElementByIds('company-mode-edit-button');

  createButton?.addEventListener('click', () => {
    setCompanyMode('create');
  });

  editButton?.addEventListener('click', () => {
    setCompanyMode('edit');
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
    bindCompanyCreateForm();
    bindCompanyModeSwitcher();
    bindOpenCompanyFromDashboardEvent();
    resetNewCompanyForm();
    resetEditCompanyForm();
    setCompanyMode('create');
    await renderAdminCompaniesList();
  } catch (error) {
    console.error('Erro ao inicializar empresas do admin.', error);
  }
}

initAdminCompanies();
