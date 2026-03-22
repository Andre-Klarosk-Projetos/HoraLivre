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

export async function renderTenantServicesList(elementId = 'services-list') {
  const servicesListElement = document.getElementById(elementId);

  if (!servicesListElement) {
    return;
  }

  const services = await listServicesByTenant(tenantId);

  clearElement(servicesListElement);

  if (services.length === 0) {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <strong>Nenhum serviço cadastrado</strong><br>
      Cadastre o primeiro serviço para usar na agenda e na página pública.
    `;
    servicesListElement.appendChild(listItem);
    return;
  }

  services.forEach((service) => {
    const listItem = document.createElement('li');

    listItem.innerHTML = `
      <div class="service-card">
        <div class="service-card-header">
          <strong>${service.name}</strong>
          <span class="status-badge">${service.isActive ? 'Ativo' : 'Inativo'}</span>
        </div>

        <div class="service-card-body">
          <div>Descrição: ${service.description || '-'}</div>
          <div>Duração: ${service.durationMinutes || 0} min</div>
          <div>Valor: ${formatCurrencyBRL(service.price || 0)}</div>
          <div>Identificador: ${service.id}</div>
        </div>

        <div class="service-actions">
          <button class="button" type="button" data-service-action="edit" data-service-id="${service.id}">
            Editar
          </button>
          <button class="button" type="button" data-service-action="toggle" data-service-id="${service.id}" data-service-active="${service.isActive}">
            ${service.isActive ? 'Desativar' : 'Ativar'}
          </button>
          <button class="button danger" type="button" data-service-action="delete" data-service-id="${service.id}">
            Excluir
          </button>
        </div>
      </div>
    `;

    servicesListElement.appendChild(listItem);
  });

  bindServiceActions(services);
}

function bindServiceActions(services) {
  const container = document.getElementById('services-list');
  const feedbackElement = document.getElementById('service-feedback');

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
          showFeedback(feedbackElement, 'Serviço carregado para edição.', 'success');
          return;
        }

        if (action === 'toggle') {
          await toggleServiceActive(serviceId, !service.isActive);
          await renderTenantServicesList();
          showFeedback(feedbackElement, 'Status do serviço atualizado com sucesso.', 'success');
          return;
        }

        if (action === 'delete') {
          const shouldDelete = window.confirm(`Deseja excluir o serviço "${service.name}"?`);

          if (!shouldDelete) {
            return;
          }

          await deleteService(serviceId);
          resetServiceForm();
          await renderTenantServicesList();
          showFeedback(feedbackElement, 'Serviço excluído com sucesso.', 'success');
        }
      } catch (error) {
        console.error(error);
        showFeedback(feedbackElement, error.message || 'Não foi possível executar a ação no serviço.', 'error');
      }
    });
  });
}

export function fillServiceForm(service) {
  document.getElementById('service-edit-id').value = service.id || '';
  document.querySelector('#service-form [name="name"]').value = service.name || '';
  document.querySelector('#service-form [name="description"]').value = service.description || '';
  document.querySelector('#service-form [name="durationMinutes"]').value = service.durationMinutes || '';
  document.querySelector('#service-form [name="price"]').value = service.price || '';
  document.querySelector('#service-form [name="isActive"]').value = String(service.isActive);
}

export function resetServiceForm() {
  const form = document.getElementById('service-form');
  const editId = document.getElementById('service-edit-id');

  form?.reset();

  if (editId) {
    editId.value = '';
  }
}

export async function submitSaveService(formElement, feedbackElement) {
  const formData = new FormData(formElement);

  const editId = document.getElementById('service-edit-id')?.value?.trim() || '';
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const durationMinutes = Number(formData.get('durationMinutes') || 0);
  const price = Number(formData.get('price') || 0);
  const isActive = formData.get('isActive') === 'true';

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

    showFeedback(feedbackElement, 'Serviço atualizado com sucesso.', 'success');
  } else {
    await createService({
      tenantId,
      name,
      description,
      durationMinutes,
      price,
      isActive
    });

    showFeedback(feedbackElement, 'Serviço criado com sucesso.', 'success');
  }

  resetServiceForm();
  return true;
}