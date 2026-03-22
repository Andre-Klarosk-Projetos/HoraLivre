import { requireAdmin } from '../utils/guards.js';
import { logoutUser } from '../services/auth-service.js';
import {
  getAdminDashboardMetrics,
  getPlatformSettings,
  savePlatformSettings
} from '../services/admin-service.js';
import { listTenants } from '../services/tenant-service.js';
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
  renderAdminBillingList
} from './admin-billing.js';
import {
  getBillingSettingsByTenant,
  calculateBillingForPeriod
} from '../services/billing-service.js';
import { bindAdminTabs } from './admin-tabs.js';
import {
  renderAdminPlansList,
  submitSavePlan,
  resetPlanForm
} from './admin-plans.js';

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

function resolveEffectiveBillingMode(tenant, billingSettings, plan) {
  return (
    billingSettings?.billingMode ||
    tenant?.billingMode ||
    plan?.billingMode ||
    'free'
  );
}

function resolveEffectiveFixedPrice(tenant, billingSettings, plan) {
  return Number(
    billingSettings?.fixedMonthlyPrice ??
    plan?.price ??
    tenant?.fixedMonthlyPrice ??
    0
  );
}

function resolveEffectiveUnitPrice(tenant, billingSettings, plan) {
  return Number(
    billingSettings?.pricePerExecutedService ??
    plan?.pricePerExecutedService ??
    tenant?.pricePerExecutedService ??
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
    await loadTenantsTable();
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
    await loadTenantsTable();
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

planForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const success = await submitSavePlan(planFeedback);

    if (success) {
      await renderAdminPlansList();
      await loadTenantsTable();
    }
  } catch (error) {
    console.error(error);
    showFeedback(planFeedback, error.message || 'Não foi possível salvar o plano.', 'error');
  }
});

platformSettingsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const platformName = document.getElementById('settings-platform-name').value.trim();
    const platformLogoUrl = document.getElementById('settings-platform-logo-url').value.trim();
    const publicDescription = document.getElementById('settings-public-description').value.trim();
    const supportWhatsapp = document.getElementById('settings-support-whatsapp').value.trim();
    const supportWhatsappMessage = document.getElementById('settings-support-message').value.trim();
    const whatsappBaseUrl = document.getElementById('settings-whatsapp-base-url').value.trim();
    const billingMessageTemplate = document.getElementById('settings-billing-message-template').value.trim();

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

  document.getElementById('settings-platform-name').value = settings?.platformName || '';
  document.getElementById('settings-platform-logo-url').value = settings?.platformLogoUrl || '';
  document.getElementById('settings-public-description').value = settings?.publicDescription || '';
  document.getElementById('settings-support-whatsapp').value = settings?.supportWhatsapp || '';
  document.getElementById('settings-support-message').value = settings?.supportWhatsappMessage || '';
  document.getElementById('settings-whatsapp-base-url').value = settings?.whatsappBaseUrl || '';
  document.getElementById('settings-billing-message-template').value = settings?.billingMessageTemplate || '';
}

async function loadTenantsTable() {
  const tenants = await listTenants();
  const { startIso, endIso } = getStartAndEndOfCurrentMonth();

  clearElement(tenantsTableBody);

  if (tenants.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="6">Nenhum cliente da plataforma cadastrado ainda.</td>
    `;
    tenantsTableBody.appendChild(row);
    return;
  }

  for (const tenant of tenants) {
    const plan = tenant.planId ? await getPlanById(tenant.planId) : null;
    const billingSettings = await getBillingSettingsByTenant(tenant.id);
    const completedAppointments = await countCompletedAppointments(
      tenant.id,
      startIso,
      endIso
    );

    const effectiveBillingMode = resolveEffectiveBillingMode(
      tenant,
      billingSettings,
      plan
    );

    const effectiveFixedPrice = resolveEffectiveFixedPrice(
      tenant,
      billingSettings,
      plan
    );

    const effectiveUnitPrice = resolveEffectiveUnitPrice(
      tenant,
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
      <td>${tenant.businessName || '-'}</td>
      <td>${plan?.name || tenant.planId || '-'}</td>
      <td>${formatBillingMode(effectiveBillingMode)}</td>
      <td>${formatSubscriptionStatus(tenant.subscriptionStatus)}</td>
      <td>${completedAppointments}</td>
      <td>${formatCurrencyBRL(totalAmount)}</td>
    `;

    tenantsTableBody.appendChild(row);
  }
}

async function init() {
  try {
    bindAdminTabs();

    await Promise.all([
      loadMetrics(),
      loadSettings()
    ]);

    await loadTenantsTable();
    await renderAdminPlansList();
    await renderAdminBillingList();
  } catch (error) {
    console.error('Erro ao carregar o painel admin do HoraLivre:', error);
  }
}

init();