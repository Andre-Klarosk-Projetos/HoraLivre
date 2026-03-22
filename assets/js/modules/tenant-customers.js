import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import {
  listCustomersByTenant,
  createCustomer,
  updateCustomer,
  deleteCustomer
} from '../services/customer-service.js';
import {
  formatCurrencyBRL,
  formatPhone,
  buildWhatsAppLink
} from '../utils/formatters.js';
import {
  required,
  isValidPhone,
  isValidEmail
} from '../utils/validators.js';
import {
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

export async function listTenantCustomersForSelect() {
  return listCustomersByTenant(tenantId);
}

export async function renderTenantCustomersList(elementId = 'customers-list') {
  const customersListElement = document.getElementById(elementId);

  if (!customersListElement) {
    return;
  }

  const customers = await listCustomersByTenant(tenantId);

  clearElement(customersListElement);

  if (customers.length === 0) {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <strong>Nenhum cliente final cadastrado</strong><br>
      Os clientes do seu negócio aparecerão aqui.
    `;
    customersListElement.appendChild(listItem);
    return;
  }

  customers.forEach((customer) => {
    const whatsappLink = buildWhatsAppLink(
      customer.phone || '',
      `Olá ${customer.name || ''}, estou entrando em contato pela sua empresa no HoraLivre.`
    );

    const listItem = document.createElement('li');

    listItem.innerHTML = `
      <div class="customer-card">
        <div class="customer-card-header">
          <strong>${customer.name}</strong>
        </div>

        <div class="customer-card-body">
          <div>Telefone: ${formatPhone(customer.phone || '-')}</div>
          <div>E-mail: ${customer.email || '-'}</div>
          <div>Total de atendimentos: ${customer.totalAppointments || 0}</div>
          <div>Total gasto: ${formatCurrencyBRL(customer.totalSpent || 0)}</div>
          <div>Último atendimento: ${customer.lastAppointmentAt || '-'}</div>
          <div>Observações: ${customer.notes || '-'}</div>
          <div>Identificador: ${customer.id}</div>
        </div>

        <div class="customer-actions">
          <a class="button primary" href="${whatsappLink}" target="_blank" rel="noopener noreferrer">
            Chamar no WhatsApp
          </a>
          <button class="button" type="button" data-customer-action="edit" data-customer-id="${customer.id}">
            Editar
          </button>
          <button class="button danger" type="button" data-customer-action="delete" data-customer-id="${customer.id}">
            Excluir
          </button>
        </div>
      </div>
    `;

    customersListElement.appendChild(listItem);
  });

  bindCustomerActions(customers);
}

function bindCustomerActions(customers) {
  const container = document.getElementById('customers-list');
  const feedbackElement = document.getElementById('customer-feedback');

  if (!container) {
    return;
  }

  const buttons = container.querySelectorAll('[data-customer-action][data-customer-id]');

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-customer-action');
      const customerId = button.getAttribute('data-customer-id');
      const customer = customers.find((item) => item.id === customerId);

      if (!customer) {
        return;
      }

      try {
        if (action === 'edit') {
          fillCustomerForm(customer);
          showFeedback(feedbackElement, 'Cliente carregado para edição.', 'success');
          return;
        }

        if (action === 'delete') {
          const shouldDelete = window.confirm(`Deseja excluir o cliente "${customer.name}"?`);

          if (!shouldDelete) {
            return;
          }

          await deleteCustomer(customerId);
          resetCustomerForm();
          await renderTenantCustomersList();
          showFeedback(feedbackElement, 'Cliente excluído com sucesso.', 'success');
        }
      } catch (error) {
        console.error(error);
        showFeedback(feedbackElement, error.message || 'Não foi possível executar a ação no cliente.', 'error');
      }
    });
  });
}

export function fillCustomerForm(customer) {
  document.getElementById('customer-edit-id').value = customer.id || '';
  document.querySelector('#customer-form [name="name"]').value = customer.name || '';
  document.querySelector('#customer-form [name="phone"]').value = customer.phone || '';
  document.querySelector('#customer-form [name="email"]').value = customer.email || '';
  document.querySelector('#customer-form [name="notes"]').value = customer.notes || '';
}

export function resetCustomerForm() {
  const form = document.getElementById('customer-form');
  const editId = document.getElementById('customer-edit-id');

  form?.reset();

  if (editId) {
    editId.value = '';
  }
}

export async function submitSaveCustomer(formElement, feedbackElement) {
  const formData = new FormData(formElement);

  const editId = document.getElementById('customer-edit-id')?.value?.trim() || '';
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  if (!required(name)) {
    showFeedback(feedbackElement, 'Nome do cliente é obrigatório.', 'error');
    return false;
  }

  if (!required(phone) || !isValidPhone(phone)) {
    showFeedback(feedbackElement, 'Telefone inválido.', 'error');
    return false;
  }

  if (email && !isValidEmail(email)) {
    showFeedback(feedbackElement, 'E-mail inválido.', 'error');
    return false;
  }

  if (editId) {
    await updateCustomer(editId, {
      name,
      phone,
      email,
      notes
    });

    showFeedback(feedbackElement, 'Cliente atualizado com sucesso.', 'success');
  } else {
    await createCustomer({
      tenantId,
      name,
      phone,
      email,
      notes,
      totalAppointments: 0,
      totalSpent: 0,
      lastAppointmentAt: null
    });

    showFeedback(feedbackElement, 'Cliente cadastrado com sucesso.', 'success');
  }

  resetCustomerForm();
  return true;
}