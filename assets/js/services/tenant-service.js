import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import {
  listServicesByTenant,
  createService,
  updateService,
  toggleServiceActive,
  deleteService
} from '../services/service-service.js';
import { formatCurrencyBRL } from '../utils/formatters.js';
import {
  required,
  isValidPrice,
  isValidDuration
} from '../utils/validators.js';
import {
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

function getServiceFormElement() {
  return document.getElementById('service-form');
}

function getServiceEditIdElement() {
  return document.getElementById('service-edit-id');
}

function getServiceFeedbackElement() {
  return document.getElementById('service-feedback');
}

function getServiceListElement(elementId = 'services-list') {
  return document.getElementById(elementId);
}

function getServiceStatusClassName(isActive) {
  return isActive ? 'active' : 'inactive';
}

function buildServiceCardHtml(service) {
  const statusClassName = getServiceStatusClassName(service.isActive);

  return `
    <div class="entity-card-header">
      <div>
        <h3>${service.name || '-'}</h3>
        <span class="service-status-badge service-status-${statusClassName}">
          ${service.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>
    </div>

    <div class="entity-card-body">
      <p><strong>Descrição</strong><br>${service.description || '-'}</p>
      <p><strong>Duração</strong><br>${service.durationMinutes || 0} min</p>
      <p><strong>Valor</strong><br>${formatCurrencyBRL(service.price || 0)}</p>
      <p><strong>Identificador</strong><br>${service.id}</p>
    </div>

    <div class="entity-card-actions">
      <button type="button" data-service-action="edit" data-service-id="${service.id}">
        Editar
      </button>
      <button type="button" data-service-action="toggle" data-service-id="${service.id}">
        ${service.isActive ? 'Desativar' : 'Ativar'}
      </button>
      <button type="button" data-service-action="delete" data-service-id="${service.id}">
        Excluir
      </button>
    </div>
  `;
}

export async function renderTenantServicesList(elementId = 'services-list') {
  const servicesListElement = getServiceListElement(elementId);

  if (!servicesListElement) {
    return;
  }

  const services = await listServicesByTenant(tenantId);

  clearElement(servicesListElement);

  if (!services.length) {
    const listItem = document.createElement('li');

    listItem.className = 'entity-card service-card-item empty-state-item';
    listItem.innerHTML = `
      <h3>Nenhum serviço cadastrado</h3>
      <p>Cadastre o primeiro serviço para usar na agenda e na página pública.</p>
    `;

    servicesListElement.appendChild(listItem);
    return;
  }

  services.forEach((service) => {
    const listItem = document.createElement('li');

    listItem.className = `entity-card service-card-item service-status-${getServiceStatusClassName(service.isActive)}`;
    listItem.innerHTML = buildServiceCardHtml(service);

    servicesListElement.appendChild(listItem);
  });

  bindServiceActions(services, elementId);
}

function bindServiceActions(services, elementId = 'services-list') {
  const container = getServiceListElement(elementId);
  const feedbackElement = getServiceFeedbackElement();

  if (!container) {
    return;
  }

  const buttons = container.querySelectorAll('[data-service-action][data-service-id]');

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-service-action');
      const serviceId = button.getAttribute('data-service-id');
      const service = services.find((item) => item.id === serviceId);

      if (!service) {
        return;
      }

      try {
        if (action === 'edit') {
          fillServiceForm(service);

          showFeedback(
            feedbackElement,
            'Serviço carregado para edição.',
            'success'
          );
          return;
        }

        if (action === 'toggle') {
          await toggleServiceActive(serviceId, !service.isActive);
          await renderTenantServicesList(elementId);

          showFeedback(
            feedbackElement,
            'Status do serviço atualizado com sucesso.',
            'success'
          );
          return;
        }

        if (action === 'delete') {
          const shouldDelete = window.confirm(
            `Deseja excluir o serviço "${service.name}"?`
          );

          if (!shouldDelete) {
            return;
          }

          await deleteService(serviceId);
          resetServiceForm();
          await renderTenantServicesList(elementId);

          showFeedback(
            feedbackElement,
            'Serviço excluído com sucesso.',
            'success'
          );
        }
      } catch (error) {
        console.error(error);

        showFeedback(
          feedbackElement,
          error.message || 'Não foi possível executar a ação no serviço.',
          'error'
        );
      }
    });
  });
}

export function fillServiceForm(service) {
  const form = getServiceFormElement();
  const editIdElement = getServiceEditIdElement();

  if (!form) {
    return;
  }

  if (editIdElement) {
    editIdElement.value = service.id || '';
  }

  const nameInput = form.querySelector('[name="name"]');
  const descriptionInput = form.querySelector('[name="description"]');
  const durationInput = form.querySelector('[name="durationMinutes"]');
  const priceInput = form.querySelector('[name="price"]');
  const isActiveInput = form.querySelector('[name="isActive"]');

  if (nameInput) {
    nameInput.value = service.name || '';
  }

  if (descriptionInput) {
    descriptionInput.value = service.description || '';
  }

  if (durationInput) {
    durationInput.value = service.durationMinutes || '';
  }

  if (priceInput) {
    priceInput.value = service.price || '';
  }

  if (isActiveInput) {
    isActiveInput.value = String(Boolean(service.isActive));
  }
}

export function resetServiceForm() {
  const form = getServiceFormElement();
  const editIdElement = getServiceEditIdElement();

  form?.reset();

  if (editIdElement) {
    editIdElement.value = '';
  }

  const isActiveInput = form?.querySelector('[name="isActive"]');

  if (isActiveInput && !isActiveInput.value) {
    isActiveInput.value = 'true';
  }
}

export async function submitSaveService(formElement, feedbackElement) {
  const formData = new FormData(formElement);

  const editId = getServiceEditIdElement()?.value?.trim() || '';
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const durationMinutes = Number(formData.get('durationMinutes') || 0);
  const price = Number(formData.get('price') || 0);
  const isActive = String(formData.get('isActive') || 'true') === 'true';

  if (!required(name)) {
    showFeedback(feedbackElement, 'Nome do serviço é obrigatório.', 'error');
    return false;
  }

  if (!isValidDuration(durationMinutes)) {
    showFeedback(feedbackElement, 'Duração inválida.', 'error');
    return false;
  }

  if (!isValidPrice(price)) {
    showFeedback(feedbackElement, 'Preço inválido.', 'error');
    return false;
  }

  if (editId) {
    await updateService(editId, {
      name,
      description,
      durationMinutes,
      price,
      isActive
    });

    showFeedback(
      feedbackElement,
      'Serviço atualizado com sucesso.',
      'success'
    );
  } else {
    await createService({
      tenantId,
      name,
      description,
      durationMinutes,
      price,
      isActive
    });

    showFeedback(
      feedbackElement,
      'Serviço criado com sucesso.',
      'success'
    );
  }

  resetServiceForm();
  return true;
}
