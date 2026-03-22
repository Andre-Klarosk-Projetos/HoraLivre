import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import { logoutUser } from '../services/auth-service.js';
import { getTenantById, updateTenant } from '../services/tenant-service.js';
import { getPlatformSettings } from '../services/admin-service.js';
import {
  getBillingSettingsByTenant,
  calculateBillingForPeriod
} from '../services/billing-service.js';
import { getPlanById } from '../services/plan-service.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  formatPhone,
  formatSubscriptionStatus,
  buildWhatsAppLink
} from '../utils/formatters.js';
import { setText, showFeedback } from '../utils/dom-utils.js';
import {
  renderTenantServicesList,
  submitSaveService,
  resetServiceForm
} from './tenant-services.js';
import {
  renderTenantCustomersList,
  submitSaveCustomer,
  resetCustomerForm
} from './tenant-customers.js';
import {
  renderTenantAppointmentsList,
  submitSaveAppointment,
  bindAppointmentFilters,
  loadAppointmentFormDependencies,
  bindAppointmentFormSelects,
  resetAppointmentForm
} from './tenant-appointments.js';
import {
  loadTenantReportsIntoPage,
  bindReportFilters
} from './tenant-reports.js';
import { listCustomersByTenant } from '../services/customer-service.js';
import {
  listAppointmentsByTenant,
  countCompletedAppointments
} from '../services/appointment-service.js';
import { getStartAndEndOfCurrentMonth } from '../utils/date-utils.js';
import {
  required,
  isValidSlug,
  isValidPhone,
  isValidUrl
} from '../utils/validators.js';
import { normalizeBusinessHours } from '../utils/business-hours.js';
import {
  bindAvailabilityUi,
  setAvailabilityUiState,
  getAvailabilityUiState,
  renderAvailabilitySummary
} from './tenant-availability-ui.js';
import { bindClientTabs } from './client-tabs.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

const logoutButton = document.getElementById('logout-button');
const supportButton = document.getElementById('support-button');
const publicPageLinkButton = document.getElementById('public-page-link');

const companyForm = document.getElementById('company-form');
const serviceForm = document.getElementById('service-form');
const customerForm = document.getElementById('customer-form');
const appointmentForm = document.getElementById('appointment-form');

const companyFeedback = document.getElementById('company-feedback');
const serviceFeedback = document.getElementById('service-feedback');
const customerFeedback = document.getElementById('customer-feedback');
const appointmentFeedback = document.getElementById('appointment-feedback');

const serviceCancelEditButton = document.getElementById('service-cancel-edit-button');
const customerCancelEditButton = document.getElementById('customer-cancel-edit-button');
const appointmentCancelEditButton = document.getElementById('appointment-cancel-edit-button');

function resolveEffectiveBillingMode(tenant, billingSettings, plan) {
  return (
    billingSettings?.billingMode ||
    tenant?.billingMode ||
    plan?.billingMode ||
    'free'
  );
}

function resolveEffectiveFixedPrice(tenant, billingSettings, plan) {
  return Number(
    billingSettings?.fixedMonthlyPrice ??
    plan?.price ??
    tenant?.fixedMonthlyPrice ??
    0
  );
}

function resolveEffectiveUnitPrice(tenant, billingSettings, plan) {
  return Number(
    billingSettings?.pricePerExecutedService ??
    plan?.pricePerExecutedService ??
    tenant?.pricePerExecutedService ??
    0
  );
}

logoutButton?.addEventListener('click', async () => {
  await logoutUser();
  window.location.href = './login.html';
});

serviceCancelEditButton?.addEventListener('click', () => {
  resetServiceForm();
  showFeedback(serviceFeedback, 'Edição de serviço cancelada.', 'success');
});

customerCancelEditButton?.addEventListener('click', () => {
  resetCustomerForm();
  showFeedback(customerFeedback, 'Edição de cliente cancelada.', 'success');
});

