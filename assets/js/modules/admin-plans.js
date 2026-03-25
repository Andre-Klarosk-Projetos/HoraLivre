import { requireAdmin } from '../utils/guards.js';
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan
} from '../services/plan-service.js';
import {
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  formatMonthNumberToName
} from '../utils/formatters.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

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

function getPlanForm() {
  return getElementByIds('plan-form');
}

function getPlanFeedbackElement() {
  return getElementByIds('plan-feedback');
}

function getPlanListElement(elementId = 'plans-list') {
  return document.getElementById(elementId);
}

function getPlanEditIdElement() {
  return getElementByIds('plan-edit-id');
}

function getFieldValue(...ids) {
  return getElementByIds(...ids)?.value ?? '';
}

function setFieldValue(value, ...ids) {
  const element = getElementByIds(...ids);

  if (!element) {
    return;
  }

  element.value = value ?? '';
}

function toBooleanString(value, fallback = 'false') {
  return value === 'true' ? 'true' : value === 'false' ? 'false' : fallback;
}

function refreshPlanBillingModeVisibility() {
  const billingMode = getFieldValue('plan-form-billing-mode', 'billingMode');

  const monthlyField = getElementByIds(
    'plan-form-price',
    'price'
  )?.closest('label');

  const annualPriceField = getElementByIds(
    'plan-form-annual-price',
    'annualPrice'
  )?.closest('label');

  const annualMonthField = getElementByIds(
    'plan-form-annual-billing-month',
    'annualBillingMonth'
  )?.closest('label');

  const perServiceField = getElementByIds(
    'plan-form-price-per-service',
    'pricePerExecutedService'
  )?.closest('label');

  const showMonthly = ['fixed', 'fixed_plus_per_service'].includes(billingMode);
  const showAnnual = billingMode === 'annual';
  const showPerService = ['per_service', 'fixed_plus_per_service'].includes(billingMode);

  if (monthlyField) {
    monthlyField.style.display = showMonthly ? '' : 'none';
  }

  if (annualPriceField) {
    annualPriceField.style.display = showAnnual ? '' : 'none';
  }

  if (annualMonthField) {
    annualMonthField.style.display = showAnnual ? '' : 'none';
  }

  if (perServiceField) {
    perServiceField.style.display = showPerService ? '' : 'none';
  }
}

function buildPlanCardHtml(plan) {
  return `
    <div class="entity-card-header">
      <div>
        <h3>${plan.name || '-'}</h3>
        <span class="entity-badge">
          ${formatBillingMode(plan.billingMode)}
        </span>
      </div>
    </div>

    <div class="entity-card-body">
      <p><strong>Descrição</strong><br>${plan.description || '-'}</p>
      <p><strong>Destaque na home</strong><br>${plan.featured || plan.highlighted ? 'Sim' : 'Não'}</p>
      <p><strong>Ordem</strong><br>${plan.displayOrder || 0}</p>
      <p><strong>Preço mensal</strong><br>${formatCurrencyBRL(plan.price || 0)}</p>
      <p><strong>Preço anual</strong><br>${formatCurrencyBRL(plan.annualPrice || 0)}</p>
      <p><strong>Mês anual</strong><br>${plan.annualBillingMonth ? formatMonthNumberToName(plan.annualBillingMonth) : '-'}</p>
      <p><strong>Preço por serviço</strong><br>${formatCurrencyBRL(plan.pricePerExecutedService || 0)}</p>
      <p><strong>Página pública</strong><br>${plan.publicPageEnabled === false ? 'Não' : 'Sim'}</p>
      <p><strong>Relatórios</strong><br>${plan.reportsEnabled === false ? 'Não' : 'Sim'}</p>
      <p><strong>Máx. serviços</strong><br>${plan.maxServices || 0}</p>
      <p><strong>Máx. clientes</strong><br>${plan.maxCustomers || 0}</p>
      <p><strong>Máx. agendamentos/mês</strong><br>${plan.maxAppointmentsMonth || 0}</p>
    </div>

    <div class="entity-card-actions">
      <button type="button" data-plan-action="edit" data-plan-id="${plan.id}">
        Editar
      </button>
      <button type="button" data-plan-action="delete" data-plan-id="${plan.id}">
        Excluir
      </button>
    </div>
  `;
}

