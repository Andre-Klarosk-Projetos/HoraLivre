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

  const monthlyField = getElementByIds('plan-form-price', 'price')?.closest('label');
  const annualPriceField = getElementByIds('plan-form-annual-price', 'annualPrice')?.closest('label');
  const annualMonthField = getElementByIds('plan-form-annual-billing-month', 'annualBillingMonth')?.closest('label');
  const perServiceField = getElementByIds('plan-form-price-per-service', 'pricePerExecutedService')?.closest('label');

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

function buildPlanFlag(label, isEnabled) {
  return `
    <span class="admin-flag ${isEnabled ? 'on' : 'off'}">
      ${label}: ${isEnabled ? 'Sim' : 'Não'}
    </span>
  `;
}

function buildCompactMetric(label, value) {
  return `
    <div class="admin-compact-metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function buildPlanCardHtml(plan) {
  const isHighlighted = Boolean(plan.featured || plan.highlighted);

  return `
    <div class="entity-card-header">
      <div>
        <h3>${plan.name || '-'}</h3>
        <span class="entity-badge">
          ${formatBillingMode(plan.billingMode)}
        </span>
      </div>
    </div>

    <div class="admin-plan-card-meta">
      <span><strong>Descrição:</strong> ${plan.description || '-'}</span>
      <span><strong>Ordem:</strong> ${plan.displayOrder || 0}</span>
    </div>

    <div class="admin-compact-metrics-grid">
      ${buildCompactMetric('Mensal', formatCurrencyBRL(plan.price || 0))}
      ${buildCompactMetric('Anual', formatCurrencyBRL(plan.annualPrice || 0))}
      ${buildCompactMetric('Por serviço', formatCurrencyBRL(plan.pricePerExecutedService || 0))}
      ${buildCompactMetric('Mês anual', plan.annualBillingMonth ? formatMonthNumberToName(plan.annualBillingMonth) : '-')}
      ${buildCompactMetric('Máx. serviços', plan.maxServices || 0)}
      ${buildCompactMetric('Máx. clientes', plan.maxCustomers || 0)}
      ${buildCompactMetric('Máx. ag./mês', plan.maxAppointmentsMonth || plan.maxAppointmentsPerMonth || 0)}
    </div>

    <div class="admin-company-card-flags">
      ${buildPlanFlag('Destaque', isHighlighted)}
      ${buildPlanFlag('Página pública', plan.publicPageEnabled !== false)}
      ${buildPlanFlag('Relatórios', plan.reportsEnabled !== false)}
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
    listItem.className = 'entity-card admin-compact-entity-card';
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

  container
    .querySelectorAll('[data-plan-action][data-plan-id]')
    .forEach((button) => {
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
  setFieldValue(plan.name || '', 'name');
  setFieldValue(plan.description || '', 'description');
  setFieldValue(
    String((plan.featured || plan.highlighted) === true),
    'highlighted'
  );
  setFieldValue(plan.displayOrder || 0, 'displayOrder');
  setFieldValue(plan.billingMode || 'free', 'billingMode');
  setFieldValue(plan.price || 0, 'price');
  setFieldValue(plan.annualPrice || 0, 'annualPrice');
  setFieldValue(plan.annualBillingMonth || '', 'annualBillingMonth');
  setFieldValue(plan.pricePerExecutedService || 0, 'pricePerExecutedService');
  setFieldValue(String(plan.publicPageEnabled !== false), 'publicPageEnabled');
  setFieldValue(String(plan.reportsEnabled !== false), 'reportsEnabled');
  setFieldValue(plan.maxServices || 0, 'maxServices');
  setFieldValue(plan.maxCustomers || 0, 'maxCustomers');
  setFieldValue(
    plan.maxAppointmentsMonth || plan.maxAppointmentsPerMonth || 0,
    'maxAppointmentsPerMonth'
  );

  refreshPlanBillingModeVisibility();
}

export function resetPlanForm() {
  const form = getPlanForm();

  form?.reset();
  setFieldValue('', 'plan-edit-id');
  setFieldValue('false', 'highlighted');
  setFieldValue('free', 'billingMode');
  setFieldValue('true', 'publicPageEnabled');
  setFieldValue('true', 'reportsEnabled');
  setFieldValue('', 'annualBillingMonth');

  refreshPlanBillingModeVisibility();
}

export async function submitSavePlan(feedbackElement = getPlanFeedbackElement()) {
  const editId = getFieldValue('plan-edit-id').trim();
  const name = getFieldValue('name').trim();
  const description = getFieldValue('description').trim();
  const highlighted = toBooleanString(getFieldValue('highlighted'), 'false') === 'true';
  const displayOrder = Number(getFieldValue('displayOrder') || 0);
  const billingMode = getFieldValue('billingMode') || 'free';
  const price = Number(getFieldValue('price') || 0);
  const annualPrice = Number(getFieldValue('annualPrice') || 0);
  const annualBillingMonth = Number(getFieldValue('annualBillingMonth') || 0) || null;
  const pricePerExecutedService = Number(getFieldValue('pricePerExecutedService') || 0);
  const publicPageEnabled = toBooleanString(getFieldValue('publicPageEnabled'), 'true') === 'true';
  const reportsEnabled = toBooleanString(getFieldValue('reportsEnabled'), 'true') === 'true';
  const maxServices = Number(getFieldValue('maxServices') || 0);
  const maxCustomers = Number(getFieldValue('maxCustomers') || 0);
  const maxAppointmentsMonth = Number(getFieldValue('maxAppointmentsPerMonth') || 0);

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
    featured: highlighted,
    highlighted,
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
  const billingModeElement = getElementByIds('billingMode');

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

function initAdminPlans() {
  bindPlanForm();
  resetPlanForm();
  renderAdminPlansList();
}

initAdminPlans();
