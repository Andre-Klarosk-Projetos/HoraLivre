import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import {
  listAppointmentsByTenant,
  listAppointmentsByTenantAndPeriod,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  getAppointmentById
} from '../services/appointment-service.js';
import {
  formatCurrencyBRL,
  formatAppointmentStatus
} from '../utils/formatters.js';
import {
  required,
  isValidPrice
} from '../utils/validators.js';
import {
  clearElement,
  showFeedback
} from '../utils/dom-utils.js';
import {
  formatDateTimeForDisplay,
  buildStartOfDayIsoFromDateInput,
  buildEndOfDayIsoFromDateInput
} from '../utils/date-utils.js';
import { listTenantCustomersForSelect } from './tenant-customers.js';
import { listServicesByTenant } from '../services/service-service.js';
import { syncCustomerStats } from '../services/customer-stats-service.js';
import { getTenantById } from '../services/tenant-service.js';
import {
  normalizeBusinessHours,
  getEffectiveBusinessHoursForDate,
  isWithinBusinessHours
} from '../utils/business-hours.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

async function validateAppointmentAgainstBusinessHours(date, time, durationMinutes) {
  const tenant = await getTenantById(tenantId);
  const businessHours = normalizeBusinessHours(tenant?.businessHours || {});
  const effectiveBusinessHours = getEffectiveBusinessHoursForDate(date, businessHours);

  if (effectiveBusinessHours.isClosed) {
    throw new Error('A data escolhida está indisponível para atendimento.');
  }

  if (!isWithinBusinessHours(time, durationMinutes, effectiveBusinessHours)) {
    throw new Error('O horário escolhido está fora do expediente configurado da empresa.');
  }
}

export async function renderTenantAppointmentsList(elementId = 'appointments-list', options = {}) {
  const appointmentsListElement = document.getElementById(elementId);

  if (!appointmentsListElement) {
    return;
  }

  let appointments = [];

  if (options.startIso && options.endIso) {
    appointments = await listAppointmentsByTenantAndPeriod(tenantId, options.startIso, options.endIso);
  } else {
    appointments = await listAppointmentsByTenant(tenantId);
  }

  clearElement(appointmentsListElement);

  if (appointments.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.innerHTML = `
      <strong>Nenhum agendamento encontrado</strong><br>
      Não há agendamentos para o filtro atual.
    `;
    appointmentsListElement.appendChild(emptyItem);
    return;
  }

  appointments.forEach((appointment) => {
    const listItem = document.createElement('li');

    listItem.innerHTML = `
      <div class="appointment-card">
        <div class="appointment-card-header">
          <strong>${appointment.customerName || '-'}</strong>
          <span class="status-badge">${formatAppointmentStatus(appointment.status)}</span>
        </div>

        <div class="appointment-card-body">
          <div>Serviço: ${appointment.serviceName || '-'}</div>
          <div>Início: ${formatDateTimeForDisplay(appointment.startAt)}</div>
          <div>Fim: ${formatDateTimeForDisplay(appointment.endAt)}</div>
          <div>Valor: ${formatCurrencyBRL(appointment.price || 0)}</div>
          <div>Origem: ${appointment.source || '-'}</div>
          <div>Observações: ${appointment.notes || '-'}</div>
          <div>Identificador: ${appointment.id}</div>
        </div>

        <div class="appointment-actions">
          <button class="button" type="button" data-appointment-id="${appointment.id}" data-status="confirmed">
            Confirmar
          </button>
          <button class="button primary" type="button" data-appointment-id="${appointment.id}" data-status="completed">
            Concluir
          </button>
          <button class="button" type="button" data-appointment-id="${appointment.id}" data-status="canceled">
            Cancelar
          </button>
          <button class="button danger" type="button" data-appointment-id="${appointment.id}" data-status="no_show">
            Faltou
          </button>
          <button class="button" type="button" data-appointment-action="edit" data-appointment-id="${appointment.id}">
            Editar
          </button>
        </div>
      </div>
    `;

    appointmentsListElement.appendChild(listItem);
  });

  bindAppointmentStatusButtons(appointments, elementId, options);
}