appointmentCancelEditButton?.addEventListener('click', () => {
  resetAppointmentForm();
  showFeedback(appointmentFeedback, 'Edição de agendamento cancelada.', 'success');
});

async function loadTenantData() {
  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    throw new Error('Tenant não encontrado.');
  }

  const businessHours = normalizeBusinessHours(tenant.businessHours || {});

  setText('tenant-business-name', tenant.businessName || '-');
  setText('company-name', tenant.businessName || '-');
  setText('company-slug', tenant.slug || '-');
  setText('company-whatsapp', formatPhone(tenant.whatsapp || '-'));
  setText('company-description', tenant.description || '-');
  setText('company-logo-url', tenant.logoUrl || '-');
  setText('company-plan', tenant.planId || '-');
  setText('company-billing-mode', formatBillingMode(tenant.billingMode));
  setText('company-status', formatSubscriptionStatus(tenant.subscriptionStatus));

  document.getElementById('company-form-business-name').value = tenant.businessName || '';
  document.getElementById('company-form-slug').value = tenant.slug || '';
  document.getElementById('company-form-whatsapp').value = tenant.whatsapp || '';
  document.getElementById('company-form-description').value = tenant.description || '';
  document.getElementById('company-form-logo-url').value = tenant.logoUrl || '';
  document.getElementById('company-form-instagram').value = tenant.instagram || '';
  document.getElementById('company-form-address').value = tenant.address || '';
  document.getElementById('company-form-opening-time').value = businessHours.openingTime;
  document.getElementById('company-form-closing-time').value = businessHours.closingTime;
  document.getElementById('company-form-lunch-start-time').value = businessHours.lunchStartTime;
  document.getElementById('company-form-lunch-end-time').value = businessHours.lunchEndTime;
  document.getElementById('company-form-slot-interval-minutes').value = String(businessHours.slotIntervalMinutes);

  setAvailabilityUiState(businessHours);
  renderAvailabilitySummary();

  if (publicPageLinkButton && tenant.slug) {
    publicPageLinkButton.href = `./agendar.html?slug=${tenant.slug}`;
  }

  return tenant;
}

async function loadDashboardSummary() {
  const tenant = await getTenantById(tenantId);
  const plan = tenant?.planId ? await getPlanById(tenant.planId) : null;
  const billingSettings = await getBillingSettingsByTenant(tenantId);

  const [customers, appointments] = await Promise.all([
    listCustomersByTenant(tenantId),
    listAppointmentsByTenant(tenantId)
  ]);

  const { startIso, endIso } = getStartAndEndOfCurrentMonth();
  const completedAppointmentsCount = await countCompletedAppointments(tenantId, startIso, endIso);

  const effectiveBillingMode = resolveEffectiveBillingMode(tenant, billingSettings, plan);
  const effectiveFixedPrice = resolveEffectiveFixedPrice(tenant, billingSettings, plan);
  const effectiveUnitPrice = resolveEffectiveUnitPrice(tenant, billingSettings, plan);

  const totalBillingAmount = calculateBillingForPeriod({
    billingMode: effectiveBillingMode,
    completedAppointments: completedAppointmentsCount,
    fixedMonthlyPrice: effectiveFixedPrice,
    pricePerExecutedService: effectiveUnitPrice
  });

  const todayDate = new Date().toISOString().slice(0, 10);

  const todayAppointments = appointments.filter((appointment) =>
    String(appointment.startAt || '').slice(0, 10) === todayDate
  );

  setText('tenant-stat-billing', formatCurrencyBRL(totalBillingAmount));
  setText('tenant-stat-customers', String(customers.length));
  setText('tenant-stat-today', String(todayAppointments.length));
  setText('tenant-stat-completed', String(completedAppointmentsCount));
}

async function loadSupportButton() {
  const settings = await getPlatformSettings();

  if (!settings?.supportWhatsapp || !supportButton) {
    return;
  }

  supportButton.href = buildWhatsAppLink(
    settings.supportWhatsapp,
    settings.supportWhatsappMessage || 'Olá, preciso de ajuda com o HoraLivre.'
  );
}

companyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const businessName = document.getElementById('company-form-business-name').value.trim();
    const slug = document.getElementById('company-form-slug').value.trim();
    const whatsapp = document.getElementById('company-form-whatsapp').value.trim();
    const description = document.getElementById('company-form-description').value.trim();
    const logoUrl = document.getElementById('company-form-logo-url').value.trim();
    const instagram = document.getElementById('company-form-instagram').value.trim();
    const address = document.getElementById('company-form-address').value.trim();

    const openingTime = document.getElementById('company-form-opening-time').value;
    const closingTime = document.getElementById('company-form-closing-time').value;
    const lunchStartTime = document.getElementById('company-form-lunch-start-time').value;
    const lunchEndTime = document.getElementById('company-form-lunch-end-time').value;
    const slotIntervalMinutes = Number(document.getElementById('company-form-slot-interval-minutes').value || 30);

    const availabilityState = getAvailabilityUiState();

    if (!required(businessName)) {
      showFeedback(companyFeedback, 'Nome da empresa é obrigatório.', 'error');
      return;
    }

    if (!required(slug) || !isValidSlug(slug)) {
      showFeedback(companyFeedback, 'Slug inválido. Use letras minúsculas, números e hífen.', 'error');
      return;
    }

    if (!required(whatsapp) || !isValidPhone(whatsapp)) {
      showFeedback(companyFeedback, 'WhatsApp inválido.', 'error');
      return;
    }

    if (logoUrl && !isValidUrl(logoUrl)) {
      showFeedback(companyFeedback, 'Logo URL inválida.', 'error');
      return;
    }

    if (!availabilityState.workingDays.length) {
      showFeedback(companyFeedback, 'Selecione pelo menos um dia de atendimento.', 'error');
      return;
    }

    await updateTenant(tenantId, {
      businessName,
      slug,
      whatsapp,
      description,
      logoUrl,
      instagram,
      address,
      businessHours: {
        workingDays: availabilityState.workingDays,
        openingTime,
        closingTime,
        lunchStartTime,
        lunchEndTime,
        slotIntervalMinutes,
        holidays: availabilityState.holidays,
        blockedDates: availabilityState.blockedDates,
        specialDates: availabilityState.specialDates
      }
    });

    await loadTenantData();
    showFeedback(companyFeedback, 'Dados da empresa e disponibilidade atualizados com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    showFeedback(
      companyFeedback,
      error.message || 'Não foi possível atualizar a empresa.',
      'error'
    );
  }
});

serviceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const success = await submitSaveService(serviceForm, serviceFeedback);

  if (success) {
    await renderTenantServicesList();
    await loadAppointmentFormDependencies();
  }
});

customerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const success = await submitSaveCustomer(customerForm, customerFeedback);

  if (success) {
    await renderTenantCustomersList();
    await loadAppointmentFormDependencies();
    await loadDashboardSummary();
  }
});

appointmentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const success = await submitSaveAppointment(appointmentForm, appointmentFeedback);

  if (success) {
    await renderTenantAppointmentsList();
    await loadTenantReportsIntoPage({
      reportAppointmentsListElementId: 'report-appointments-list'
    });
    await loadDashboardSummary();
  }
});

async function init() {
  try {
    bindClientTabs();
    bindAvailabilityUi();

    await loadTenantData();
    await loadDashboardSummary();
    await loadSupportButton();

    await renderTenantServicesList();
    await renderTenantCustomersList();
    await loadAppointmentFormDependencies();
    bindAppointmentFormSelects();
    await renderTenantAppointmentsList();
    await loadTenantReportsIntoPage({
      reportAppointmentsListElementId: 'report-appointments-list'
    });

    bindAppointmentFilters();
    bindReportFilters();
  } catch (error) {
    console.error(error);
  }
}

init();