import { requireAdmin } from '../utils/guards.js';
import { listTenants } from '../services/tenant-service.js';
import { listPlans } from '../services/plan-service.js';
import { listBillingRecords } from '../services/billing-service.js';
import { listAppointmentsByTenant } from '../services/appointment-service.js';
import { listCustomersByTenant } from '../services/customer-service.js';
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

function getDateOnly(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function daysBetween(dateA, dateB) {
  const oneDay = 24 * 60 * 60 * 1000;
  const first = new Date(dateA);
  const second = new Date(dateB);

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
    return 0;
  }

  return Math.floor((second.getTime() - first.getTime()) / oneDay);
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
  return new Map(plans.map((plan) => [plan.id, plan]));
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

function getStatusBadgeClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'active') {
    return 'success';
  }

  if (normalized === 'trial') {
    return 'warning';
  }

  if (normalized === 'blocked') {
    return 'danger';
  }

  return 'default';
}

function getBillingBadgeClass(mode) {
  const normalized = String(mode || '').toLowerCase();

  if (normalized === 'free') {
    return 'default';
  }

  if (normalized === 'fixed' || normalized === 'annual') {
    return 'success';
  }

  if (normalized === 'per_service' || normalized === 'fixed_plus_per_service') {
    return 'warning';
  }

  return 'default';
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
        <td>
          <span class="admin-table-pill neutral">
            ${row.planName}
          </span>
        </td>
        <td>
          <span class="admin-table-pill ${getBillingBadgeClass(row.billingMode)}">
            ${formatBillingMode(row.billingMode)}
          </span>
        </td>
        <td>
          <span class="admin-table-pill ${getStatusBadgeClass(row.subscriptionStatus)}">
            ${formatSubscriptionStatus(row.subscriptionStatus)}
          </span>
        </td>
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

function buildNotificationCardHtml(notification) {
  return `
    <article class="admin-notification-card ${notification.level}">
      <div class="admin-notification-header">
        <span class="admin-notification-badge">${notification.badge}</span>
        <strong>${notification.title}</strong>
      </div>
      <p>${notification.description}</p>
      ${notification.meta ? `<small>${notification.meta}</small>` : ''}
      ${
        notification.tenantId
          ? `
            <div class="admin-notification-actions">
              <button
                type="button"
                class="admin-secondary-button"
                data-dashboard-open-company="${notification.tenantId}"
              >
                Abrir empresa
              </button>
            </div>
          `
          : ''
      }
    </article>
  `;
}

function renderNotifications(notifications = []) {
  const container = document.getElementById('dashboard-notifications-list');

  if (!container) {
    return;
  }

  if (!notifications.length) {
    container.innerHTML = `
      <article class="admin-notification-card empty">
        <strong>Nenhuma notificação prioritária</strong>
        <span>A operação está sem alertas críticos no momento.</span>
      </article>
    `;
    return;
  }

  container.innerHTML = notifications
    .map((notification) => buildNotificationCardHtml(notification))
    .join('');

  container.querySelectorAll('[data-dashboard-open-company]').forEach((button) => {
    button.addEventListener('click', () => {
      const tenantId = button.getAttribute('data-dashboard-open-company');

      if (!tenantId) {
        return;
      }

      openAdminCompanyDetails(tenantId);
    });
  });
}

async function buildOperationalNotifications(tenants = [], billingRecords = []) {
  const today = new Date();
  const todayString = getDateOnly(today.toISOString());
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const notifications = [];
  let totalNewCustomers7d = 0;
  let totalNoAppointments = 0;

  const currentMonthBilling = filterCurrentMonthBilling(billingRecords);

  const pendingBilling = currentMonthBilling.filter(
    (record) => String(record.status || 'pending').toLowerCase() === 'pending'
  );

  const billingToday = currentMonthBilling.filter((record) => {
    const dueDate = getDateOnly(record.dueDate || record.dueAt || '');
    return dueDate && dueDate === todayString;
  });

  setText('dashboard-stat-pending-billing', String(pendingBilling.length));
  setText('dashboard-stat-billing-today', String(billingToday.length));

  pendingBilling.slice(0, 4).forEach((record) => {
    const tenantId = record.tenantId || record.companyId || null;
    const tenant = tenants.find((item) => item.id === tenantId);

    notifications.push({
      level: 'warning',
      badge: 'Cobrança pendente',
      title: tenant?.businessName || 'Empresa sem identificação',
      description: `Existe cobrança pendente na referência ${record.referenceMonth || getCurrentMonthReference()}.`,
      meta: `Valor pendente: ${formatCurrencyBRL(record.amount ?? record.expectedAmount ?? 0)}`,
      tenantId
    });
  });

  billingToday.slice(0, 3).forEach((record) => {
    const tenantId = record.tenantId || record.companyId || null;
    const tenant = tenants.find((item) => item.id === tenantId);

    notifications.push({
      level: 'info',
      badge: 'Cobrança do dia',
      title: tenant?.businessName || 'Empresa sem identificação',
      description: 'Existe cobrança com vencimento hoje.',
      meta: `Referência: ${record.referenceMonth || '-'} · Valor: ${formatCurrencyBRL(record.amount ?? record.expectedAmount ?? 0)}`,
      tenantId
    });
  });

  const tenantInsights = await Promise.all(
    tenants.map(async (tenant) => {
      const [appointments, customers] = await Promise.all([
        listAppointmentsByTenant(tenant.id),
        listCustomersByTenant(tenant.id)
      ]);

      const recentAppointments = appointments.filter((appointment) => {
        const startAt = appointment.startAt ? new Date(appointment.startAt) : null;

        return startAt && !Number.isNaN(startAt.getTime()) && startAt >= thirtyDaysAgo;
      });

      const newCustomers7d = customers.filter((customer) => {
        const createdAt = customer.createdAt ? new Date(customer.createdAt) : null;

        return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= sevenDaysAgo;
      });

      return {
        tenant,
        recentAppointmentsCount: recentAppointments.length,
        newCustomers7dCount: newCustomers7d.length
      };
    })
  );

  tenantInsights.forEach((item) => {
    totalNewCustomers7d += item.newCustomers7dCount;

    if (item.recentAppointmentsCount === 0) {
      totalNoAppointments += 1;

      notifications.push({
        level: 'danger',
        badge: 'Sem movimento',
        title: item.tenant.businessName || 'Empresa sem identificação',
        description: 'Esta empresa não teve agendamentos nos últimos 30 dias.',
        meta: `Status atual: ${formatSubscriptionStatus(item.tenant.subscriptionStatus)}`,
        tenantId: item.tenant.id
      });
    }

    if (item.newCustomers7dCount >= 3) {
      notifications.push({
        level: 'success',
        badge: 'Movimento de clientes',
        title: item.tenant.businessName || 'Empresa sem identificação',
        description: `A empresa cadastrou ${item.newCustomers7dCount} novos clientes nos últimos 7 dias.`,
        meta: 'Sinal positivo de tração operacional.',
        tenantId: item.tenant.id
      });
    }
  });

  setText('dashboard-stat-new-customers-7d', String(totalNewCustomers7d));
  setText('dashboard-stat-no-appointments', String(totalNoAppointments));

  return notifications
    .slice(0, 10);
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

    const safeTenants = Array.isArray(tenants) ? tenants : [];
    const safeBillingRecords = Array.isArray(billingRecords) ? billingRecords : [];
    const safePlans = Array.isArray(plans) ? plans : [];

    updateKpis({
      tenants: safeTenants,
      billingRecords: safeBillingRecords,
      plans: safePlans
    });

    const notifications = await buildOperationalNotifications(
      safeTenants,
      safeBillingRecords
    );

    renderNotifications(notifications);
  } catch (error) {
    console.error('Erro ao carregar o dashboard administrativo.', error);

    setText('dashboard-stat-tenants', '0');
    setText('dashboard-stat-trial', '0');
    setText('dashboard-stat-active', '0');
    setText('dashboard-stat-blocked', '0');
    setText('dashboard-stat-completed', '0');
    setText('dashboard-stat-revenue', formatCurrencyBRL(0));
    setText('dashboard-stat-new-customers-7d', '0');
    setText('dashboard-stat-no-appointments', '0');
    setText('dashboard-stat-pending-billing', '0');
    setText('dashboard-stat-billing-today', '0');

    renderTopTenantsTable([]);
    renderNotifications([]);
  }
}

bindQuickActions();
loadDashboard();
