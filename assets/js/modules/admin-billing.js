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
import { getPlatformSettings } from '../services/admin-service.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

let cachedBillingRecords = [];
let cachedTenants = [];
let cachedPlatformSettings = null;

function getElementByIds(...ids) {
  for (const id of ids) {
    const element = document.getElementById(id);

    if (element) {
      return element;
    }
  }

  return null;
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

function toBillingServiceMonthRef(value) {
  return String(value || getCurrentMonthReference()).replace('-', '/');
}

function getMonthFilterValue() {
  const element = getElementByIds('billing-month-filter');
  return element?.value || getCurrentMonthReference();
}

function getStatusFilterValue() {
  return getElementByIds('billing-status-filter')?.value || '';
}

function getModeFilterValue() {
  return getElementByIds('billing-mode-filter')?.value || '';
}

function getSearchFilterValue() {
  return normalizeString(getElementByIds('billing-search-input')?.value || '').toLowerCase();
}

function setMonthFilterDefaultIfNeeded() {
  const element = getElementByIds('billing-month-filter');

  if (!element) {
    return;
  }

  if (!element.value) {
    element.value = getCurrentMonthReference();
  }
}

function getBillingFeedbackElement() {
  return getElementByIds('billing-feedback');
}

function getBillingListElement(elementId = 'billing-list') {
  return document.getElementById(elementId);
}

function getTenantMap() {
  return new Map(
    (Array.isArray(cachedTenants) ? cachedTenants : []).map((tenant) => [tenant.id, tenant])
  );
}

function resolveBillingTenant(record) {
  const tenantMap = getTenantMap();
  const tenantId = record?.tenantId || record?.companyId || record?.customerId || null;

  return tenantId ? tenantMap.get(tenantId) || null : null;
}

function resolveBillingRecordId(record) {
  return record?.id || '';
}

function resolveBillingReferenceMonth(record) {
  const raw = record?.referenceMonth || record?.monthReference || record?.billingMonth || record?.monthRef || record?.reference || '';
  const normalized = String(raw || '').trim().replace('/', '-');

  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  return normalized.slice(0, 7);
}

function resolveBillingStatus(record) {
  return String(record?.status || 'pending').trim().toLowerCase();
}

function resolveBillingMode(record, tenant) {
  return record?.billingMode || tenant?.billingMode || 'free';
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
    (resolveBillingStatus(record) === 'paid' ? resolveExpectedAmount(record) : 0),
    0
  );
}

function resolvePendingAmount(record) {
  const expected = resolveExpectedAmount(record);
  const paid = resolvePaidAmount(record);

  if (resolveBillingStatus(record) === 'paid') {
    return 0;
  }

  return Math.max(expected - paid, 0);
}

function resolveAnnualBillingMonth(record, tenant) {
  return record?.annualBillingMonth || tenant?.annualBillingMonth || null;
}

function resolveWhatsapp(record, tenant) {
  return tenant?.whatsapp || record?.companyWhatsappSnapshot || record?.whatsapp || '';
}