export async function renderAdminPlansList(elementId = 'plans-list') {
  const element = getPlanListElement(elementId);

  if (!element) {
    return;
  }

  cachedPlans = await listPlans();

  clearElement(element);

  if (!cachedPlans.length) {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card empty-state-item';
    listItem.innerHTML = `
      <h3>Nenhum plano cadastrado</h3>
      <p>Crie o primeiro plano da plataforma.</p>
    `;
    element.appendChild(listItem);
    return;
  }

  cachedPlans.forEach((plan) => {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card';
    listItem.innerHTML = buildPlanCardHtml(plan);
    element.appendChild(listItem);
  });

  bindPlanActions(elementId);
}

function bindPlanActions(elementId = 'plans-list') {
  const container = getPlanListElement(elementId);
  const feedbackElement = getPlanFeedbackElement();

  if (!container) {
    return;
  }

  container.querySelectorAll('[data-plan-action][data-plan-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-plan-action');
      const planId = button.getAttribute('data-plan-id');
      const plan = cachedPlans.find((item) => item.id === planId);

      if (!plan) {
        return;
      }

      try {
        if (action === 'edit') {
          fillPlanForm(plan);
          showFeedback(feedbackElement, 'Plano carregado para edição.', 'success');
          return;
        }

        if (action === 'delete') {
          const shouldDelete = window.confirm(
            `Deseja excluir o plano "${plan.name}"?`
          );

          if (!shouldDelete) {
            return;
          }

          await deletePlan(planId);
          resetPlanForm();
          await renderAdminPlansList(elementId);

          showFeedback(feedbackElement, 'Plano excluído com sucesso.', 'success');
        }
      } catch (error) {
        console.error(error);
        showFeedback(
          feedbackElement,
          error.message || 'Não foi possível executar a ação no plano.',
          'error'
        );
      }
    });
  });
}

export function fillPlanForm(plan) {
  setFieldValue(plan.id || '', 'plan-edit-id');
  setFieldValue(plan.name || '', 'plan-form-name', 'name');
  setFieldValue(plan.description || '', 'plan-form-description', 'description');
  setFieldValue(
    String((plan.featured || plan.highlighted) === true),
    'plan-form-featured',
    'highlighted'
  );
  setFieldValue(plan.displayOrder || 0, 'plan-form-display-order', 'displayOrder');
  setFieldValue(plan.billingMode || 'free', 'plan-form-billing-mode', 'billingMode');
  setFieldValue(plan.price || 0, 'plan-form-price', 'price');
  setFieldValue(plan.annualPrice || 0, 'plan-form-annual-price', 'annualPrice');
  setFieldValue(
    plan.annualBillingMonth || '',
    'plan-form-annual-billing-month',
    'annualBillingMonth'
  );
  setFieldValue(
    plan.pricePerExecutedService || 0,
    'plan-form-price-per-service',
    'pricePerExecutedService'
  );
  setFieldValue(
    String(plan.publicPageEnabled !== false),
    'plan-form-public-page-enabled',
    'publicPageEnabled'
  );
  setFieldValue(
    String(plan.reportsEnabled !== false),
    'plan-form-reports-enabled',
    'reportsEnabled'
  );
  setFieldValue(plan.maxServices || 0, 'plan-form-max-services', 'maxServices');
  setFieldValue(plan.maxCustomers || 0, 'plan-form-max-customers', 'maxCustomers');
  setFieldValue(
    plan.maxAppointmentsMonth || 0,
    'plan-form-max-appointments-month',
    'maxAppointmentsPerMonth'
  );

  refreshPlanBillingModeVisibility();
}

