import { requireAdmin } from '../utils/guards.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  buildWhatsAppLink,
  formatPhone,
  formatMonthNumberToName
} from '../utils/formatters.js';
import {
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';
import * as billingService from '../services/billing-service.js';
import { listTenants } from '../services/tenant-service.js';
import { openAdminCompanyDetails } from './admin-tabs.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

let cachedBillingRecords = [];
let cachedTenants = [];

function getElement(id) {
  return document.getElementById(id);
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function getCurrentMonthReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function toMonthRef(value) {
  return String(value || getCurrentMonthReference()).replace('-', '/');
}

function getMonthFilterValue() {
  return getElement('billing-month-filter')?.value || getCurrentMonthReference();
}

function getStatusFilterValue() {
  return getElement('billing-status-filter')?.value || '';
}

function getModeFilterValue() {
  return getElement('billing-mode-filter')?.value || '';
}

function getSearchFilterValue() {
  return normalizeString(getElement('billing-search-input')?.value).toLowerCase();
}

function getFeedbackElement() {
  return getElement('billing-feedback');
}

function getBillingListElement(elementId = 'billing-list') {
  return document.getElementById(elementId);
}

function setMonthFilterDefaultIfNeeded() {
  const element = getElement('billing-month-filter');

  if (element && !element.value) {
    element.value = getCurrentMonthReference();
  }
}

function emitAdminDataChanged() {
  window.dispatchEvent(new CustomEvent('horalivre:admin-data-changed'));
}

function getTenantMap() {
  return new Map(cachedTenants.map((tenant) => [tenant.id, tenant]));
}

function resolveBillingTenant(record) {
  const tenantId = record?.tenantId || record?.companyId || null;
  const tenantMap = getTenantMap();

  return tenantId ? tenantMap.get(tenantId) || null : null;
}

function resolveRecordId(record) {
  return record?.id || '';
}

function resolveReferenceMonth(record) {
  const raw =
    record?.referenceMonth ||
    record?.monthReference ||
    record?.billingMonth ||
    record?.monthRef ||
    record?.reference ||
    '';

  return String(raw || '').trim().replace('/', '-').slice(0, 7);
}

function resolveReferenceLabel(record) {
  return (
    record?.referenceMonth ||
    record?.monthReference ||
    record?.billingMonth ||
    record?.monthRef ||
    record?.reference ||
    '-'
  );
}

function resolveStatus(record) {
  return String(record?.status || 'pending').trim().toLowerCase();
}

function normalizeBillingModeForService(value) {
  const raw = String(value || 'free').trim().toLowerCase();

  if (raw === 'fixed' || raw === 'fixed_plan' || raw === 'monthly_plan') {
    return 'fixed_plan';
  }

  if (raw === 'annual' || raw === 'annual_plan') {
    return 'annual_plan';
  }

  if (raw === 'per_service') {
    return 'per_service';
  }

  return 'free';
}

function resolveBillingMode(record, tenant) {
  return (
    record?.billingMode ||
    tenant?.billingMode ||
    'free'
  );
}

function resolveCompletedAppointments(record) {
  return normalizeNumber(
    record?.completedAppointments ??
      record?.completedServices ??
      record?.appointmentsCompleted ??
      0,
    0
  );
}

function resolveExpectedAmount(record) {
  return normalizeNumber(
    record?.amount ??
      record?.expectedAmount ??
      record?.totalAmount ??
      record?.grossAmount ??
      0,
    0
  );
}

function resolvePaidAmount(record) {
  return normalizeNumber(
    record?.paidAmount ??
      (resolveStatus(record) === 'paid' ? resolveExpectedAmount(record) : 0),
    0
  );
}

function resolvePendingAmount(record) {
  if (resolveStatus(record) === 'paid') {
    return 0;
  }

  return Math.max(resolveExpectedAmount(record) - resolvePaidAmount(record), 0);
}

function resolveAnnualBillingMonth(record, tenant) {
  return record?.annualBillingMonth || tenant?.annualBillingMonth || null;
}

function resolveWhatsapp(record, tenant) {
  return tenant?.whatsapp || record?.companyWhatsappSnapshot || record?.whatsapp || '';
}

function getStatusBadgeText(status) {
  if (status === 'paid') {
    return 'Pago';
  }

  if (status === 'pending') {
    return 'Pendente';
  }

  if (status === 'canceled') {
    return 'Cancelado';
  }

  return status || '-';
}

function getStatusBadgeClass(status) {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  if (status === 'canceled') {
    return 'danger';
  }

  return 'default';
}

function buildDefaultBillingMessage(record, tenant) {
  const businessName = tenant?.businessName || record?.companyNameSnapshot || 'sua empresa';
  const reference = resolveReferenceLabel(record);
  const expected = formatCurrencyBRL(resolveExpectedAmount(record));
  const pending = formatCurrencyBRL(resolvePendingAmount(record));

  return (
    `Olá! Segue a cobrança do HoraLivre.\n` +
    `Empresa: ${businessName}\n` +
    `Referência: ${reference}\n` +
    `Valor total: ${expected}\n` +
    `Valor pendente: ${pending}`
  );
}

function buildBillingCardHtml(record) {
  const tenant = resolveBillingTenant(record);
  const status = resolveStatus(record);
  const billingMode = resolveBillingMode(record, tenant);
  const whatsapp = resolveWhatsapp(record, tenant);
  const whatsappLink = buildWhatsAppLink(
    whatsapp,
    buildDefaultBillingMessage(record, tenant)
  );

  return `
    <div class="entity-card-header">
      <div>
        <h3>${tenant?.businessName || record?.companyNameSnapshot || 'Empresa não encontrada'}</h3>
        <span class="entity-badge entity-badge-${getStatusBadgeClass(status)}">
          ${getStatusBadgeText(status)}
        </span>
      </div>
    </div>

    <div class="admin-company-card-meta">
      <span><strong>Referência:</strong> ${resolveReferenceLabel(record)}</span>
      <span><strong>Tipo:</strong> ${formatBillingMode(billingMode)}</span>
      <span><strong>WhatsApp:</strong> ${formatPhone(whatsapp || '-')}</span>
    </div>

    <div class="admin-compact-metrics-grid">
      <div class="admin-compact-metric">
        <span>Concluídos no mês</span>
        <strong>${resolveCompletedAppointments(record)}</strong>
      </div>
      <div class="admin-compact-metric">
        <span>Total previsto</span>
        <strong>${formatCurrencyBRL(resolveExpectedAmount(record))}</strong>
      </div>
      <div class="admin-compact-metric">
        <span>Total pago</span>
        <strong>${formatCurrencyBRL(resolvePaidAmount(record))}</strong>
      </div>
      <div class="admin-compact-metric">
        <span>Total pendente</span>
        <strong>${formatCurrencyBRL(resolvePendingAmount(record))}</strong>
      </div>
    </div>

    <div class="admin-company-card-flags">
      <span class="admin-flag ${status === 'paid' ? 'on' : 'off'}">
        Status: ${getStatusBadgeText(status)}
      </span>
      <span class="admin-flag ${resolveAnnualBillingMonth(record, tenant) ? 'on' : 'off'}">
        Mês anual: ${
          resolveAnnualBillingMonth(record, tenant)
            ? formatMonthNumberToName(resolveAnnualBillingMonth(record, tenant))
            : '-'
        }
      </span>
    </div>

    <div class="entity-card-actions">
      <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer">
        Cobrar no WhatsApp
      </a>
      <button type="button" data-billing-action="mark-paid" data-billing-id="${resolveRecordId(record)}">
        Marcar como pago
      </button>
      <button type="button" data-billing-action="open-company" data-billing-tenant-id="${tenant?.id || ''}">
        Abrir empresa
      </button>
    </div>
  `;
}

function applyBillingFilters(records = []) {
  const monthFilter = getMonthFilterValue();
  const statusFilter = getStatusFilterValue();
  const modeFilter = getModeFilterValue();
  const searchFilter = getSearchFilterValue();

  return records.filter((record) => {
    const tenant = resolveBillingTenant(record);
    const searchableText = [
      tenant?.businessName || '',
      tenant?.slug || '',
      tenant?.whatsapp || '',
      record?.companyNameSnapshot || '',
      resolveReferenceLabel(record)
    ]
      .join(' ')
      .toLowerCase();

    const matchesMonth = !monthFilter || resolveReferenceMonth(record) === monthFilter;
    const matchesStatus = !statusFilter || resolveStatus(record) === statusFilter;
    const matchesMode = !modeFilter || normalizeBillingModeForService(resolveBillingMode(record, tenant)) === normalizeBillingModeForService(modeFilter);
    const matchesSearch = !searchFilter || searchableText.includes(searchFilter);

    return matchesMonth && matchesStatus && matchesMode && matchesSearch;
  });
}

function updateBillingTotals(records = []) {
  const expected = records.reduce((total, record) => total + resolveExpectedAmount(record), 0);
  const paid = records.reduce((total, record) => total + resolvePaidAmount(record), 0);
  const pending = records.reduce((total, record) => total + resolvePendingAmount(record), 0);

  const countAll = records.length;
  const countPending = records.filter((record) => resolveStatus(record) === 'pending').length;
  const countPaid = records.filter((record) => resolveStatus(record) === 'paid').length;

  const mappings = [
    ['billing-total-expected', formatCurrencyBRL(expected)],
    ['billing-total-paid', formatCurrencyBRL(paid)],
    ['billing-total-pending', formatCurrencyBRL(pending)],
    ['billing-count-all', String(countAll)],
    ['billing-count-pending', String(countPending)],
    ['billing-count-paid', String(countPaid)]
  ];

  mappings.forEach(([id, value]) => {
    const element = getElement(id);

    if (element) {
      element.textContent = value;
    }
  });
}

async function safeListBillingRecords() {
  if (typeof billingService.listBillingRecords === 'function') {
    return billingService.listBillingRecords();
  }

  if (typeof billingService.listBillingRecordsByMonth === 'function') {
    return billingService.listBillingRecordsByMonth(toMonthRef(getMonthFilterValue()));
  }

  return [];
}

async function generateMonthlyBillingFromTenants() {
  const tenants = await listTenants();
  const monthReference = toMonthRef(getMonthFilterValue());

  for (const tenant of tenants) {
    const existingRecord = cachedBillingRecords.find((record) => {
      return (
        String(record?.tenantId || '') === String(tenant?.id || '') &&
        String(record?.monthRef || record?.reference || '') === monthReference
      );
    });

    if (existingRecord) {
      continue;
    }

    await billingService.generateBillingRecordForTenant({
      tenantId: tenant.id,
      monthReference,
      billingMode: normalizeBillingModeForService(tenant.billingMode),
      completedAppointments: 0,
      fixedMonthlyPrice: normalizeNumber(tenant.fixedMonthlyPrice, 0),
      annualPrice: normalizeNumber(tenant.annualPrice, 0),
      annualBillingMonth: tenant.annualBillingMonth || null,
      pricePerExecutedService: normalizeNumber(tenant.pricePerExecutedService, 0),
      notes: `Cobrança gerada automaticamente para ${tenant.businessName || 'empresa'}`,
      companyNameSnapshot: tenant.businessName || '',
      companyWhatsappSnapshot: tenant.whatsapp || '',
      planIdSnapshot: tenant.planId || '',
      subscriptionStatusSnapshot: tenant.subscriptionStatus || ''
    });
  }
}

async function safeGenerateCurrentMonthBilling() {
  if (typeof billingService.generateBillingForCurrentMonth === 'function') {
    return billingService.generateBillingForCurrentMonth();
  }

  if (typeof billingService.generateMonthlyBilling === 'function') {
    return billingService.generateMonthlyBilling(toMonthRef(getMonthFilterValue()));
  }

  if (typeof billingService.generateBillingForMonth === 'function') {
    return billingService.generateBillingForMonth(toMonthRef(getMonthFilterValue()));
  }

  if (typeof billingService.generateBillingRecordForTenant === 'function') {
    return generateMonthlyBillingFromTenants();
  }

  throw new Error('O billing-service.js não possui uma função compatível para gerar cobrança.');
}

async function safeMarkBillingAsPaid(recordId) {
  if (!recordId) {
    throw new Error('Registro de cobrança inválido.');
  }

  if (typeof billingService.markBillingRecordAsPaid === 'function') {
    return billingService.markBillingRecordAsPaid(recordId);
  }

  if (typeof billingService.markBillingAsPaid === 'function') {
    return billingService.markBillingAsPaid(recordId);
  }

  if (typeof billingService.updateBillingRecord === 'function') {
    return billingService.updateBillingRecord(recordId, { status: 'paid' });
  }

  throw new Error('O billing-service.js não possui uma função compatível para marcar cobrança como paga.');
}

function bindBillingActions(elementId = 'billing-list') {
  const container = getBillingListElement(elementId);
  const feedbackElement = getFeedbackElement();

  if (!container) {
    return;
  }

  container.querySelectorAll('[data-billing-action="mark-paid"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const recordId = button.getAttribute('data-billing-id');

      if (!recordId) {
        return;
      }

      try {
        await safeMarkBillingAsPaid(recordId);
        await loadBillingData();
        await renderAdminBillingList();
        emitAdminDataChanged();
        showFeedback(feedbackElement, 'Cobrança marcada como paga.', 'success');
      } catch (error) {
        console.error(error);
        showFeedback(
          feedbackElement,
          error.message || 'Não foi possível marcar a cobrança como paga.',
          'error'
        );
      }
    });
  });

  container.querySelectorAll('[data-billing-action="open-company"]').forEach((button) => {
    button.addEventListener('click', () => {
      const tenantId = button.getAttribute('data-billing-tenant-id');

      if (!tenantId) {
        return;
      }

      openAdminCompanyDetails(tenantId);
    });
  });
}

