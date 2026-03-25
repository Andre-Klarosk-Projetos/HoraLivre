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

function getPlanCreateForm() {
  return getElementByIds('plan-create-form');
}

function getPlanEditForm() {
  return getElementByIds('plan-edit-form');
}

function getPlanCreateFeedbackElement() {
  return getElementByIds('plan-create-feedback');
}

function getPlanEditFeedbackElement() {
  return getElementByIds('plan-feedback');
}

function getPlanListElement(elementId = 'plans-list') {
  return document.getElementById(elementId);
}

function getPlanEditIdElement() {
  return getElementByIds('plan-edit-id');
}

function getPlanCreateField(name) {
  return getPlanCreateForm()?.querySelector(`[name="${name}"]`) || null;
}

function getPlanEditField(name) {
  return getPlanEditForm()?.querySelector(`[name="${name}"]`) || null;
}

function setPlanMode(mode) {
  const createButton = getElementByIds('plan-mode-create-button');
  const editButton = getElementByIds('plan-mode-edit-button');
  const createPanel = getElementByIds('plan-create-panel');
  const editPanel = getElementByIds('plan-edit-panel');

  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';

  createButton?.classList.toggle('active', isCreate);
  editButton?.classList.toggle('active', isEdit);

  if (createPanel) {
    createPanel.classList.toggle('active', isCreate);
    createPanel.hidden = !isCreate;
  }

  if (editPanel) {
    editPanel.classList.toggle('active', isEdit);
    editPanel.hidden = !isEdit;
  }
}

function getCreateFieldValue(name) {
  return getPlanCreateField(name)?.value ?? '';
}

function getEditFieldValue(name) {
  return getPlanEditField(name)?.value ?? '';
}

function setCreateFieldValue(name, value) {
  const field = getPlanCreateField(name);

  if (!field) {
    return;
  }

  field.value = value ?? '';
}

function setEditFieldValue(name, value) {
  const field = getPlanEditField(name);

  if (!field) {
    return;
  }

  field.value = value ?? '';
}

function toBooleanString(value, fallback = 'false') {
  return value === 'true' ? 'true' : value === 'false' ? 'false' : fallback;
}

