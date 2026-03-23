import {
  getPublicTenantBySlug,
  listPublicServicesByTenant,
  getAvailabilityForDate,
  ensurePublicCustomer,
  createPublicAppointment,
  getSlugFromUrl,
  buildPublicWhatsAppMessageLink,
  getReadableBusinessHours
} from '../services/public-booking-service.js';
import { formatCurrencyBRL } from '../utils/formatters.js';
import { showFeedback, clearElement } from '../utils/dom-utils.js';

const servicesListElement = document.getElementById('public-services-list');
const bookingFeedbackElement = document.getElementById('public-booking-feedback');
const summaryFeedbackElement = document.getElementById('public-summary-feedback');
const bookingForm = document.getElementById('public-booking-form');
const slotsElement = document.getElementById('public-available-slots');
const successPanel = document.getElementById('public-success-panel');

const state = {
  tenant: null,
  services: [],
  selectedService: null,
  selectedTime: ''
};

function activatePublicTab(tabId) {
  const buttons = document.querySelectorAll('[data-public-tab-target]');
  const panels = document.querySelectorAll('.public-tab-panel');

  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-public-tab-target') === tabId;
    button.classList.toggle('active', isActive);
  });

  panels.forEach((panel) => {
    const isActive = panel.id === tabId;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function bindPublicTabs() {
  const buttons = document.querySelectorAll('[data-public-tab-target]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-public-tab-target');

      if (tabId) {
        activatePublicTab(tabId);
      }
    });
  });
}

function renderBusinessHours() {
  const container = document.getElementById('public-business-hours-list');

  if (!container || !state.tenant) {
    return;
  }

  clearElement(container);

  const readableHours = getReadableBusinessHours(state.tenant);

  readableHours.forEach((item) => {
    const row = document.createElement('div');
    row.className = `public-hours-item ${item.enabled ? 'enabled' : 'disabled'}`;
    row.innerHTML = `
      <span>${item.label}</span>
      <strong>${item.text}</strong>
    `;
    container.appendChild(row);
  });
}

function setBusinessInfo(tenant) {
  document.getElementById('public-tenant-id').value = tenant.id || '';
  document.getElementById('public-business-name').textContent = tenant.businessName || 'Sua empresa';
  document.getElementById('public-business-description').textContent =
    tenant.description || 'Escolha um serviço, selecione um horário e confirme seu agendamento.';

  document.getElementById('public-company-about-text').textContent =
    tenant.description || 'Confira os dados da empresa e fale diretamente pelo WhatsApp se precisar confirmar algum detalhe.';

  const logoElement = document.getElementById('public-business-logo');
  if (tenant.logoUrl) {
    logoElement.src = tenant.logoUrl;
    logoElement.hidden = false;
  } else {
    logoElement.hidden = true;
  }

  document.getElementById('public-business-whatsapp-text').textContent =
    tenant.whatsapp || 'WhatsApp não informado';

  document.getElementById('public-business-address-text').textContent =
    tenant.address || 'Endereço não informado';

  document.getElementById('public-business-instagram').textContent =
    tenant.instagram || '-';

  document.getElementById('public-business-address').textContent =
    tenant.address || '-';

  document.getElementById('public-business-whatsapp').textContent =
    tenant.whatsapp || '-';

  const whatsappLink = document.getElementById('public-business-whatsapp-link');
  whatsappLink.href = buildPublicWhatsAppMessageLink(
    tenant.whatsapp || '',
    `Olá! Vim pela página pública da ${tenant.businessName || 'empresa'}.`
  );

  renderBusinessHours();
}

function renderServices() {
  clearElement(servicesListElement);

  if (!state.services.length) {
    const empty = document.createElement('div');
    empty.className = 'public-slot-empty';
    empty.textContent = 'Nenhum serviço público disponível no momento.';
    servicesListElement.appendChild(empty);
    return;
  }

  state.services.forEach((service) => {
    const card = document.createElement('article');
    const isSelected = state.selectedService?.id === service.id;

    card.className = `public-service-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <strong>${service.name || '-'}</strong>
      <div class="public-service-meta">
        <span>Duração: ${service.durationMinutes || 0} min</span>
        <span>Valor: ${formatCurrencyBRL(service.price || 0)}</span>
        <span>${service.description || 'Sem descrição cadastrada.'}</span>
      </div>
      <button class="button primary public-service-select-button" type="button" data-service-id="${service.id}">
        ${isSelected ? 'Selecionado' : 'Selecionar'}
      </button>
    `;

    servicesListElement.appendChild(card);
  });

  const buttons = servicesListElement.querySelectorAll('[data-service-id]');

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const serviceId = button.getAttribute('data-service-id');
      state.selectedService = state.services.find((service) => service.id === serviceId) || null;
      state.selectedTime = '';

      fillSelectedService();
      renderServices();
      await refreshAvailableSlots();
      activatePublicTab('public-booking-tab');
    });
  });
}

