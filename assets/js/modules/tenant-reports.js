import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import { getTenantById } from '../services/tenant-service.js';
import { getPlanById } from '../services/plan-service.js';
import {
  getBillingSettingsByTenant,
  getBillingRecordByTenantAndMonth,
  calculateBillingForPeriod
} from '../services/billing-service.js';
import {
  countCompletedAppointments,
  listAppointmentsByTenantAndPeriod
} from '../services/appointment-service.js';
import {
  formatCurrencyBRL,
  formatAppointmentStatus
} from '../utils/formatters.js';
import {
  getMonthReference,
  getStartAndEndOfCurrentMonth,
  formatDateTimeForDisplay,
  buildStartOfDayIsoFromDateInput,
  buildEndOfDayIsoFromDateInput
} from '../utils/date-utils.js';
import {
  clearElement,
  createListItem,
  setText
} from '../utils/dom-utils.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

function isFullCurrentMonthFilter(startIso, endIso) {
  const currentMonthPeriod = getStartAndEndOfCurrentMonth();
  return startIso === currentMonthPeriod.startIso && endIso === currentMonthPeriod.endIso;
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

export async function loadTenantReportsIntoPage(options = {}) {
  const reportCompletedElementId = options.reportCompletedElementId || 'report-completed';
  const reportTotalElementId = options.reportTotalElementId || 'report-total';
  const reportStatusElementId = options.reportStatusElementId || 'report-status';
  const reportAppointmentsListElementId = options.reportAppointmentsListElementId || 'report-appointments-list';

  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    throw new Error('Tenant não encontrado.');
  }

  const plan = tenant.planId ? await getPlanById(tenant.planId) : null;

  if (plan && plan.reportsEnabled === false) {
    setText(reportCompletedElementId, 'Indisponível no plano');
    setText(reportTotalElementId, 'Indisponível no plano');
    setText(reportStatusElementId, 'Indisponível no plano');
    return;
  }

  const defaultPeriod = getStartAndEndOfCurrentMonth();
  const startIso = options.startIso || defaultPeriod.startIso;
  const endIso = options.endIso || defaultPeriod.endIso;

  const billingSettings = await getBillingSettingsByTenant(tenantId);
  const completedAppointments = await countCompletedAppointments(tenantId, startIso, endIso);
  const appointments = await listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso);

  const effectiveBillingMode = resolveEffectiveBillingMode(tenant, billingSettings, plan);
  const effectiveFixedPrice = resolveEffectiveFixedPrice(tenant, billingSettings, plan);
  const effectiveUnitPrice = resolveEffectiveUnitPrice(tenant, billingSettings, plan);

  console.log('HoraLivre relatório tenant');
  console.log('tenantId:', tenantId);
  console.log('tenant.billingMode:', tenant?.billingMode);
  console.log('billingSettings:', billingSettings);
  console.log('plan:', plan);
  console.log('effectiveBillingMode:', effectiveBillingMode);
  console.log('effectiveFixedPrice:', effectiveFixedPrice);
  console.log('effectiveUnitPrice:', effectiveUnitPrice);
  console.log('completedAppointments:', completedAppointments);

  const calculatedTotal = calculateBillingForPeriod({
    billingMode: effectiveBillingMode,
    completedAppointments,
    fixedMonthlyPrice: effectiveFixedPrice,
    pricePerExecutedService: effectiveUnitPrice
  });

  let reportStatus = 'calculado em tempo real';

  if (isFullCurrentMonthFilter(startIso, endIso)) {
    const monthReference = getMonthReference(new Date(startIso));
    const currentBillingRecord = await getBillingRecordByTenantAndMonth(tenantId, monthReference);

    if (currentBillingRecord) {
      reportStatus = `${currentBillingRecord.status || 'pending'} (registro salvo)`;
    }
  }

  setText(reportCompletedElementId, String(completedAppointments));
  setText(reportTotalElementId, formatCurrencyBRL(calculatedTotal));
  setText(reportStatusElementId, reportStatus);

  const reportAppointmentsListElement = document.getElementById(reportAppointmentsListElementId);

  if (!reportAppointmentsListElement) {
    return;
  }

  clearElement(reportAppointmentsListElement);

  if (appointments.length === 0) {
    reportAppointmentsListElement.appendChild(createListItem(`
      <strong>Nenhum agendamento no período</strong><br>
      Os agendamentos do filtro atual aparecerão aqui.
    `));
    return;
  }

  appointments.forEach((appointment) => {
    reportAppointmentsListElement.appendChild(createListItem(`
      <strong>${appointment.customerName || '-'}</strong><br>
      Serviço: ${appointment.serviceName || '-'}<br>
      Início: ${formatDateTimeForDisplay(appointment.startAt)}<br>
      Valor: ${formatCurrencyBRL(appointment.price || 0)}<br>
      Status: ${formatAppointmentStatus(appointment.status)}
    `));
  });
}

export function bindReportFilters() {
  const filterButton = document.getElementById('report-filter-button');
  const resetButton = document.getElementById('report-filter-reset-button');
  const startInput = document.getElementById('report-filter-start');
  const endInput = document.getElementById('report-filter-end');

  filterButton?.addEventListener('click', async () => {
    const startIso = buildStartOfDayIsoFromDateInput(startInput?.value || '');
    const endIso = buildEndOfDayIsoFromDateInput(endInput?.value || '');

    await loadTenantReportsIntoPage({
      startIso,
      endIso,
      reportAppointmentsListElementId: 'report-appointments-list'
    });
  });

  resetButton?.addEventListener('click', async () => {
    if (startInput) {
      startInput.value = '';
    }

    if (endInput) {
      endInput.value = '';
    }

    await loadTenantReportsIntoPage({
      reportAppointmentsListElementId: 'report-appointments-list'
    });
  });
}