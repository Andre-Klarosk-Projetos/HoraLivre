import { requireAdmin } from '../utils/guards.js';
import { logoutUser } from '../services/auth-service.js';
import {
  getAdminDashboardMetrics,
  getPlatformSettings,
  savePlatformSettings
} from '../services/admin-service.js';
import { getPlanById } from '../services/plan-service.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  formatSubscriptionStatus
} from '../utils/formatters.js';
import {
  setText,
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';
import {
  countCompletedAppointments
} from '../services/appointment-service.js';
import {
  getStartAndEndOfCurrentMonth
} from '../utils/date-utils.js';
import {
  generateCurrentMonthBillingForAllTenants,
  renderAdminBillingList,
  bindBillingFilters
} from './admin-billing.js';
import {
  getBillingSettingsByTenant,
  calculateBillingForPeriod
} from '../services/billing-service.js';
import { bindAdminTabs, activateAdminTab } from './admin-tabs.js';
import {
  renderAdminPlansList,
  submitSavePlan,
  resetPlanForm
} from './admin-plans.js';
import {
  populateCompanyPlanFilters,
  renderAdminCompaniesList,
  submitSaveCompanyAdmin,
  resetCompanyAdminForm,
  bindCompanyFilters
} from './admin-companies.js';
import { listTenants } from '../services/tenant-service.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

const logoutButton = document.getElementById('logout-button');
const tenantsTableBody = document.getElementById('tenants-table-body');
const generateMonthBillingButton = document.getElementById('generate-month-billing-button');
const reloadBillingButton = document.getElementById('reload-billing-button');
const billingFeedback = document.getElementById('billing-feedback');

const platformSettingsForm = document.getElementById('platform-settings-form');
const settingsFeedback = document.getElementById('settings-feedback');

const planForm = document.getElementById('plan-form');
const planFeedback = document.getElementById('plan-feedback');
const planCancelEditButton = document.getElementById('plan-cancel-edit-button');

const companyAdminForm = document.getElementById('company-admin-form');
const companyAdminFeedback = document.getElementById('company-admin-feedback');
const companyAdminCancelEditButton = document.getElementById('company-admin-cancel-edit-button');

function resolveEffectiveBillingMode(company, billingSettings, plan) {
  return (
    billingSettings?.billingMode ||
    company?.billingMode ||
    plan?.billingMode ||
    'free'
  );
}

function resolveEffectiveFixedPrice(company, billingSettings, plan) {
  return Number(
    billingSettings?.fixedMonthlyPrice ??
    plan?.price ??
    company?.fixedMonthlyPrice ??
    0
  );
}

function resolveEffectiveUnitPrice(company, billingSettings, plan) {
  return Number(
    billingSettings?.pricePerExecutedService ??
    plan?.pricePerExecutedService ??
    company?.pricePerExecutedService ??
    0
  );
}

logoutButton?.addEventListener('click', async () => {
  await logoutUser();
  window.location.href = './login.html';
});

generateMonthBillingButton?.addEventListener('click', async () => {
  try {
    showFeedback(billingFeedback, 'Gerando cobrança do mês atual...', 'success');

    await generateCurrentMonthBillingForAllTenants();
    await loadMetrics();
    await loadCompaniesTable();
    await renderAdminBillingList();

    showFeedback(billingFeedback, 'Cobrança do mês atual gerada com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(
      billingFeedback,
      error.message || 'Não foi possível gerar a cobrança do mês atual.',
      'error'
    );
  }
});

reloadBillingButton?.addEventListener('click', async () => {
  try {
    await loadMetrics();
    await loadCompaniesTable();
    await renderAdminBillingList();

    showFeedback(billingFeedback, 'Cobrança recarregada com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(
      billingFeedback,
      error.message || 'Não foi possível recarregar a cobrança.',
      'error'
    );
  }
});

planCancelEditButton?.addEventListener('click', () => {
  resetPlanForm();
  showFeedback(planFeedback, 'Edição de plano cancelada.', 'success');
});

companyAdminCancelEditButton?.addEventListener('click', () => {
  resetCompanyAdminForm();
  showFeedback(companyAdminFeedback, 'Edição da empresa cancelada.', 'success');
});

planForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const success = await submitSavePlan(planFeedback);

    if (success) {
      await renderAdminPlansList();
      await populateCompanyPlanFilters();
      await renderAdminCompaniesList();
      await loadCompaniesTable();
    }
  } catch (error) {
    console.error(error);
    showFeedback(planFeedback, error.message || 'Não foi possível salvar o plano.', 'error');
  }
});

companyAdminForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const success = await submitSaveCompanyAdmin(companyAdminFeedback);

    if (success) {
      await renderAdminCompaniesList();
      await loadCompaniesTable();
      await loadMetrics();
    }
  } catch (error) {
    console.error(error);
    showFeedback(companyAdminFeedback, error.message || 'Não foi possível salvar a empresa.', 'error');
  }
});

platformSettingsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const platformName = document.getElementById('settings-platform-name')?.value?.trim() || '';
    const platformLogoUrl = document.getElementById('settings-platform-logo-url')?.value?.trim() || '';
    const publicDescription = document.getElementById('settings-public-description')?.value?.trim() || '';
    const supportWhatsapp = document.getElementById('settings-support-whatsapp')?.value?.trim() || '';
    const supportWhatsappMessage = document.getElementById('settings-support-message')?.value?.trim() || '';
    const whatsappBaseUrl = document.getElementById('settings-whatsapp-base-url')?.value?.trim() || '';
    const billingMessageTemplate = document.getElementById('settings-billing-message-template')?.value?.trim() || '';

    await savePlatformSettings({
      platformName,
      platformLogoUrl,
      publicDescription,
      supportWhatsapp,
      supportWhatsappMessage,
      whatsappBaseUrl,
      billingMessageTemplate
    });

    await loadSettings();
    showFeedback(settingsFeedback, 'Configurações salvas com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(settingsFeedback, error.message || 'Não foi possível salvar as configurações.', 'error');
  }
});

