import { requireAdmin } from '../utils/guards.js';
import { logoutUser } from '../services/auth-service.js';
import {
  getAdminDashboardMetrics,
  getPlatformSettings
} from '../services/admin-service.js';
import { listTenants } from '../services/tenant-service.js';
import { listPlans, getPlanById } from '../services/plan-service.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  formatSubscriptionStatus
} from '../utils/formatters.js';
import {
  setText,
  clearElement,
  createListItem,
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

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

const logoutButton = document.getElementById('logout-button');
const tenantsTableBody = document.getElementById('tenants-table-body');
const plansList = document.getElementById('plans-list');
const generateMonthBillingButton = document.getElementById('generate-month-billing-button');
const reloadBillingButton = document.getElementById('reload-billing-button');
const billingFeedback = document.getElementById('billing-feedback');

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

async function loadPlans() {
  const plans = await listPlans();

  clearElement(plansList);

  if (plans.length === 0) {
    plansList.appendChild(createListItem(`
      <strong>Nenhum plano cadastrado</strong><br>
      Crie os planos do HoraLivre para começar a vincular aos seus clientes.
    `));
    return;
  }

  plans.forEach((plan) => {
    plansList.appendChild(createListItem(`
      <strong>${plan.name}</strong><br>
      Cobrança: ${formatBillingMode(plan.billingMode)}<br>
      Preço fixo: ${formatCurrencyBRL(plan.price || 0)}<br>
      Por serviço: ${formatCurrencyBRL(plan.pricePerExecutedService || 0)}<br>
      Página pública: ${plan.publicPageEnabled ? 'Sim' : 'Não'}<br>
      Relatórios: ${plan.reportsEnabled ? 'Sim' : 'Não'}
    `));
  });
}

async function init() {
  try {
    await Promise.all([
      loadMetrics(),
      loadSettings(),
      loadPlans()
    ]);

    await loadTenantsTable();
    await renderAdminBillingList();
  } catch (error) {
    console.error('Erro ao carregar o painel admin do HoraLivre:', error);
  }
}

init();