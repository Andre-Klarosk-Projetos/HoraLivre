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

function getInputValue(id, fallback = '') {
  return document.getElementById(id)?.value ?? fallback;
}

function setInputValue(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.value = value ?? '';
}

function getCheckboxValue(id, fallback = false) {
  const element = document.getElementById(id);

  if (!element || element.type !== 'checkbox') {
    return fallback;
  }

  return Boolean(element.checked);
}

function setCheckboxValue(id, value) {
  const element = document.getElementById(id);

  if (!element || element.type !== 'checkbox') {
    return;
  }

  element.checked = Boolean(value);
}

function timeStringToMinutes(timeString) {
  const [hours, minutes] = String(timeString || '00:00')
    .split(':')
    .map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return (hours * 60) + minutes;
}

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

function validateBusinessHoursForm({
  openingTime,
  closingTime,
  lunchStartTime,
  lunchEndTime,
  slotIntervalMinutes,
  workingDays
}) {
  if (!Array.isArray(workingDays) || !workingDays.length) {
    return 'Selecione pelo menos um dia de atendimento.';
  }

  if (!required(openingTime) || !required(closingTime)) {
    return 'Defina o horário de abertura e fechamento.';
  }

  const openingMinutes = timeStringToMinutes(openingTime);
  const closingMinutes = timeStringToMinutes(closingTime);

  if (openingMinutes >= closingMinutes) {
    return 'O horário de abertura deve ser menor que o horário de fechamento.';
  }

  if (lunchStartTime && lunchEndTime) {
    const lunchStartMinutes = timeStringToMinutes(lunchStartTime);
    const lunchEndMinutes = timeStringToMinutes(lunchEndTime);

    if (lunchStartMinutes >= lunchEndMinutes) {
      return 'O início do almoço deve ser menor que o fim do almoço.';
    }

    if (lunchStartMinutes < openingMinutes || lunchEndMinutes > closingMinutes) {
      return 'O intervalo de almoço deve estar dentro do horário de atendimento.';
    }
  }

  if (!Number.isInteger(Number(slotIntervalMinutes)) || Number(slotIntervalMinutes) <= 0) {
    return 'O intervalo entre horários deve ser um número inteiro maior que zero.';
  }

  return null;
}

function buildTenantUpdatePayload() {
  const businessName = getInputValue('company-form-business-name').trim();
  const slug = getInputValue('company-form-slug').trim();
  const whatsapp = getInputValue('company-form-whatsapp').trim();
  const description = getInputValue('company-form-description').trim();
  const logoUrl = getInputValue('company-form-logo-url').trim();
  const instagram = getInputValue('company-form-instagram').trim();
  const address = getInputValue('company-form-address').trim();

  const openingTime = getInputValue('company-form-opening-time');
  const closingTime = getInputValue('company-form-closing-time');
  const lunchStartTime = getInputValue('company-form-lunch-start-time');
  const lunchEndTime = getInputValue('company-form-lunch-end-time');
  const slotIntervalMinutes = Number(
    getInputValue('company-form-slot-interval-minutes', '30') || 30
  );

  const availabilityState = getAvailabilityUiState();

  if (!required(businessName)) {
    return { error: 'Nome da empresa é obrigatório.' };
  }

  if (!required(slug) || !isValidSlug(slug)) {
    return {
      error: 'Slug inválido. Use letras minúsculas, números e hífen.'
    };
  }

  if (!required(whatsapp) || !isValidPhone(whatsapp)) {
    return { error: 'WhatsApp inválido.' };
  }

  if (logoUrl && !isValidUrl(logoUrl)) {
    return { error: 'Logo URL inválida.' };
  }

  const businessHoursError = validateBusinessHoursForm({
    openingTime,
    closingTime,
    lunchStartTime,
    lunchEndTime,
    slotIntervalMinutes,
    workingDays: availabilityState.workingDays
  });

  if (businessHoursError) {
    return { error: businessHoursError };
  }

  const payload = {
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
  };

  const publicPageEnabledElement = document.getElementById('company-form-public-page-enabled');
  const reportsEnabledElement = document.getElementById('company-form-reports-enabled');

  if (publicPageEnabledElement?.type === 'checkbox') {
    payload.publicPageEnabled = getCheckboxValue(
      'company-form-public-page-enabled',
      true
    );
  }

  if (reportsEnabledElement?.type === 'checkbox') {
    payload.reportsEnabled = getCheckboxValue(
      'company-form-reports-enabled',
      true
    );
  }

  return { payload };
}

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

  setInputValue('company-form-business-name', tenant.businessName || '');
  setInputValue('company-form-slug', tenant.slug || '');
  setInputValue('company-form-whatsapp', tenant.whatsapp || '');
  setInputValue('company-form-description', tenant.description || '');
  setInputValue('company-form-logo-url', tenant.logoUrl || '');
  setInputValue('company-form-instagram', tenant.instagram || '');
  setInputValue('company-form-address', tenant.address || '');

  setInputValue('company-form-opening-time', businessHours.openingTime);
  setInputValue('company-form-closing-time', businessHours.closingTime);
  setInputValue('company-form-lunch-start-time', businessHours.lunchStartTime);
  setInputValue('company-form-lunch-end-time', businessHours.lunchEndTime);
  setInputValue(
    'company-form-slot-interval-minutes',
    String(businessHours.slotIntervalMinutes)
  );

  setCheckboxValue(
    'company-form-public-page-enabled',
    tenant.publicPageEnabled !== false
  );

  setCheckboxValue(
    'company-form-reports-enabled',
    tenant.reportsEnabled !== false
  );

  setAvailabilityUiState(businessHours);
  renderAvailabilitySummary();

  if (publicPageLinkButton) {
    if (tenant.slug) {
      publicPageLinkButton.href = `./agendar.html?slug=${tenant.slug}`;
      publicPageLinkButton.removeAttribute('aria-disabled');
    } else {
      publicPageLinkButton.href = '#';
      publicPageLinkButton.setAttribute('aria-disabled', 'true');
    }
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

  const completedAppointmentsCount = await countCompletedAppointments(
    tenantId,
    startIso,
    endIso
  );

  const effectiveBillingMode = resolveEffectiveBillingMode(
    tenant,
    billingSettings,
    plan
  );

  const effectiveFixedPrice = resolveEffectiveFixedPrice(
    tenant,
    billingSettings,
    plan
  );

  const effectiveUnitPrice = resolveEffectiveUnitPrice(
    tenant,
    billingSettings,
    plan
  );

  const totalBillingAmount = calculateBillingForPeriod({
    billingMode: effectiveBillingMode,
    completedAppointments: completedAppointmentsCount,
    fixedMonthlyPrice: effectiveFixedPrice,
    pricePerExecutedService: effectiveUnitPrice
  });

  const todayDate = new Date().toISOString().slice(0, 10);

  const todayAppointments = appointments.filter(
    (appointment) => String(appointment.startAt || '').slice(0, 10) === todayDate
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

companyForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const { error, payload } = buildTenantUpdatePayload();

    if (error) {
      showFeedback(companyFeedback, error, 'error');
      return;
    }

    await updateTenant(tenantId, payload);
    await loadTenantData();

    showFeedback(
      companyFeedback,
      'Dados da empresa e disponibilidade atualizados com sucesso.',
      'success'
    );
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

  const success = await submitSaveAppointment(
    appointmentForm,
    appointmentFeedback
  );

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