export function resetPlanForm() {
  const form = getPlanForm();
  form?.reset();

  setFieldValue('', 'plan-edit-id');
  setFieldValue('false', 'plan-form-featured', 'highlighted');
  setFieldValue('free', 'plan-form-billing-mode', 'billingMode');
  setFieldValue('true', 'plan-form-public-page-enabled', 'publicPageEnabled');
  setFieldValue('true', 'plan-form-reports-enabled', 'reportsEnabled');
  setFieldValue('', 'plan-form-annual-billing-month', 'annualBillingMonth');

  refreshPlanBillingModeVisibility();
}

export async function submitSavePlan(feedbackElement = getPlanFeedbackElement()) {
  const editId = getFieldValue('plan-edit-id').trim();
  const name = getFieldValue('plan-form-name', 'name').trim();
  const description = getFieldValue('plan-form-description', 'description').trim();
  const featured = toBooleanString(
    getFieldValue('plan-form-featured', 'highlighted'),
    'false'
  ) === 'true';
  const displayOrder = Number(getFieldValue('plan-form-display-order', 'displayOrder') || 0);
  const billingMode = getFieldValue('plan-form-billing-mode', 'billingMode') || 'free';
  const price = Number(getFieldValue('plan-form-price', 'price') || 0);
  const annualPrice = Number(getFieldValue('plan-form-annual-price', 'annualPrice') || 0);
  const annualBillingMonth = Number(
    getFieldValue('plan-form-annual-billing-month', 'annualBillingMonth') || 0
  ) || null;
  const pricePerExecutedService = Number(
    getFieldValue('plan-form-price-per-service', 'pricePerExecutedService') || 0
  );
  const publicPageEnabled = toBooleanString(
    getFieldValue('plan-form-public-page-enabled', 'publicPageEnabled'),
    'true'
  ) === 'true';
  const reportsEnabled = toBooleanString(
    getFieldValue('plan-form-reports-enabled', 'reportsEnabled'),
    'true'
  ) === 'true';
  const maxServices = Number(getFieldValue('plan-form-max-services', 'maxServices') || 0);
  const maxCustomers = Number(getFieldValue('plan-form-max-customers', 'maxCustomers') || 0);
  const maxAppointmentsMonth = Number(
    getFieldValue('plan-form-max-appointments-month', 'maxAppointmentsPerMonth') || 0
  );

  if (!name) {
    showFeedback(feedbackElement, 'Nome do plano é obrigatório.', 'error');
    return false;
  }

  if (billingMode === 'annual' && !annualBillingMonth) {
    showFeedback(feedbackElement, 'Selecione o mês da cobrança anual.', 'error');
    return false;
  }

  const payload = {
    name,
    description,
    featured,
    highlighted: featured,
    displayOrder,
    billingMode,
    price,
    annualPrice,
    annualBillingMonth,
    pricePerExecutedService,
    publicPageEnabled,
    reportsEnabled,
    maxServices,
    maxCustomers,
    maxAppointmentsMonth
  };

  if (editId) {
    await updatePlan(editId, payload);
    showFeedback(feedbackElement, 'Plano atualizado com sucesso.', 'success');
  } else {
    await createPlan(payload);
    showFeedback(feedbackElement, 'Plano criado com sucesso.', 'success');
  }

  resetPlanForm();
  await renderAdminPlansList();

  return true;
}

function bindPlanForm() {
  const form = getPlanForm();
  const feedbackElement = getPlanFeedbackElement();
  const cancelButton = getElementByIds('plan-cancel-edit-button');
  const billingModeElement = getElementByIds('plan-form-billing-mode', 'billingMode');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await submitSavePlan(feedbackElement);
    } catch (error) {
      console.error(error);
      showFeedback(
        feedbackElement,
        error.message || 'Não foi possível salvar o plano.',
        'error'
      );
    }
  });

  cancelButton?.addEventListener('click', () => {
    resetPlanForm();
    showFeedback(feedbackElement, 'Edição de plano cancelada.', 'success');
  });

  billingModeElement?.addEventListener('change', refreshPlanBillingModeVisibility);
}

bindPlanForm();
resetPlanForm();
renderAdminPlansList();
