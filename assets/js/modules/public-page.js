import {
  getPublicTenantBySlug,
  listPublicServicesByTenant,
  listAvailableSlotsForDate,
  ensurePublicCustomer,
  createPublicAppointment,
  getSlugFromUrl,
  buildPublicWhatsAppMessageLink
} from '../services/public-booking-service.js';
import { formatCurrencyBRL } from '../utils/formatters.js';
import { showFeedback, clearElement } from '../utils/dom-utils.js';

const servicesListElement = document.getElementById('public-services-list');
const feedbackElement = document.getElementById('public-booking-feedback');
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

async function refreshAvailableSlots() {
  clearElement(slotsElement);

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

  const slots = await listAvailableSlotsForDate(state.tenant, state.selectedService, date);

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
      activatePublicTab('public-summary-tab');
    });

    slotsElement.appendChild(button);
  });
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

  hideSuccessPanel();
  activatePublicTab('public-services-tab');
}

async function handleSubmit(event) {
  event.preventDefault();

  const tenantId = document.getElementById('public-tenant-id').value || '';
  const customerName = document.getElementById('public-customer-name').value.trim();
  const customerPhone = document.getElementById('public-customer-phone').value.trim();
  const customerEmail = document.getElementById('public-customer-email').value.trim();
  const date = document.getElementById('public-booking-date').value || '';
  const notes = document.getElementById('public-booking-notes').value.trim();

  if (!tenantId || !state.tenant) {
    showFeedback(feedbackElement, 'Empresa não encontrada para agendamento.', 'error');
    return;
  }

  if (!state.selectedService) {
    showFeedback(feedbackElement, 'Selecione um serviço.', 'error');
    activatePublicTab('public-services-tab');
    return;
  }

  if (!customerName || !customerPhone) {
    showFeedback(feedbackElement, 'Informe seu nome e WhatsApp.', 'error');
    activatePublicTab('public-booking-tab');
    return;
  }

  if (!date) {
    showFeedback(feedbackElement, 'Selecione uma data.', 'error');
    activatePublicTab('public-booking-tab');
    return;
  }

  if (!state.selectedTime) {
    showFeedback(feedbackElement, 'Selecione um horário disponível.', 'error');
    activatePublicTab('public-booking-tab');
    return;
  }

  try {
    showFeedback(feedbackElement, 'Confirmando agendamento...', 'success');

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

    showFeedback(
      feedbackElement,
      'Agendamento confirmado com sucesso!',
      'success'
    );

    fillSuccessPanel({
      customerName,
      customerPhone,
      date
    });

    showSuccessPanel();
    activatePublicTab('public-summary-tab');
  } catch (error) {
    console.error(error);
    showFeedback(
      feedbackElement,
      error?.message || 'Não foi possível confirmar o agendamento.',
      'error'
    );
  }
}

async function init() {
  const slug = getSlugFromUrl();

  if (!slug) {
    showFeedback(feedbackElement, 'Slug público não informado.', 'error');
    return;
  }

  const tenant = await getPublicTenantBySlug(slug);

  if (!tenant) {
    showFeedback(feedbackElement, 'Página pública não encontrada ou indisponível.', 'error');
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

  document.getElementById('public-booking-date')?.addEventListener('change', async () => {
    state.selectedTime = '';
    updateSummaryDateTime();
    await refreshAvailableSlots();
  });

  document.getElementById('public-success-new-booking-button')?.addEventListener('click', () => {
    resetPublicBookingFlow();
  });

  bookingForm?.addEventListener('submit', handleSubmit);
}

init().catch((error) => {
  console.error('Erro ao carregar a página pública do HoraLivre:', error);
  showFeedback(
    feedbackElement,
    'Não foi possível carregar a página pública.',
    'error'
  );
});