function fillSelectedService() {
  const service = state.selectedService;

  document.getElementById('public-service-id').value = service?.id || '';
  document.getElementById('public-service-name').value = service?.name || '';
  document.getElementById('public-service-duration').value = service?.durationMinutes || '';
  document.getElementById('public-service-price').value = service?.price || '';

  document.getElementById('public-service-selected-text').textContent = service
    ? `${service.name} • ${service.durationMinutes || 0} min • ${formatCurrencyBRL(service.price || 0)}`
    : 'Nenhum serviço selecionado ainda.';

  document.getElementById('public-summary-service').textContent = service?.name || '-';
  document.getElementById('public-summary-duration').textContent = service
    ? `${service.durationMinutes || 0} min`
    : '-';
  document.getElementById('public-summary-price').textContent = service
    ? formatCurrencyBRL(service.price || 0)
    : '-';
}

function updateSummaryDateTime() {
  const date = document.getElementById('public-booking-date').value || '';
  document.getElementById('public-summary-date').textContent = date || '-';
  document.getElementById('public-summary-time').textContent = state.selectedTime || '-';
}

function renderAvailabilityMessage(type, message) {
  const infoBox = document.getElementById('public-availability-info');

  if (!infoBox) {
    return;
  }

  infoBox.className = `public-availability-info ${type}`;
  infoBox.textContent = message || '';
  infoBox.hidden = !message;
}

async function refreshAvailableSlots() {
  clearElement(slotsElement);
  renderAvailabilityMessage('neutral', '');

  const date = document.getElementById('public-booking-date').value || '';

  if (!state.selectedService) {
    const empty = document.createElement('div');
    empty.className = 'public-slot-empty';
    empty.textContent = 'Selecione um serviço para visualizar os horários.';
    slotsElement.appendChild(empty);
    return;
  }

  if (!date) {
    const empty = document.createElement('div');
    empty.className = 'public-slot-empty';
    empty.textContent = 'Escolha uma data para carregar os horários disponíveis.';
    slotsElement.appendChild(empty);
    return;
  }

  const availability = await getAvailabilityForDate(state.tenant, state.selectedService, date);

  if (availability.status === 'closed') {
    renderAvailabilityMessage('closed', availability.message || 'A empresa está fechada nesta data.');

    const empty = document.createElement('div');
    empty.className = 'public-slot-empty';
    empty.textContent = 'Não é possível agendar nesta data.';
    slotsElement.appendChild(empty);
    return;
  }

  if (availability.status === 'full') {
    renderAvailabilityMessage('warning', availability.message || 'Não há horários livres para esta data.');

    const empty = document.createElement('div');
    empty.className = 'public-slot-empty';
    empty.textContent = 'Escolha outra data para continuar.';
    slotsElement.appendChild(empty);
    return;
  }

  if (availability.status === 'special_hours') {
    renderAvailabilityMessage('special', availability.message || 'Expediente especial nesta data.');
  } else {
    renderAvailabilityMessage('available', availability.message || 'Horários disponíveis carregados.');
  }

  const slots = availability.slots || [];

  if (!slots.length) {
    const empty = document.createElement('div');
    empty.className = 'public-slot-empty';
    empty.textContent = 'Não há horários livres para esta data.';
    slotsElement.appendChild(empty);
    return;
  }

  slots.forEach((slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `public-slot-button ${state.selectedTime === slot ? 'selected' : ''}`;
    button.textContent = slot;

    button.addEventListener('click', () => {
      state.selectedTime = slot;
      updateSummaryDateTime();
      refreshAvailableSlots();
    });

    slotsElement.appendChild(button);
  });
}

function validateBookingStep() {
  const tenantId = document.getElementById('public-tenant-id').value || '';
  const customerName = document.getElementById('public-customer-name').value.trim();
  const customerPhone = document.getElementById('public-customer-phone').value.trim();
  const date = document.getElementById('public-booking-date').value || '';

  if (!tenantId || !state.tenant) {
    return 'Empresa não encontrada para agendamento.';
  }

  if (!state.selectedService) {
    return 'Selecione um serviço.';
  }

  if (!customerName || !customerPhone) {
    return 'Informe seu nome e WhatsApp.';
  }

  if (!date) {
    return 'Selecione uma data.';
  }

  if (!state.selectedTime) {
    return 'Selecione um horário disponível.';
  }

  return '';
}

function fillSuccessPanel({ customerName, customerPhone, date }) {
  document.getElementById('public-success-business-name').textContent =
    state.tenant?.businessName || '-';
  document.getElementById('public-success-service').textContent =
    state.selectedService?.name || '-';
  document.getElementById('public-success-date').textContent = date || '-';
  document.getElementById('public-success-time').textContent = state.selectedTime || '-';
  document.getElementById('public-success-customer').textContent = customerName || '-';
  document.getElementById('public-success-phone').textContent = customerPhone || '-';

  const whatsappLink = document.getElementById('public-success-whatsapp-link');
  whatsappLink.href = buildPublicWhatsAppMessageLink(
    state.tenant?.whatsapp || '',
    `Olá! Acabei de fazer um agendamento para ${customerName || 'cliente'} no serviço ${state.selectedService?.name || ''}, em ${date || ''} às ${state.selectedTime || ''}.`
  );
}