function buildDefaultBillingMessage(record, tenant) {
  const platformMessage = normalizeString(cachedPlatformSettings?.defaultBillingMessage, '');
  const businessName = tenant?.businessName || record?.companyNameSnapshot || 'sua empresa';
  const referenceMonth = resolveBillingReferenceMonth(record);
  const expectedAmount = formatCurrencyBRL(resolveExpectedAmount(record));
  const pendingAmount = formatCurrencyBRL(resolvePendingAmount(record));

  const fallbackMessage =
    `Olá! Segue a cobrança do HoraLivre para ${businessName}.\n` +
    `Referência: ${referenceMonth || '-'}\n` +
    `Valor total: ${expectedAmount}\n` +
    `Valor pendente: ${pendingAmount}`;

  return platformMessage
    ? `${platformMessage}\n\nEmpresa: ${businessName}\nReferência: ${referenceMonth || '-'}\nValor: ${expectedAmount}`
    : fallbackMessage;
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

function buildBillingCardHtml(record) {
  const tenant = resolveBillingTenant(record);
  const referenceMonth = resolveBillingReferenceMonth(record);
  const status = resolveBillingStatus(record);
  const billingMode = resolveBillingMode(record, tenant);
  const completedAppointments = resolveCompletedAppointments(record);
  const expectedAmount = resolveExpectedAmount(record);
  const paidAmount = resolvePaidAmount(record);
  const pendingAmount = resolvePendingAmount(record);
  const annualBillingMonth = resolveAnnualBillingMonth(record, tenant);
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
      <span><strong>Referência:</strong> ${referenceMonth || '-'}</span>
      <span><strong>Tipo:</strong> ${formatBillingMode(billingMode)}</span>
      <span><strong>WhatsApp:</strong> ${formatPhone(whatsapp || '-')}</span>
    </div>

    <div class="admin-compact-metrics-grid">
      <div class="admin-compact-metric">
        <span>Concluídos no mês</span>
        <strong>${completedAppointments}</strong>
      </div>
      <div class="admin-compact-metric">
        <span>Total previsto</span>
        <strong>${formatCurrencyBRL(expectedAmount)}</strong>
      </div>
      <div class="admin-compact-metric">
        <span>Total pago</span>
        <strong>${formatCurrencyBRL(paidAmount)}</strong>
      </div>
      <div class="admin-compact-metric">
        <span>Total pendente</span>
        <strong>${formatCurrencyBRL(pendingAmount)}</strong>
      </div>
    </div>

    <div class="admin-company-card-flags">
      <span class="admin-flag ${status === 'paid' ? 'on' : 'off'}">
        Status: ${getStatusBadgeText(status)}
      </span>
      <span class="admin-flag ${annualBillingMonth ? 'on' : 'off'}">
        Mês anual: ${annualBillingMonth ? formatMonthNumberToName(annualBillingMonth) : '-'}
      </span>
    </div>

    <div class="entity-card-actions">
      <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer">
        Cobrar no WhatsApp
      </a>
      <button type="button" data-billing-action="mark-paid" data-billing-id="${resolveBillingRecordId(record)}">
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
    const recordMonth = resolveBillingReferenceMonth(record);
    const recordStatus = resolveBillingStatus(record);
    const recordMode = resolveBillingMode(record, tenant);
    const searchableText = [
      tenant?.businessName || '',
      tenant?.slug || '',
      tenant?.whatsapp || '',
      record?.companyNameSnapshot || '',
      recordMonth
    ]
      .join(' ')
      .toLowerCase();

    const matchesMonth = !monthFilter || recordMonth === monthFilter;
    const matchesStatus = !statusFilter || recordStatus === statusFilter;
    const matchesMode = !modeFilter || recordMode === modeFilter;
    const matchesSearch = !searchFilter || searchableText.includes(searchFilter);

    return matchesMonth && matchesStatus && matchesMode && matchesSearch;
  });
}

function updateBillingTotals(records = []) {
  const expected = records.reduce(
    (total, record) => total + resolveExpectedAmount(record),
    0
  );

  const paid = records.reduce(
    (total, record) => total + resolvePaidAmount(record),
    0
  );

  const pending = records.reduce(
    (total, record) => total + resolvePendingAmount(record),
    0
  );

  const countAll = records.length;
  const countPending = records.filter((record) => resolveBillingStatus(record) === 'pending').length;
  const countPaid = records.filter((record) => resolveBillingStatus(record) === 'paid').length;

  const expectedElement = getElementByIds('billing-total-expected');
  const paidElement = getElementByIds('billing-total-paid');
  const pendingElement = getElementByIds('billing-total-pending');
  const countAllElement = getElementByIds('billing-count-all');
  const countPendingElement = getElementByIds('billing-count-pending');
  const countPaidElement = getElementByIds('billing-count-paid');

  if (expectedElement) {
    expectedElement.textContent = formatCurrencyBRL(expected);
  }

  if (paidElement) {
    paidElement.textContent = formatCurrencyBRL(paid);
  }

  if (pendingElement) {
    pendingElement.textContent = formatCurrencyBRL(pending);
  }

  if (countAllElement) {
    countAllElement.textContent = String(countAll);
  }

  if (countPendingElement) {
    countPendingElement.textContent = String(countPending);
  }

  if (countPaidElement) {
    countPaidElement.textContent = String(countPaid);
  }
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

async function safeListBillingRecords() {
  if (typeof billingService.listBillingRecords === 'function') {
    return billingService.listBillingRecords();
  }

  if (typeof billingService.listBillingRecordsByMonth === 'function') {
    return billingService.listBillingRecordsByMonth(toBillingServiceMonthRef(getMonthFilterValue()));
  }

  return [];
}

async function generateMissingMonthlyBilling() {
  const tenants = await listTenants();
  const monthReference = toBillingServiceMonthRef(getMonthFilterValue());

  for (const tenant of tenants) {
    const existing = cachedBillingRecords.find((record) => {
      const sameTenant = String(record.tenantId || '') === String(tenant.id || '');
      const sameMonth = String(record.monthRef || record.reference || '') === monthReference;
      return sameTenant && sameMonth;
    });

    if (existing) {
      continue;
    }

    await billingService.generateBillingRecordForTenant({
      tenantId: tenant.id,
      monthReference,
      billingMode: tenant.billingMode || 'free',
      completedAppointments: 0,
      fixedMonthlyPrice: tenant.fixedMonthlyPrice || 0,
      annualPrice: tenant.annualPrice || 0,
      annualBillingMonth: tenant.annualBillingMonth || null,
      pricePerExecutedService: tenant.pricePerExecutedService || 0,
      notes: `Cobrança gerada automaticamente para ${tenant.businessName || 'empresa'}`
    });
  }
}

async function safeGenerateCurrentMonthBilling() {
  if (typeof billingService.generateBillingForCurrentMonth === 'function') {
    return billingService.generateBillingForCurrentMonth();
  }

  if (typeof billingService.generateMonthlyBilling === 'function') {
    return billingService.generateMonthlyBilling(toBillingServiceMonthRef(getMonthFilterValue()));
  }

  if (typeof billingService.generateBillingForMonth === 'function') {
    return billingService.generateBillingForMonth(toBillingServiceMonthRef(getMonthFilterValue()));
  }

  if (typeof billingService.generateBillingRecordForTenant === 'function') {
    return generateMissingMonthlyBilling();
  }

  throw new Error('O billing-service.js não possui uma função de geração de cobrança compatível.');
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
    return billingService.updateBillingRecord(recordId, {
      status: 'paid'
    });
  }

  throw new Error('O billing-service.js não possui uma função para marcar cobrança como paga.');
}