function bindAppointmentStatusButtons(appointments, elementId = 'appointments-list', options = {}) {
  const container = document.getElementById(elementId);

  if (!container) {
    return;
  }

  const statusButtons = container.querySelectorAll('[data-appointment-id][data-status]');
  const editButtons = container.querySelectorAll('[data-appointment-action="edit"][data-appointment-id]');

  statusButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.getAttribute('data-appointment-id');
      const status = button.getAttribute('data-status');

      try {
        const appointment = await getAppointmentById(appointmentId);

        await setAppointmentStatus(appointmentId, status);

        if (appointment?.customerId) {
          await syncCustomerStats(appointment.customerId);
        }

        await renderTenantAppointmentsList(elementId, options);

        const appointmentFeedbackElement = document.getElementById('appointment-feedback');

        if (appointmentFeedbackElement) {
          showFeedback(
            appointmentFeedbackElement,
            `Status alterado para ${formatAppointmentStatus(status)} com sucesso.`,
            'success'
          );
        }
      } catch (error) {
        console.error(error);

        const appointmentFeedbackElement = document.getElementById('appointment-feedback');

        if (appointmentFeedbackElement) {
          showFeedback(
            appointmentFeedbackElement,
            error.message || 'Não foi possível alterar o status do agendamento.',
            'error'
          );
        }
      }
    });
  });

  editButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.getAttribute('data-appointment-id');
      const appointment = appointments.find((item) => item.id === appointmentId);
      const appointmentFeedbackElement = document.getElementById('appointment-feedback');

      if (!appointment) {
        return;
      }

      await loadAppointmentFormDependencies();
      fillAppointmentForm(appointment);
      showFeedback(appointmentFeedbackElement, 'Agendamento carregado para edição.', 'success');
    });
  });
}

export async function loadAppointmentFormDependencies() {
  const customerSelect = document.getElementById('appointment-customer-select');
  const serviceSelect = document.getElementById('appointment-service-select');

  const [customers, services] = await Promise.all([
    listTenantCustomersForSelect(),
    listServicesByTenant(tenantId)
  ]);

  if (customerSelect) {
    customerSelect.innerHTML = '<option value="">Selecione um cliente</option>';

    customers.forEach((customer) => {
      const option = document.createElement('option');
      option.value = customer.id;
      option.dataset.customerName = customer.name || '';
      option.textContent = `${customer.name} - ${customer.phone || ''}`;
      customerSelect.appendChild(option);
    });
  }

  if (serviceSelect) {
    serviceSelect.innerHTML = '<option value="">Selecione um serviço</option>';

    services.forEach((service) => {
      const option = document.createElement('option');
      option.value = service.id;
      option.dataset.serviceName = service.name || '';
      option.dataset.serviceDuration = String(service.durationMinutes || '');
      option.dataset.servicePrice = String(service.price || '');
      option.textContent = `${service.name} - ${formatCurrencyBRL(service.price || 0)}`;
      serviceSelect.appendChild(option);
    });
  }
}

export function bindAppointmentFormSelects() {
  const customerSelect = document.getElementById('appointment-customer-select');
  const serviceSelect = document.getElementById('appointment-service-select');

  customerSelect?.addEventListener('change', () => {
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    document.querySelector('#appointment-form [name="customerId"]').value = customerSelect.value || '';
    document.querySelector('#appointment-form [name="customerName"]').value =
      selectedOption?.dataset?.customerName || '';
  });

  serviceSelect?.addEventListener('change', () => {
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    document.querySelector('#appointment-form [name="serviceId"]').value = serviceSelect.value || '';
    document.querySelector('#appointment-form [name="serviceName"]').value =
      selectedOption?.dataset?.serviceName || '';
    document.querySelector('#appointment-form [name="durationMinutes"]').value =
      selectedOption?.dataset?.serviceDuration || '';
    document.querySelector('#appointment-form [name="price"]').value =
      selectedOption?.dataset?.servicePrice || '';
  });
}

