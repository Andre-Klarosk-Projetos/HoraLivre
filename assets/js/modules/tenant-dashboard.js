import { requireTenantUser } from '../utils/guards.js';
import { logoutUser } from '../services/auth-service.js';
import { getTenantId } from '../state/session-store.js';
import { getTenantById, updateTenant } from '../services/tenant-service.js';
import { listServicesByTenant, createService, updateService } from '../services/service-service.js';
import { listTenantCustomers, createTenantCustomer, updateTenantCustomer } from '../services/customer-service.js';
import {
  renderTenantAppointmentsList,
  loadAppointmentFormDependencies,
  bindAppointmentFormSelects,
  bindAppointmentFilters,
  submitSaveAppointment,
  resetAppointmentForm
} from './tenant-appointments.js';
import {
  loadTenantReportsIntoPage,
  bindReportFilters
} from './tenant-reports.js';
import { bindClientTabs, activateClientTab } from './tenant-tabs.js';
import { renderTenantSetupChecklist } from './tenant-setup-checklist.js';
import {
  clearElement,
  createListItem,
  setText,
  showFeedback
} from '../utils/dom-utils.js';
import { formatCurrencyBRL, buildWhatsAppLink } from '../utils/formatters.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

const logoutButton = document.getElementById('logout-button');
const openPublicPageButton = document.getElementById('open-public-page-button');

const tenantCompanyForm = document.getElementById('tenant-company-form');
const tenantBusinessHoursForm = document.getElementById('tenant-business-hours-form');

const serviceForm = document.getElementById('service-form');
const serviceCancelEditButton = document.getElementById('service-cancel-edit-button');

const customerForm = document.getElementById('customer-form');
const customerCancelEditButton = document.getElementById('customer-cancel-edit-button');

const appointmentForm = document.getElementById('appointment-form');
const appointmentCancelEditButton = document.getElementById('appointment-cancel-edit-button');

function getBusinessHoursPayloadFromForm() {
  return {
    sunday: {
      enabled: document.getElementById('business-hours-sunday-enabled').value === 'true',
      start: document.getElementById('business-hours-sunday-start').value || '',
      end: document.getElementById('business-hours-sunday-end').value || ''
    },
    monday: {
      enabled: document.getElementById('business-hours-monday-enabled').value === 'true',
      start: document.getElementById('business-hours-monday-start').value || '',
      end: document.getElementById('business-hours-monday-end').value || ''
    },
    tuesday: {
      enabled: document.getElementById('business-hours-tuesday-enabled').value === 'true',
      start: document.getElementById('business-hours-tuesday-start').value || '',
      end: document.getElementById('business-hours-tuesday-end').value || ''
    },
    wednesday: {
      enabled: document.getElementById('business-hours-wednesday-enabled').value === 'true',
      start: document.getElementById('business-hours-wednesday-start').value || '',
      end: document.getElementById('business-hours-wednesday-end').value || ''
    },
    thursday: {
      enabled: document.getElementById('business-hours-thursday-enabled').value === 'true',
      start: document.getElementById('business-hours-thursday-start').value || '',
      end: document.getElementById('business-hours-thursday-end').value || ''
    },
    friday: {
      enabled: document.getElementById('business-hours-friday-enabled').value === 'true',
      start: document.getElementById('business-hours-friday-start').value || '',
      end: document.getElementById('business-hours-friday-end').value || ''
    },
    saturday: {
      enabled: document.getElementById('business-hours-saturday-enabled').value === 'true',
      start: document.getElementById('business-hours-saturday-start').value || '',
      end: document.getElementById('business-hours-saturday-end').value || ''
    }
  };
}

function fillBusinessHoursForm(businessHours = {}) {
  const dayMap = {
    sunday: 'sunday',
    monday: 'monday',
    tuesday: 'tuesday',
    wednesday: 'wednesday',
    thursday: 'thursday',
    friday: 'friday',
    saturday: 'saturday'
  };

  Object.keys(dayMap).forEach((dayKey) => {
    const item = businessHours?.[dayKey] || {};
    document.getElementById(`business-hours-${dayKey}-enabled`).value = String(item.enabled === true);
    document.getElementById(`business-hours-${dayKey}-start`).value = item.start || '';
    document.getElementById(`business-hours-${dayKey}-end`).value = item.end || '';
  });
}

async function loadTenantCompany() {
  const tenant = await getTenantById(tenantId);

  setText('tenant-business-name-header', tenant?.businessName || 'Minha empresa');

  document.getElementById('tenant-business-name').value = tenant?.businessName || '';
  document.getElementById('tenant-slug').value = tenant?.slug || '';
  document.getElementById('tenant-whatsapp').value = tenant?.whatsapp || '';
  document.getElementById('tenant-description').value = tenant?.description || '';
  document.getElementById('tenant-logo-url').value = tenant?.logoUrl || '';
  document.getElementById('tenant-instagram').value = tenant?.instagram || '';
  document.getElementById('tenant-address').value = tenant?.address || '';
  document.getElementById('tenant-public-page-enabled').value = String(tenant?.publicPageEnabled !== false);

  fillBusinessHoursForm(tenant?.businessHours || {});
}

