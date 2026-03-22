import { requireAdmin } from '../utils/guards.js';
import { listTenants } from '../services/tenant-service.js';
import { getPlatformSettings } from '../services/admin-service.js';
import {
  getBillingSettingsByTenant,
  calculateBillingForPeriod,
  createOrReplaceBillingRecord,
  listBillingRecords,
  markBillingRecordAsPaid,
  markBillingRecordAsPending
} from '../services/billing-service.js';
import {
  countCompletedAppointments
} from '../services/appointment-service.js';
import {
  formatCurrencyBRL,
  formatBillingMode,
  buildWhatsAppLink
} from '../utils/formatters.js';
import {
  getMonthReference,
  getStartAndEndOfCurrentMonth
} from '../utils/date-utils.js';
import {
  clearElement,
  createListItem,
  showFeedback,
  setText
} from '../utils/dom-utils.js';
import { getPlanById } from '../services/plan-service.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

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

function getBillingFilters() {
  return {
    monthRef: document.getElementById('billing-month-filter')?.value || '',
    status: document.getElementById('billing-status-filter')?.value || ''
  };
}

function normalizeMonthRefFromInput(value) {
  return String(value || '').replace('-', '/');
}

function applyBillingFilters(records, filters) {
  return records.filter((record) => {
    const matchesMonth = !filters.monthRef || String(record.monthRef || '') === filters.monthRef;
    const matchesStatus = !filters.status || String(record.status || '') === filters.status;
    return matchesMonth && matchesStatus;
  });
}

function updateBillingSummary(records) {
  const total = records.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const paid = records
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const pending = records
    .filter((item) => item.status !== 'paid')
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  setText('billing-summary-total', formatCurrencyBRL(total));
  setText('billing-summary-paid', formatCurrencyBRL(paid));
  setText('billing-summary-pending', formatCurrencyBRL(pending));
}

async function fillBillingMessagePanel(record) {
  const companies = await listTenants();
  const settings = await getPlatformSettings();
  const company = companies.find((item) => item.id === record.tenantId);

  const template = settings?.billingMessageTemplate || 'Olá! Sua cobrança do mês {{MES}} no valor de {{VALOR}} está disponível.';

  const message = template
    .replaceAll('{{MES}}', record.monthRef || '-')
    .replaceAll('{{VALOR}}', formatCurrencyBRL(record.totalAmount || 0))
    .replaceAll('{{EMPRESA}}', company?.businessName || '-')
    .replaceAll('{{CONCLUIDOS}}', String(record.completedAppointments || 0));

  document.getElementById('billing-message-company-name').value = company?.businessName || '';
  document.getElementById('billing-message-whatsapp').value = company?.whatsapp || '';
  document.getElementById('billing-message-month-ref').value = record.monthRef || '';
  document.getElementById('billing-message-text').value = message;

  const button = document.getElementById('billing-message-whatsapp-button');

  if (button) {
    button.href = buildWhatsAppLink(company?.whatsapp || '', message);
  }
}

export async function generateCurrentMonthBillingForAllTenants() {
  const companies = await listTenants();
  const { startIso, endIso } = getStartAndEndOfCurrentMonth();
  const monthReference = getMonthReference();

  for (const company of companies) {
    if (company.subscriptionStatus === 'blocked' || company.isBlocked === true) {
      continue;
    }

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

    await createOrReplaceBillingRecord(`billing_${monthReference}_${company.id}`, {
      tenantId: company.id,
      monthRef: monthReference,
      billingMode: effectiveBillingMode,
      completedAppointments,
      unitPrice: effectiveUnitPrice,
      fixedAmount: effectiveFixedPrice,
      totalAmount,
      status: 'pending',
      notes: ''
    });
  }
}

export async function renderAdminBillingList(elementId = 'billing-list') {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  const filters = getBillingFilters();
  const normalizedFilters = {
    monthRef: normalizeMonthRefFromInput(filters.monthRef),
    status: filters.status
  };

  const records = await listBillingRecords();
  const filteredRecords = applyBillingFilters(records, normalizedFilters);

  updateBillingSummary(filteredRecords);
  clearElement(element);

  if (filteredRecords.length === 0) {
    element.appendChild(createListItem(`
      <strong>Nenhum registro de cobrança encontrado</strong><br>
      Ajuste os filtros ou gere a cobrança mensal.
    `));
    return;
  }

  filteredRecords.forEach((record) => {
    const listItem = createListItem(`
      <strong>${record.monthRef}</strong><br>
      Empresa: ${record.tenantId}<br>
      Cobrança: ${formatBillingMode(record.billingMode)}<br>
      Concluídos salvos: ${record.completedAppointments || 0}<br>
      Valor salvo: ${formatCurrencyBRL(record.totalAmount || 0)}<br>
      Valor unitário: ${formatCurrencyBRL(record.unitPrice || 0)}<br>
      Valor fixo: ${formatCurrencyBRL(record.fixedAmount || 0)}<br>
      Status: ${record.status || '-'}<br><br>
      <div class="billing-actions">
        <button class="button primary" type="button" data-billing-id="${record.id}" data-billing-action="paid">
          Marcar como pago
        </button>
        <button class="button" type="button" data-billing-id="${record.id}" data-billing-action="pending">
          Voltar para pendente
        </button>
        <button class="button" type="button" data-billing-id="${record.id}" data-billing-action="message">
          Preparar mensagem
        </button>
      </div>
    `);

    element.appendChild(listItem);
  });

  bindBillingActions(elementId, filteredRecords);
}

function bindBillingActions(elementId = 'billing-list', records = []) {
  const container = document.getElementById(elementId);

  if (!container) {
    return;
  }

  const buttons = container.querySelectorAll('[data-billing-id][data-billing-action]');

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const billingId = button.getAttribute('data-billing-id');
      const action = button.getAttribute('data-billing-action');
      const feedbackElement = document.getElementById('billing-feedback');
      const record = records.find((item) => item.id === billingId);

      try {
        if (action === 'paid') {
          await markBillingRecordAsPaid(billingId);
          showFeedback(feedbackElement, 'Cobrança marcada como paga.', 'success');
        }

        if (action === 'pending') {
          await markBillingRecordAsPending(billingId);
          showFeedback(feedbackElement, 'Cobrança marcada como pendente.', 'success');
        }

        if (action === 'message' && record) {
          await fillBillingMessagePanel(record);
          showFeedback(feedbackElement, 'Mensagem de cobrança preparada.', 'success');
        }

        await renderAdminBillingList(elementId);
      } catch (error) {
        console.error(error);
        showFeedback(
          feedbackElement,
          error.message || 'Não foi possível atualizar a cobrança.',
          'error'
        );
      }
    });
  });
}

export function bindBillingFilters() {
  document.getElementById('billing-month-filter')?.addEventListener('change', () => {
    renderAdminBillingList();
  });

  document.getElementById('billing-status-filter')?.addEventListener('change', () => {
    renderAdminBillingList();
  });
}