function bindQuickActions() {
  document.getElementById('quick-open-companies')?.addEventListener('click', () => {
    activateAdminTab('companies-tab');
  });

  document.getElementById('quick-open-plans')?.addEventListener('click', () => {
    activateAdminTab('plans-tab');
  });

  document.getElementById('quick-open-billing')?.addEventListener('click', () => {
    activateAdminTab('billing-tab');
  });

  document.getElementById('quick-generate-billing')?.addEventListener('click', async () => {
    generateMonthBillingButton?.click();
    activateAdminTab('billing-tab');
  });
}

async function loadMetrics() {
  const metrics = await getAdminDashboardMetrics();

  setText('stat-tenants', String(metrics.tenants));
  setText('stat-trial', String(metrics.trial));
  setText('stat-active', String(metrics.active));
  setText('stat-blocked', String(metrics.blocked));
  setText('stat-completed', String(metrics.completed));
  setText('stat-revenue', formatCurrencyBRL(metrics.revenue));
}

async function loadSettings() {
  const settings = await getPlatformSettings();

  setText('support-whatsapp', settings?.supportWhatsapp || '-');
  setText('support-message', settings?.supportWhatsappMessage || '-');
  setText('platform-name-view', settings?.platformName || '-');
  setText('platform-logo-url-view', settings?.platformLogoUrl || '-');
  setText('platform-public-description-view', settings?.publicDescription || '-');
  setText('platform-whatsapp-base-url-view', settings?.whatsappBaseUrl || '-');
  setText('platform-billing-template-view', settings?.billingMessageTemplate || '-');

  const platformNameInput = document.getElementById('settings-platform-name');
  const platformLogoUrlInput = document.getElementById('settings-platform-logo-url');
  const publicDescriptionInput = document.getElementById('settings-public-description');
  const supportWhatsappInput = document.getElementById('settings-support-whatsapp');
  const supportMessageInput = document.getElementById('settings-support-message');
  const whatsappBaseUrlInput = document.getElementById('settings-whatsapp-base-url');
  const billingMessageTemplateInput = document.getElementById('settings-billing-message-template');

  if (platformNameInput) {
    platformNameInput.value = settings?.platformName || '';
  }

  if (platformLogoUrlInput) {
    platformLogoUrlInput.value = settings?.platformLogoUrl || '';
  }

  if (publicDescriptionInput) {
    publicDescriptionInput.value = settings?.publicDescription || '';
  }

  if (supportWhatsappInput) {
    supportWhatsappInput.value = settings?.supportWhatsapp || '';
  }

  if (supportMessageInput) {
    supportMessageInput.value = settings?.supportWhatsappMessage || '';
  }

  if (whatsappBaseUrlInput) {
    whatsappBaseUrlInput.value = settings?.whatsappBaseUrl || '';
  }

  if (billingMessageTemplateInput) {
    billingMessageTemplateInput.value = settings?.billingMessageTemplate || '';
  }
}

async function loadCompaniesTable() {
  if (!tenantsTableBody) {
    return;
  }

  const companies = await listTenants();
  const { startIso, endIso } = getStartAndEndOfCurrentMonth();

  clearElement(tenantsTableBody);

  if (companies.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="6">Nenhuma empresa cliente cadastrada ainda.</td>
    `;
    tenantsTableBody.appendChild(row);
    return;
  }

  for (const company of companies) {
    const plan = company.planId ? await getPlanById(company.planId) : null;
    const billingSettings = await getBillingSettingsByTenant(company.id);
    const completedAppointments = await countCompletedAppointments(
      company.id,
      startIso,
      endIso
    );

    const effectiveBillingMode = resolveEffectiveBillingMode(
      company,
      billingSettings,
      plan
    );

    const effectiveFixedPrice = resolveEffectiveFixedPrice(
      company,
      billingSettings,
      plan
    );

    const effectiveUnitPrice = resolveEffectiveUnitPrice(
      company,
      billingSettings,
      plan
    );

    const totalAmount = calculateBillingForPeriod({
      billingMode: effectiveBillingMode,
      completedAppointments,
      fixedMonthlyPrice: effectiveFixedPrice,
      pricePerExecutedService: effectiveUnitPrice
    });

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${company.businessName || '-'}</td>
      <td>${plan?.name || company.planId || '-'}</td>
      <td>${formatBillingMode(effectiveBillingMode)}</td>
      <td>${formatSubscriptionStatus(company.subscriptionStatus)}</td>
      <td>${completedAppointments}</td>
      <td>${formatCurrencyBRL(totalAmount)}</td>
    `;

    tenantsTableBody.appendChild(row);
  }
}

async function init() {
  try {
    bindAdminTabs();
    bindQuickActions();
    bindBillingFilters();
    bindCompanyFilters(() => {
      renderAdminCompaniesList();
    });

    await Promise.all([
      loadMetrics(),
      loadSettings(),
      populateCompanyPlanFilters()
    ]);

    await loadCompaniesTable();
    await renderAdminCompaniesList();
    await renderAdminPlansList();
    await renderAdminBillingList();
  } catch (error) {
    console.error('Erro ao carregar o painel admin do HoraLivre:', error);
  }
}

init();