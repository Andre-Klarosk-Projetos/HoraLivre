import { requireAdmin } from '../utils/guards.js';
import {
  listPlans,
  createPlan,
  updatePlan
} from '../services/plan-service.js';
import {
  clearElement,
  createListItem,
  showFeedback
} from '../utils/dom-utils.js';
import {
  formatBillingMode,
  formatCurrencyBRL
} from '../utils/formatters.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

export async function renderAdminPlansList(elementId = 'plans-list') {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  const plans = await listPlans();

  clearElement(element);

  if (plans.length === 0) {
    element.appendChild(createListItem(`
      <strong>Nenhum plano cadastrado</strong><br>
      Crie o primeiro plano da plataforma.
    `));
    return;
  }

  plans.forEach((plan) => {
    const item = createListItem(`
      <strong>${plan.name}</strong><br>
      Cobrança: ${formatBillingMode(plan.billingMode)}<br>
      Preço fixo: ${formatCurrencyBRL(plan.price || 0)}<br>
      Por serviço: ${formatCurrencyBRL(plan.pricePerExecutedService || 0)}<br>
      Página pública: ${plan.publicPageEnabled ? 'Sim' : 'Não'}<br>
      Relatórios: ${plan.reportsEnabled ? 'Sim' : 'Não'}<br>
      Máx. serviços: ${plan.maxServices || 0}<br>
      Máx. clientes: ${plan.maxCustomers || 0}<br>
      Máx. agendamentos/mês: ${plan.maxAppointmentsMonth || 0}<br><br>
      <button class="button" type="button" data-plan-action="edit" data-plan-id="${plan.id}">
        Editar
      </button>
    `);

    element.appendChild(item);
  });

  bindPlanActions(plans, elementId);
}

function bindPlanActions(plans, elementId = 'plans-list') {
  const container = document.getElementById(elementId);
  const feedbackElement = document.getElementById('plan-feedback');

  if (!container) {
    return;
  }

  const buttons = container.querySelectorAll('[data-plan-action="edit"][data-plan-id]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const planId = button.getAttribute('data-plan-id');
      const plan = plans.find((item) => item.id === planId);

      if (!plan) {
        return;
      }

      fillPlanForm(plan);
      showFeedback(feedbackElement, 'Plano carregado para edição.', 'success');
    });
  });
}

export function fillPlanForm(plan) {
  document.getElementById('plan-edit-id').value = plan.id || '';
  document.getElementById('plan-form-name').value = plan.name || '';
  document.getElementById('plan-form-billing-mode').value = plan.billingMode || 'free';
  document.getElementById('plan-form-price').value = plan.price || 0;
  document.getElementById('plan-form-price-per-service').value = plan.pricePerExecutedService || 0;
  document.getElementById('plan-form-public-page-enabled').value = String(plan.publicPageEnabled !== false);
  document.getElementById('plan-form-reports-enabled').value = String(plan.reportsEnabled !== false);
  document.getElementById('plan-form-max-services').value = plan.maxServices || 0;
  document.getElementById('plan-form-max-customers').value = plan.maxCustomers || 0;
  document.getElementById('plan-form-max-appointments-month').value = plan.maxAppointmentsMonth || 0;
}

export function resetPlanForm() {
  const form = document.getElementById('plan-form');
  const editId = document.getElementById('plan-edit-id');

  form?.reset();

  if (editId) {
    editId.value = '';
  }

  document.getElementById('plan-form-billing-mode').value = 'free';
  document.getElementById('plan-form-public-page-enabled').value = 'true';
  document.getElementById('plan-form-reports-enabled').value = 'true';
}

export async function submitSavePlan(feedbackElement) {
  const editId = document.getElementById('plan-edit-id').value.trim();
  const name = document.getElementById('plan-form-name').value.trim();
  const billingMode = document.getElementById('plan-form-billing-mode').value;
  const price = Number(document.getElementById('plan-form-price').value || 0);
  const pricePerExecutedService = Number(document.getElementById('plan-form-price-per-service').value || 0);
  const publicPageEnabled = document.getElementById('plan-form-public-page-enabled').value === 'true';
  const reportsEnabled = document.getElementById('plan-form-reports-enabled').value === 'true';
  const maxServices = Number(document.getElementById('plan-form-max-services').value || 0);
  const maxCustomers = Number(document.getElementById('plan-form-max-customers').value || 0);
  const maxAppointmentsMonth = Number(document.getElementById('plan-form-max-appointments-month').value || 0);

  if (!name) {
    showFeedback(feedbackElement, 'Nome do plano é obrigatório.', 'error');
    return false;
  }

  const payload = {
    name,
    billingMode,
    price,
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
  return true;
}