export function fillAppointmentForm(appointment) {
  document.getElementById('appointment-edit-id').value = appointment.id || '';

  const customerSelect = document.getElementById('appointment-customer-select');
  const serviceSelect = document.getElementById('appointment-service-select');

  if (customerSelect) {
    customerSelect.value = appointment.customerId || '';
  }

  if (serviceSelect) {
    serviceSelect.value = appointment.serviceId || '';
  }

  document.querySelector('#appointment-form [name="customerId"]').value = appointment.customerId || '';
  document.querySelector('#appointment-form [name="customerName"]').value = appointment.customerName || '';
  document.querySelector('#appointment-form [name="serviceId"]').value = appointment.serviceId || '';
  document.querySelector('#appointment-form [name="serviceName"]').value = appointment.serviceName || '';

  const startDate = new Date(appointment.startAt);

  document.querySelector('#appointment-form [name="date"]').value = startDate.toISOString().slice(0, 10);
  document.querySelector('#appointment-form [name="time"]').value = startDate.toISOString().slice(11, 16);

  const durationMinutes =
    Math.round((new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000);

  document.querySelector('#appointment-form [name="durationMinutes"]').value = durationMinutes || '';
  document.querySelector('#appointment-form [name="price"]').value = appointment.price || '';
  document.querySelector('#appointment-form [name="status"]').value = appointment.status || 'scheduled';
  document.querySelector('#appointment-form [name="notes"]').value = appointment.notes || '';
}

export function resetAppointmentForm() {
  const form = document.getElementById('appointment-form');
  const editId = document.getElementById('appointment-edit-id');

  form?.reset();

  if (editId) {
    editId.value = '';
  }

  document.querySelector('#appointment-form [name="customerId"]').value = '';
  document.querySelector('#appointment-form [name="customerName"]').value = '';
  document.querySelector('#appointment-form [name="serviceId"]').value = '';
  document.querySelector('#appointment-form [name="serviceName"]').value = '';

  const customerSelect = document.getElementById('appointment-customer-select');
  const serviceSelect = document.getElementById('appointment-service-select');

  if (customerSelect) {
    customerSelect.value = '';
  }

  if (serviceSelect) {
    serviceSelect.value = '';
  }

  document.querySelector('#appointment-form [name="status"]').value = 'scheduled';
}

export function bindAppointmentFilters() {
  const filterButton = document.getElementById('appointments-filter-button');
  const resetButton = document.getElementById('appointments-filter-reset-button');
  const startInput = document.getElementById('appointments-filter-start');
  const endInput = document.getElementById('appointments-filter-end');

  filterButton?.addEventListener('click', async () => {
    const startIso = buildStartOfDayIsoFromDateInput(startInput?.value || '');
    const endIso = buildEndOfDayIsoFromDateInput(endInput?.value || '');

    await renderTenantAppointmentsList('appointments-list', {
      startIso,
      endIso
    });
  });

  resetButton?.addEventListener('click', async () => {
    if (startInput) {
      startInput.value = '';
    }

    if (endInput) {
      endInput.value = '';
    }

    await renderTenantAppointmentsList();
  });
}

export async function submitSaveAppointment(formElement, feedbackElement) {
  const formData = new FormData(formElement);

  const editId = document.getElementById('appointment-edit-id')?.value?.trim() || '';
  const customerId = String(formData.get('customerId') || '').trim();
  const customerName = String(formData.get('customerName') || '').trim();
  const serviceId = String(formData.get('serviceId') || '').trim();
  const serviceName = String(formData.get('serviceName') || '').trim();
  const date = String(formData.get('date') || '').trim();
  const time = String(formData.get('time') || '').trim();
  const durationMinutes = Number(formData.get('durationMinutes') || 0);
  const price = Number(formData.get('price') || 0);
  const notes = String(formData.get('notes') || '').trim();
  const status = String(formData.get('status') || 'scheduled').trim();

  if (!required(customerName)) {
    showFeedback(feedbackElement, 'Cliente é obrigatório.', 'error');
    return false;
  }

  if (!required(serviceName)) {
    showFeedback(feedbackElement, 'Serviço é obrigatório.', 'error');
    return false;
  }

  if (!required(date) || !required(time)) {
    showFeedback(feedbackElement, 'Data e horário são obrigatórios.', 'error');
    return false;
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    showFeedback(feedbackElement, 'Duração inválida.', 'error');
    return false;
  }

  if (!isValidPrice(price)) {
    showFeedback(feedbackElement, 'Valor inválido.', 'error');
    return false;
  }

  await validateAppointmentAgainstBusinessHours(date, time, durationMinutes);

  const startAt = new Date(`${date}T${time}:00`).toISOString();
  const startDate = new Date(startAt);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const endAt = endDate.toISOString();

  if (editId) {
    const previousAppointment = await getAppointmentById(editId);

    await updateAppointment(editId, {
      customerId: customerId || null,
      customerName,
      serviceId: serviceId || null,
      serviceName,
      startAt,
      endAt,
      price,
      status,
      notes
    });

    if (previousAppointment?.customerId) {
      await syncCustomerStats(previousAppointment.customerId);
    }

    if (customerId && customerId !== previousAppointment?.customerId) {
      await syncCustomerStats(customerId);
    } else if (customerId) {
      await syncCustomerStats(customerId);
    }

    showFeedback(feedbackElement, 'Agendamento atualizado com sucesso.', 'success');
  } else {
    await createAppointment({
      tenantId,
      customerId: customerId || null,
      customerName,
      serviceId: serviceId || null,
      serviceName,
      startAt,
      endAt,
      price,
      status,
      source: 'panel',
      notes
    });

    if (customerId) {
      await syncCustomerStats(customerId);
    }

    showFeedback(feedbackElement, 'Agendamento criado com sucesso.', 'success');
  }

  resetAppointmentForm();
  return true;
}

export async function setAppointmentStatus(appointmentId, status) {
  await updateAppointmentStatus(appointmentId, status);
}