async function renderServicesList() {
  const element = document.getElementById('services-list');
  const services = await listServicesByTenant(tenantId);

  clearElement(element);

  if (!services.length) {
    element.appendChild(createListItem(`
      <strong>Nenhum serviço cadastrado</strong><br>
      Cadastre seu primeiro serviço para começar a receber agendamentos.
    `));
    return;
  }

  services.forEach((service) => {
    element.appendChild(createListItem(`
      <strong>${service.name || '-'}</strong><br>
      Duração: ${service.durationMinutes || 0} min<br>
      Preço: ${formatCurrencyBRL(service.price || 0)}<br>
      Descrição: ${service.description || '-'}<br>
      Ativo: ${service.active === false ? 'Não' : 'Sim'}<br><br>
      <button class="button" type="button" data-service-action="edit" data-service-id="${service.id}">
        Editar
      </button>
    `));
  });

  bindServiceActions(services);
}

function bindServiceActions(services) {
  const container = document.getElementById('services-list');
  const feedbackElement = document.getElementById('service-feedback');

  const buttons = container.querySelectorAll('[data-service-action="edit"]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const serviceId = button.getAttribute('data-service-id');
      const service = services.find((item) => item.id === serviceId);

      if (!service) {
        return;
      }

      document.getElementById('service-edit-id').value = service.id || '';
      document.getElementById('service-name').value = service.name || '';
      document.getElementById('service-duration').value = service.durationMinutes || '';
      document.getElementById('service-price').value = service.price || '';
      document.getElementById('service-description').value = service.description || '';
      document.getElementById('service-active').value = String(service.active !== false);

      showFeedback(feedbackElement, 'Serviço carregado para edição.', 'success');
    });
  });
}

function resetServiceForm() {
  serviceForm?.reset();
  document.getElementById('service-edit-id').value = '';
  document.getElementById('service-active').value = 'true';
}

async function renderCustomersList() {
  const element = document.getElementById('customers-list');
  const customers = await listTenantCustomers(tenantId);

  clearElement(element);

  if (!customers.length) {
    element.appendChild(createListItem(`
      <strong>Nenhum cliente cadastrado</strong><br>
      Cadastre seu primeiro cliente para organizar sua base.
    `));
    return;
  }

  customers.forEach((customer) => {
    element.appendChild(createListItem(`
      <strong>${customer.name || '-'}</strong><br>
      WhatsApp: ${customer.phone || '-'}<br>
      E-mail: ${customer.email || '-'}<br>
      Observações: ${customer.notes || '-'}<br><br>
      <div class="quick-actions">
        <button class="button" type="button" data-customer-action="edit" data-customer-id="${customer.id}">
          Editar
        </button>
        <a class="button" href="${buildWhatsAppLink(customer.phone || '', 'Olá!')}" target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </div>
    `));
  });

  bindCustomerActions(customers);
}

function bindCustomerActions(customers) {
  const container = document.getElementById('customers-list');
  const feedbackElement = document.getElementById('customer-feedback');

  const buttons = container.querySelectorAll('[data-customer-action="edit"]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const customerId = button.getAttribute('data-customer-id');
      const customer = customers.find((item) => item.id === customerId);

      if (!customer) {
        return;
      }

      document.getElementById('customer-edit-id').value = customer.id || '';
      document.getElementById('customer-name').value = customer.name || '';
      document.getElementById('customer-phone').value = customer.phone || '';
      document.getElementById('customer-email').value = customer.email || '';
      document.getElementById('customer-notes').value = customer.notes || '';

      showFeedback(feedbackElement, 'Cliente carregado para edição.', 'success');
    });
  });
}

function resetCustomerForm() {
  customerForm?.reset();
  document.getElementById('customer-edit-id').value = '';
}

async function loadSummary() {
  const [services, customers] = await Promise.all([
    listServicesByTenant(tenantId),
    listTenantCustomers(tenantId)
  ]);

  setText('summary-services-count', String(services.length));
  setText('summary-customers-count', String(customers.length));

  const appointmentsList = document.getElementById('appointments-list');
  const reportAppointmentsList = document.getElementById('report-appointments-list');

  const appointmentsCount = appointmentsList ? appointmentsList.children.length : 0;
  const reportCount = reportAppointmentsList ? reportAppointmentsList.children.length : 0;

  setText('summary-appointments-count', String(Math.max(appointmentsCount, 0)));
  setText('summary-completed-count', document.getElementById('report-completed')?.textContent || '0');
}

logoutButton?.addEventListener('click', async () => {
  await logoutUser();
  window.location.href = './login.html';
});

openPublicPageButton?.addEventListener('click', async () => {
  const tenant = await getTenantById(tenantId);
  const feedbackElement = document.getElementById('client-summary-feedback');
  const slug = String(tenant?.slug || '').trim();

  if (!slug) {
    showFeedback(
      feedbackElement,
      'Sua empresa ainda não possui slug público configurado. Vá em "Minha empresa" e preencha o slug.',
      'error'
    );
    activateClientTab('company-tab');
    return;
  }

  window.location.href = `./agendar.html?slug=${encodeURIComponent(slug)}`;
});

tenantCompanyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const feedbackElement = document.getElementById('tenant-company-feedback');

  try {
    await updateTenant(tenantId, {
      businessName: document.getElementById('tenant-business-name').value.trim(),
      slug: document.getElementById('tenant-slug').value.trim(),
      whatsapp: document.getElementById('tenant-whatsapp').value.trim(),
      description: document.getElementById('tenant-description').value.trim(),
      logoUrl: document.getElementById('tenant-logo-url').value.trim(),
      instagram: document.getElementById('tenant-instagram').value.trim(),
      address: document.getElementById('tenant-address').value.trim(),
      publicPageEnabled: document.getElementById('tenant-public-page-enabled').value === 'true'
    });

    await loadTenantCompany();
    await renderTenantSetupChecklist();
    showFeedback(feedbackElement, 'Dados da empresa salvos com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(feedbackElement, error.message || 'Não foi possível salvar a empresa.', 'error');
  }
});

tenantBusinessHoursForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const feedbackElement = document.getElementById('tenant-business-hours-feedback');

  try {
    await updateTenant(tenantId, {
      businessHours: getBusinessHoursPayloadFromForm()
    });

    await loadTenantCompany();
    await renderTenantSetupChecklist();
    showFeedback(feedbackElement, 'Horários salvos com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(feedbackElement, error.message || 'Não foi possível salvar os horários.', 'error');
  }
});

serviceCancelEditButton?.addEventListener('click', () => {
  resetServiceForm();
  showFeedback(document.getElementById('service-feedback'), 'Edição de serviço cancelada.', 'success');
});

serviceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const feedbackElement = document.getElementById('service-feedback');
  const editId = document.getElementById('service-edit-id').value.trim();

  const payload = {
    tenantId,
    name: document.getElementById('service-name').value.trim(),
    durationMinutes: Number(document.getElementById('service-duration').value || 0),
    price: Number(document.getElementById('service-price').value || 0),
    description: document.getElementById('service-description').value.trim(),
    active: document.getElementById('service-active').value === 'true'
  };

  try {
    if (!payload.name) {
      showFeedback(feedbackElement, 'Nome do serviço é obrigatório.', 'error');
      return;
    }

    if (editId) {
      await updateService(editId, payload);
      showFeedback(feedbackElement, 'Serviço atualizado com sucesso.', 'success');
    } else {
      await createService(payload);
      showFeedback(feedbackElement, 'Serviço criado com sucesso.', 'success');
    }

    resetServiceForm();
    await renderServicesList();
    await renderTenantSetupChecklist();
    await loadAppointmentFormDependencies();
    await loadSummary();
  } catch (error) {
    console.error(error);
    showFeedback(feedbackElement, error.message || 'Não foi possível salvar o serviço.', 'error');
  }
});

customerCancelEditButton?.addEventListener('click', () => {
  resetCustomerForm();
  showFeedback(document.getElementById('customer-feedback'), 'Edição de cliente cancelada.', 'success');
});

customerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const feedbackElement = document.getElementById('customer-feedback');
  const editId = document.getElementById('customer-edit-id').value.trim();

  const payload = {
    tenantId,
    name: document.getElementById('customer-name').value.trim(),
    phone: document.getElementById('customer-phone').value.trim(),
    email: document.getElementById('customer-email').value.trim(),
    notes: document.getElementById('customer-notes').value.trim()
  };

  try {
    if (!payload.name) {
      showFeedback(feedbackElement, 'Nome do cliente é obrigatório.', 'error');
      return;
    }

    if (editId) {
      await updateTenantCustomer(editId, payload);
      showFeedback(feedbackElement, 'Cliente atualizado com sucesso.', 'success');
    } else {
      await createTenantCustomer(payload);
      showFeedback(feedbackElement, 'Cliente criado com sucesso.', 'success');
    }

    resetCustomerForm();
    await renderCustomersList();
    await loadAppointmentFormDependencies();
    await loadSummary();
  } catch (error) {
    console.error(error);
    showFeedback(feedbackElement, error.message || 'Não foi possível salvar o cliente.', 'error');
  }
});

appointmentCancelEditButton?.addEventListener('click', () => {
  resetAppointmentForm();
  showFeedback(document.getElementById('appointment-feedback'), 'Edição de agendamento cancelada.', 'success');
});

appointmentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const success = await submitSaveAppointment(
    appointmentForm,
    document.getElementById('appointment-feedback')
  );

  if (success) {
    await renderTenantAppointmentsList();
    await loadTenantReportsIntoPage();
    await loadSummary();
  }
});

async function init() {
  bindClientTabs();
  bindAppointmentFilters();
  bindReportFilters();
  bindAppointmentFormSelects();

  await Promise.all([
    loadTenantCompany(),
    renderServicesList(),
    renderCustomersList(),
    loadAppointmentFormDependencies()
  ]);

  await renderTenantAppointmentsList();
  await loadTenantReportsIntoPage();
  await renderTenantSetupChecklist();
  await loadSummary();
}

init().catch((error) => {
  console.error('Erro ao carregar o painel da empresa do HoraLivre:', error);
});