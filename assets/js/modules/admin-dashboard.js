import { requireAdmin } from '../utils/guards.js';
import { listTenants } from '../services/tenant-service.js';
import { listPlans } from '../services/plan-service.js';
import { listBillingRecords } from '../services/billing-service.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  formatSubscriptionStatus
} from '../utils/formatters.js';
import {
  activateAdminTab,
  openAdminCompanyDetails
} from './admin-tabs.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = value;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCurrentMonthReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function filterCurrentMonthBilling(records = []) {
  const monthReference = getCurrentMonthReference();

  return records.filter((record) => String(record.referenceMonth || '') === monthReference);
}

function countByStatus(tenants = [], status) {
  return tenants.filter(
    (tenant) => String(tenant.subscriptionStatus || '').toLowerCase() === status
  ).length;
}

function buildPlansMap(plans = []) {
  return new Map(
    plans.map((plan) => [plan.id, plan])
  );
}

function resolvePlanName(planId, plansMap) {
  if (!planId) {
    return 'Sem plano';
  }

  return plansMap.get(planId)?.name || 'Plano não encontrado';
}

function buildTopTenantRows(tenants = [], currentMonthBilling = [], plans = []) {
  const billingMap = new Map();
  const plansMap = buildPlansMap(plans);

  currentMonthBilling.forEach((record) => {
    const tenantId = record.tenantId || record.companyId || record.customerId;

    if (!tenantId) {
      return;
    }

    billingMap.set(tenantId, record);
  });

  return tenants
    .map((tenant) => {
      const billingRecord = billingMap.get(tenant.id);

      return {
        id: tenant.id,
        businessName: tenant.businessName || '-',
        planName: resolvePlanName(tenant.planId, plansMap),
        billingMode: tenant.billingMode || billingRecord?.billingMode || '-',
        subscriptionStatus: tenant.subscriptionStatus || '-',
        completedThisMonth: normalizeNumber(
          billingRecord?.completedAppointments
            ?? billingRecord?.completedServices
            ?? 0,
          0
        ),
        amountThisMonth: normalizeNumber(
          billingRecord?.amount
            ?? billingRecord?.expectedAmount
            ?? billingRecord?.totalAmount
            ?? 0,
          0
        )
      };
    })
    .sort((a, b) => b.amountThisMonth - a.amountThisMonth)
    .slice(0, 8);
}

function renderTopTenantsTable(rows = []) {
  const tbody = document.getElementById('dashboard-top-tenants-table-body');

  if (!tbody) {
    return;
  }

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-table-empty">
          Nenhum dado disponível no momento.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((row) => `
      <tr>
        <td>
          <button
            type="button"
            class="admin-inline-link-button"
            data-dashboard-company-id="${row.id}"
            title="Abrir dados da empresa"
          >
            ${row.businessName}
          </button>
        </td>
        <td>${row.planName}</td>
        <td>${formatBillingMode(row.billingMode)}</td>
        <td>${formatSubscriptionStatus(row.subscriptionStatus)}</td>
        <td>${row.completedThisMonth}</td>
        <td>${formatCurrencyBRL(row.amountThisMonth)}</td>
      </tr>
    `)
    .join('');

  tbody.querySelectorAll('[data-dashboard-company-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const tenantId = button.getAttribute('data-dashboard-company-id');

      if (!tenantId) {
        return;
      }

      openAdminCompanyDetails(tenantId);
    });
  });
}

function updateKpis({ tenants, billingRecords, plans }) {
  const currentMonthBilling = filterCurrentMonthBilling(billingRecords);

  const expectedRevenue = currentMonthBilling.reduce(
    (total, record) =>
      total + normalizeNumber(
        record.amount ?? record.expectedAmount ?? record.totalAmount ?? 0,
        0
      ),
    0
  );

  const completedThisMonth = currentMonthBilling.reduce(
    (total, record) =>
      total + normalizeNumber(
        record.completedAppointments ?? record.completedServices ?? 0,
        0
      ),
    0
  );

  setText('dashboard-stat-tenants', String(tenants.length));
  setText('dashboard-stat-trial', String(countByStatus(tenants, 'trial')));
  setText('dashboard-stat-active', String(countByStatus(tenants, 'active')));
  setText('dashboard-stat-blocked', String(countByStatus(tenants, 'blocked')));
  setText('dashboard-stat-completed', String(completedThisMonth));
  setText('dashboard-stat-revenue', formatCurrencyBRL(expectedRevenue));

  renderTopTenantsTable(buildTopTenantRows(tenants, currentMonthBilling, plans));
}

function bindQuickActions() {
  document
    .querySelectorAll('[data-admin-tab-target]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-admin-tab-target');

        if (!tabId) {
          return;
        }

        activateAdminTab(tabId);
      });
    });

  const generateBillingButton = document.getElementById('dashboard-generate-billing-button');

  generateBillingButton?.addEventListener('click', () => {
    activateAdminTab('billing-tab');
    const targetButton = document.getElementById('generate-billing-button');
    targetButton?.focus();
  });
}

async function loadDashboard() {
  try {
    const [tenants, billingRecords, plans] = await Promise.all([
      listTenants(),
      listBillingRecords ? listBillingRecords() : Promise.resolve([]),
      listPlans ? listPlans() : Promise.resolve([])
    ]);

    updateKpis({
      tenants: Array.isArray(tenants) ? tenants : [],
      billingRecords: Array.isArray(billingRecords) ? billingRecords : [],
      plans: Array.isArray(plans) ? plans : []
    });
  } catch (error) {
    console.error('Erro ao carregar o dashboard administrativo.', error);

    setText('dashboard-stat-tenants', '0');
    setText('dashboard-stat-trial', '0');
    setText('dashboard-stat-active', '0');
    setText('dashboard-stat-blocked', '0');
    setText('dashboard-stat-completed', '0');
    setText('dashboard-stat-revenue', formatCurrencyBRL(0));

    renderTopTenantsTable([]);
  }
}

bindQuickActions();
loadDashboard();