export async function renderAdminBillingList(elementId = 'billing-list') {
  const element = getBillingListElement(elementId);

  if (!element) {
    return;
  }

  const filteredRecords = applyBillingFilters(cachedBillingRecords);

  clearElement(element);
  updateBillingTotals(filteredRecords);

  if (!filteredRecords.length) {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card empty-state-item';
    listItem.innerHTML = `
      <h3>Nenhum registro de cobrança encontrado</h3>
      <p>Ajuste os filtros ou gere a cobrança do mês atual.</p>
    `;
    element.appendChild(listItem);
    return;
  }

  filteredRecords.forEach((record) => {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card admin-compact-entity-card';
    listItem.innerHTML = buildBillingCardHtml(record);
    element.appendChild(listItem);
  });

  bindBillingActions(elementId);
}

async function loadBillingData() {
  const [records, tenants] = await Promise.all([
    safeListBillingRecords(),
    listTenants()
  ]);

  cachedBillingRecords = Array.isArray(records) ? records : [];
  cachedTenants = Array.isArray(tenants) ? tenants : [];
}

function bindBillingFilters() {
  [
    getElement('billing-month-filter'),
    getElement('billing-status-filter'),
    getElement('billing-mode-filter'),
    getElement('billing-search-input')
  ].forEach((element) => {
    element?.addEventListener('change', async () => {
      await renderAdminBillingList();
    });

    element?.addEventListener('input', async () => {
      await renderAdminBillingList();
    });
  });
}

