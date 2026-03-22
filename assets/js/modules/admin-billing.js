import { requireAdmin } from '../utils/guards.js';
import { listTenants } from '../services/tenant-service.js';
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
  formatBillingMode
} from '../utils/formatters.js';
import {
  getMonthReference,
  getStartAndEndOfCurrentMonth
} from '../utils/date-utils.js';
import {
  clearElement,
  createListItem,
  showFeedback
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

export async function generateCurrentMonthBillingForAllTenants() {
  const tenants = await listTenants();
  const { startIso, endIso } = getStartAndEndOfCurrentMonth();
  const monthReference = getMonthReference();

  for (const tenant of tenants) {
    if (tenant.subscriptionStatus === 'blocked' || tenant.isBlocked === true) {
      continue;
    }

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

    await createOrReplaceBillingRecord(`billing_${monthReference}_${tenant.id}`, {
      tenantId: tenant.id,
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

  const records = await listBillingRecords();

  clearElement(element);

  if (records.length === 0) {
    element.appendChild(createListItem(`
      <strong>Nenhum registro de cobrança encontrado</strong><br>
      Gere a cobrança mensal para exibir os registros aqui.
    `));
    return;
  }

  records.forEach((record) => {
    const listItem = createListItem(`
      <strong>${record.monthRef}</strong><br>
      Tenant: ${record.tenantId}<br>
      Modo: ${formatBillingMode(record.billingMode)}<br>
      Concluídos salvos: ${record.completedAppointments || 0}<br>
      Valor salvo: ${formatCurrencyBRL(record.totalAmount || 0)}<br>
      Valor unitário: ${formatCurrencyBRL(record.unitPrice || 0)}<br>
      Valor fixo: ${formatCurrencyBRL(record.fixedAmount || 0)}<br>
      Status: ${record.status || '-'}<br>
      Identificador: ${record.id}<br><br>
      <div class="billing-actions">
        <button class="button primary" type="button" data-billing-id="${record.id}" data-billing-action="paid">
          Marcar como pago
        </button>
        <button class="button" type="button" data-billing-id="${record.id}" data-billing-action="pending">
          Voltar para pendente
        </button>
      </div>
    `);

    element.appendChild(listItem);
  });

  bindBillingActions(elementId);
}

function bindBillingActions(elementId = 'billing-list') {
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

      try {
        if (action === 'paid') {
          await markBillingRecordAsPaid(billingId);
          showFeedback(feedbackElement, 'Cobrança marcada como paga.', 'success');
        }

        if (action === 'pending') {
          await markBillingRecordAsPending(billingId);
          showFeedback(feedbackElement, 'Cobrança marcada como pendente.', 'success');
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