function bindBillingActions(elementId = 'billing-list') {
  const container = getBillingListElement(elementId);
  const feedbackElement = getBillingFeedbackElement();

  if (!container) {
    return;
  }

  container
    .querySelectorAll('[data-billing-action="mark-paid"][data-billing-id]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        const recordId = button.getAttribute('data-billing-id');

        if (!recordId) {
          return;
        }

        try {
          await safeMarkBillingAsPaid(recordId);
          await loadBillingData();
          await renderAdminBillingList(elementId);
          window.dispatchEvent(new CustomEvent('horalivre:admin-data-changed'));

          if (feedbackElement) {
            showFeedback(feedbackElement, 'Cobrança marcada como paga.', 'success');
          }
        } catch (error) {
          console.error(error);

          if (feedbackElement) {
            showFeedback(
              feedbackElement,
              error.message || 'Não foi possível marcar a cobrança como paga.',
              'error'
            );
          }
        }
      });
    });

  container
    .querySelectorAll('[data-billing-action="open-company"][data-billing-tenant-id]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const tenantId = button.getAttribute('data-billing-tenant-id');

        if (!tenantId) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent('horalivre:open-admin-company', {
            detail: { tenantId }
          })
        );
      });
    });
}

async function loadBillingData() {
  const [records, tenants, platformSettings] = await Promise.all([
    safeListBillingRecords(),
    listTenants(),
    typeof getPlatformSettings === 'function'
      ? getPlatformSettings()
      : Promise.resolve(null)
  ]);

  cachedBillingRecords = Array.isArray(records) ? records : [];
  cachedTenants = Array.isArray(tenants) ? tenants : [];
  cachedPlatformSettings = platformSettings || null;
}

function bindBillingFilters() {
  [
    getElementByIds('billing-month-filter'),
    getElementByIds('billing-status-filter'),
    getElementByIds('billing-mode-filter'),
    getElementByIds('billing-search-input')
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
  const generateButton = getElementByIds('generate-billing-button');
  const reloadButton = getElementByIds('reload-billing-button');
  const feedbackElement = getBillingFeedbackElement();

  generateButton?.addEventListener('click', async () => {
    try {
      await safeGenerateCurrentMonthBilling();
      await loadBillingData();
      await renderAdminBillingList();
      window.dispatchEvent(new CustomEvent('horalivre:admin-data-changed'));

      if (feedbackElement) {
        showFeedback(feedbackElement, 'Cobrança do mês gerada com sucesso.', 'success');
      }
    } catch (error) {
      console.error(error);

      if (feedbackElement) {
        showFeedback(
          feedbackElement,
          error.message || 'Não foi possível gerar a cobrança do mês.',
          'error'
        );
      }
    }
  });

  reloadButton?.addEventListener('click', async () => {
    try {
      await loadBillingData();
      await renderAdminBillingList();

      if (feedbackElement) {
        showFeedback(feedbackElement, 'Cobrança recarregada com sucesso.', 'success');
      }
    } catch (error) {
      console.error(error);

      if (feedbackElement) {
        showFeedback(
          feedbackElement,
          error.message || 'Não foi possível recarregar a cobrança.',
          'error'
        );
      }
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

    const feedbackElement = getBillingFeedbackElement();

    if (feedbackElement) {
      showFeedback(
        feedbackElement,
        error.message || 'Não foi possível carregar o módulo de cobrança.',
        'error'
      );
    }
  }
}

initAdminBilling();