function refreshPlanBillingModeVisibility(formElement) {
  if (!formElement) {
    return;
  }

  const billingMode = formElement.querySelector('[name="billingMode"]')?.value || 'free';

  const monthlyField = formElement.querySelector('[name="price"]')?.closest('label');
  const annualPriceField = formElement.querySelector('[name="annualPrice"]')?.closest('label');
  const perServiceField = formElement.querySelector('[name="pricePerExecutedService"]')?.closest('label');

  const showMonthly = ['fixed', 'fixed_plus_per_service'].includes(billingMode);
  const showAnnual = billingMode === 'annual';
  const showPerService = ['per_service', 'fixed_plus_per_service'].includes(billingMode);

  if (monthlyField) {
    monthlyField.style.display = showMonthly ? '' : 'none';
  }

  if (annualPriceField) {
    annualPriceField.style.display = showAnnual ? '' : 'none';
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
  const feedbackElement = getPlanEditFeedbackElement();

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
            fillPlanEditForm(plan);
            setPlanMode('edit');
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
            resetPlanEditForm();
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

function fillPlanEditForm(plan) {
  const editIdElement = getPlanEditIdElement();

  if (editIdElement) {
    editIdElement.value = plan.id || '';
  }

  setEditFieldValue('name', plan.name || '');
  setEditFieldValue('description', plan.description || '');
  setEditFieldValue('highlighted', String((plan.featured || plan.highlighted) === true));
  setEditFieldValue('displayOrder', plan.displayOrder || 0);
  setEditFieldValue('billingMode', plan.billingMode || 'free');
  setEditFieldValue('price', plan.price || 0);
  setEditFieldValue('annualPrice', plan.annualPrice || 0);
  setEditFieldValue('pricePerExecutedService', plan.pricePerExecutedService || 0);
  setEditFieldValue('publicPageEnabled', String(plan.publicPageEnabled !== false));
  setEditFieldValue('reportsEnabled', String(plan.reportsEnabled !== false));
  setEditFieldValue('maxServices', plan.maxServices || 0);
  setEditFieldValue('maxCustomers', plan.maxCustomers || 0);
  setEditFieldValue(
    'maxAppointmentsPerMonth',
    plan.maxAppointmentsMonth || plan.maxAppointmentsPerMonth || 0
  );

  refreshPlanBillingModeVisibility(getPlanEditForm());
}

function resetPlanCreateForm() {
  const form = getPlanCreateForm();

  form?.reset();
  setCreateFieldValue('highlighted', 'false');
  setCreateFieldValue('billingMode', 'free');
  setCreateFieldValue('publicPageEnabled', 'true');
  setCreateFieldValue('reportsEnabled', 'true');

  refreshPlanBillingModeVisibility(form);
}

function resetPlanEditForm() {
  const form = getPlanEditForm();

  form?.reset();

  const editIdElement = getPlanEditIdElement();

  if (editIdElement) {
    editIdElement.value = '';
  }

  setEditFieldValue('highlighted', 'false');
  setEditFieldValue('billingMode', 'free');
  setEditFieldValue('publicPageEnabled', 'true');
  setEditFieldValue('reportsEnabled', 'true');

  refreshPlanBillingModeVisibility(form);
}

async function submitCreatePlan(feedbackElement = getPlanCreateFeedbackElement()) {
  const name = getCreateFieldValue('name').trim();
  const description = getCreateFieldValue('description').trim();
  const highlighted = toBooleanString(getCreateFieldValue('highlighted'), 'false') === 'true';
  const displayOrder = Number(getCreateFieldValue('displayOrder') || 0);
  const billingMode = getCreateFieldValue('billingMode') || 'free';
  const price = Number(getCreateFieldValue('price') || 0);
  const annualPrice = Number(getCreateFieldValue('annualPrice') || 0);
  const pricePerExecutedService = Number(getCreateFieldValue('pricePerExecutedService') || 0);
  const publicPageEnabled = toBooleanString(getCreateFieldValue('publicPageEnabled'), 'true') === 'true';
  const reportsEnabled = toBooleanString(getCreateFieldValue('reportsEnabled'), 'true') === 'true';
  const maxServices = Number(getCreateFieldValue('maxServices') || 0);
  const maxCustomers = Number(getCreateFieldValue('maxCustomers') || 0);
  const maxAppointmentsMonth = Number(getCreateFieldValue('maxAppointmentsPerMonth') || 0);

  if (!name) {
    showFeedback(feedbackElement, 'Nome do plano é obrigatório.', 'error');
    return false;
  }

  await createPlan({
    name,
    description,
    featured: highlighted,
    highlighted,
    displayOrder,
    billingMode,
    price,
    annualPrice,
    pricePerExecutedService,
    publicPageEnabled,
    reportsEnabled,
    maxServices,
    maxCustomers,
    maxAppointmentsMonth
  });

  showFeedback(feedbackElement, 'Plano criado com sucesso.', 'success');
  resetPlanCreateForm();
  await renderAdminPlansList();

  return true;
}

async function submitEditPlan(feedbackElement = getPlanEditFeedbackElement()) {
  const editId = getPlanEditIdElement()?.value?.trim() || '';
  const name = getEditFieldValue('name').trim();
  const description = getEditFieldValue('description').trim();
  const highlighted = toBooleanString(getEditFieldValue('highlighted'), 'false') === 'true';
  const displayOrder = Number(getEditFieldValue('displayOrder') || 0);
  const billingMode = getEditFieldValue('billingMode') || 'free';
  const price = Number(getEditFieldValue('price') || 0);
  const annualPrice = Number(getEditFieldValue('annualPrice') || 0);
  const pricePerExecutedService = Number(getEditFieldValue('pricePerExecutedService') || 0);
  const publicPageEnabled = toBooleanString(getEditFieldValue('publicPageEnabled'), 'true') === 'true';
  const reportsEnabled = toBooleanString(getEditFieldValue('reportsEnabled'), 'true') === 'true';
  const maxServices = Number(getEditFieldValue('maxServices') || 0);
  const maxCustomers = Number(getEditFieldValue('maxCustomers') || 0);
  const maxAppointmentsMonth = Number(getEditFieldValue('maxAppointmentsPerMonth') || 0);

  if (!editId) {
    showFeedback(feedbackElement, 'Selecione um plano para editar.', 'error');
    return false;
  }

  if (!name) {
    showFeedback(feedbackElement, 'Nome do plano é obrigatório.', 'error');
    return false;
  }

  await updatePlan(editId, {
    name,
    description,
    featured: highlighted,
    highlighted,
    displayOrder,
    billingMode,
    price,
    annualPrice,
    pricePerExecutedService,
    publicPageEnabled,
    reportsEnabled,
    maxServices,
    maxCustomers,
    maxAppointmentsMonth
  });

  showFeedback(feedbackElement, 'Plano atualizado com sucesso.', 'success');
  resetPlanEditForm();
  setPlanMode('create');
  await renderAdminPlansList();

  return true;
}

function bindPlanModeSwitcher() {
  const createButton = getElementByIds('plan-mode-create-button');
  const editButton = getElementByIds('plan-mode-edit-button');

  createButton?.addEventListener('click', () => {
    setPlanMode('create');
  });

  editButton?.addEventListener('click', () => {
    setPlanMode('edit');
  });
}

function bindPlanForms() {
  const createForm = getPlanCreateForm();
  const editForm = getPlanEditForm();
  const cancelButton = getElementByIds('plan-cancel-edit-button');
  const createFeedback = getPlanCreateFeedbackElement();
  const editFeedback = getPlanEditFeedbackElement();

  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await submitCreatePlan(createFeedback);
    } catch (error) {
      console.error(error);
      showFeedback(
        createFeedback,
        error.message || 'Não foi possível criar o plano.',
        'error'
      );
    }
  });

  editForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await submitEditPlan(editFeedback);
    } catch (error) {
      console.error(error);
      showFeedback(
        editFeedback,
        error.message || 'Não foi possível salvar o plano.',
        'error'
      );
    }
  });

  cancelButton?.addEventListener('click', () => {
    resetPlanEditForm();
    setPlanMode('create');
    showFeedback(editFeedback, 'Edição de plano cancelada.', 'success');
  });

  getPlanCreateForm()?.querySelector('[name="billingMode"]')
    ?.addEventListener('change', () => refreshPlanBillingModeVisibility(getPlanCreateForm()));

  getPlanEditForm()?.querySelector('[name="billingMode"]')
    ?.addEventListener('change', () => refreshPlanBillingModeVisibility(getPlanEditForm()));
}

function initAdminPlans() {
  bindPlanModeSwitcher();
  bindPlanForms();
  resetPlanCreateForm();
  resetPlanEditForm();
  setPlanMode('create');
  renderAdminPlansList();
}

initAdminPlans();