function bindBillingButtons() {
  const generateButton = getElement('generate-billing-button');
  const reloadButton = getElement('reload-billing-button');
  const feedbackElement = getFeedbackElement();

  generateButton?.addEventListener('click', async () => {
    try {
      await safeGenerateCurrentMonthBilling();
      await loadBillingData();
      await renderAdminBillingList();
      emitAdminDataChanged();
      showFeedback(feedbackElement, 'Cobrança do mês gerada com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      showFeedback(
        feedbackElement,
        error.message || 'Não foi possível gerar a cobrança do mês.',
        'error'
      );
    }
  });

  reloadButton?.addEventListener('click', async () => {
    try {
      await loadBillingData();
      await renderAdminBillingList();
      showFeedback(feedbackElement, 'Cobrança recarregada com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      showFeedback(
        feedbackElement,
        error.message || 'Não foi possível recarregar a cobrança.',
        'error'
      );
    }
  });
}

async function initAdminBilling() {
  try {
    setMonthFilterDefaultIfNeeded();
    bindBillingFilters();
    bindBillingButtons();

    await loadBillingData();
    await renderAdminBillingList();

    window.addEventListener('horalivre:admin-data-changed', async () => {
      await loadBillingData();
      await renderAdminBillingList();
    });
  } catch (error) {
    console.error('Erro ao inicializar o módulo de cobrança.', error);

    const feedbackElement = getFeedbackElement();
    showFeedback(
      feedbackElement,
      error.message || 'Não foi possível carregar o módulo de cobrança.',
      'error'
    );
  }
}

initAdminBilling();