function showSuccessPanel() {
  if (successPanel) {
    successPanel.hidden = false;
  }
}

function hideSuccessPanel() {
  if (successPanel) {
    successPanel.hidden = true;
  }
}

function resetPublicBookingFlow() {
  bookingForm.reset();
  state.selectedService = null;
  state.selectedTime = '';
  fillSelectedService();
  updateSummaryDateTime();
  renderServices();
  clearElement(slotsElement);

  const empty = document.createElement('div');
  empty.className = 'public-slot-empty';
  empty.textContent = 'Selecione um serviço e uma data para visualizar os horários.';
  slotsElement.appendChild(empty);

  renderAvailabilityMessage('neutral', '');

  if (bookingFeedbackElement) {
    bookingFeedbackElement.textContent = '';
    bookingFeedbackElement.className = 'feedback';
  }

  if (summaryFeedbackElement) {
    summaryFeedbackElement.textContent = '';
    summaryFeedbackElement.className = 'feedback';
  }

  hideSuccessPanel();
  activatePublicTab('public-services-tab');
}

async function confirmBooking() {
  const validationError = validateBookingStep();

  if (validationError) {
    showFeedback(summaryFeedbackElement, validationError, 'error');

    if (validationError === 'Selecione um serviço.') {
      activatePublicTab('public-services-tab');
    } else {
      activatePublicTab('public-booking-tab');
    }

    return;
  }

  const tenantId = document.getElementById('public-tenant-id').value || '';
  const customerName = document.getElementById('public-customer-name').value.trim();
  const customerPhone = document.getElementById('public-customer-phone').value.trim();
  const customerEmail = document.getElementById('public-customer-email').value.trim();
  const date = document.getElementById('public-booking-date').value || '';
  const notes = document.getElementById('public-booking-notes').value.trim();

  try {
    showFeedback(summaryFeedbackElement, 'Confirmando agendamento...', 'success');

    const customer = await ensurePublicCustomer({
      tenantId,
      customerName,
      customerPhone,
      customerEmail
    });

    await createPublicAppointment({
      tenantId,
      customerId: customer?.id || null,
      customerName,
      serviceId: state.selectedService.id,
      serviceName: state.selectedService.name,
      date,
      time: state.selectedTime,
      durationMinutes: state.selectedService.durationMinutes,
      price: state.selectedService.price,
      notes
    });

    showFeedback(summaryFeedbackElement, 'Agendamento confirmado com sucesso!', 'success');

    fillSuccessPanel({
      customerName,
      customerPhone,
      date
    });

    showSuccessPanel();
  } catch (error) {
    console.error(error);
    showFeedback(
      summaryFeedbackElement,
      error?.message || 'Não foi possível confirmar o agendamento.',
      'error'
    );
  }
}

async function init() {
  const slug = getSlugFromUrl();

  if (!slug) {
    showFeedback(bookingFeedbackElement, 'Slug público não informado.', 'error');
    return;
  }

  const tenant = await getPublicTenantBySlug(slug);

  if (!tenant) {
    showFeedback(bookingFeedbackElement, 'Página pública não encontrada ou indisponível.', 'error');
    return;
  }

  state.tenant = tenant;
  state.services = await listPublicServicesByTenant(tenant.id);

  bindPublicTabs();
  setBusinessInfo(tenant);
  renderServices();
  fillSelectedService();
  updateSummaryDateTime();
  hideSuccessPanel();
  renderAvailabilityMessage('neutral', '');

  document.getElementById('public-booking-date')?.addEventListener('change', async () => {
    state.selectedTime = '';
    updateSummaryDateTime();
    await refreshAvailableSlots();
  });

  document.getElementById('public-booking-continue-button')?.addEventListener('click', () => {
    const validationError = validateBookingStep();

    if (validationError) {
      showFeedback(bookingFeedbackElement, validationError, 'error');
      return;
    }

    if (bookingFeedbackElement) {
      bookingFeedbackElement.textContent = '';
      bookingFeedbackElement.className = 'feedback';
    }

    activatePublicTab('public-summary-tab');
  });

  document.getElementById('public-summary-back-button')?.addEventListener('click', () => {
    activatePublicTab('public-booking-tab');
  });

  document.getElementById('public-summary-confirm-button')?.addEventListener('click', async () => {
    await confirmBooking();
  });

  document.getElementById('public-success-new-booking-button')?.addEventListener('click', () => {
    resetPublicBookingFlow();
  });

  bookingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
  });
}

init().catch((error) => {
  console.error('Erro ao carregar a página pública do HoraLivre:', error);
  showFeedback(
    bookingFeedbackElement,
    'Não foi possível carregar a página pública.',
    'error'
  );
});