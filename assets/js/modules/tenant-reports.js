import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import { getTenantById } from '../services/tenant-service.js';
import { getPlanById } from '../services/plan-service.js';
import {
  listAppointmentsByTenantAndPeriod
} from '../services/appointment-service.js';
import {
  getBillingSettingsByTenant,
  calculateBillingForPeriod,
  getBillingRecordByTenantAndMonth,
  normalizeMonthReference
} from '../services/billing-service.js';
import {
  formatCurrencyBRL,
  formatAppointmentStatus
} from '../utils/formatters.js';
import {
  clearElement
} from '../utils/dom-utils.js';
import {
  buildStartOfDayIsoFromDateInput,
  buildEndOfDayIsoFromDateInput,
  formatDateTimeForDisplay,
  getMonthReference,
  getStartAndEndOfCurrentMonth,
  normalizeMonthReference as normalizeMonthReferenceFromDateUtils
} from '../utils/date-utils.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

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

function countCompletedAppointments(appointments = []) {
  return appointments.filter((appointment) => appointment.status === 'completed').length;
}

function buildMonthReferenceFromRange(startIso, endIso) {
  if (!startIso || !endIso) {
    return normalizeMonthReference(getMonthReference());
  }

  const startDate = new Date(startIso);
  const endDate = new Date(endIso);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return normalizeMonthReference(getMonthReference());
  }

  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth();

  if (!sameMonth) {
    return '';
  }

  return normalizeMonthReferenceFromDateUtils(
    `${startDate.getFullYear()}/${String(startDate.getMonth() + 1).padStart(2, '0')}`
  );
}

function setTextContent(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function renderReportAppointmentsList(appointments, elementId = 'report-appointments-list') {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  clearElement(element);

  if (!appointments.length) {
    const item = document.createElement('li');
    item.innerHTML = `
      <strong>Nenhum agendamento encontrado</strong><br>
      Não há agendamentos no período selecionado.
    `;
    element.appendChild(item);
    return;
  }

  appointments.forEach((appointment) => {
    const item = document.createElement('li');

    item.innerHTML = `
      <strong>${appointment.customerName || '-'}</strong><br>
      Serviço: ${appointment.serviceName || '-'}<br>
      Início: ${formatDateTimeForDisplay(appointment.startAt)}<br>
      Fim: ${formatDateTimeForDisplay(appointment.endAt)}<br>
      Status: ${formatAppointmentStatus(appointment.status)}<br>
      Valor: ${formatCurrencyBRL(appointment.price || 0)}
    `;

    element.appendChild(item);
  });
}

function buildBillingStatusText(record, calculatedAmount) {
  if (record) {
    if (record.status === 'paid') {
      return `Cobrança oficial gerada e marcada como paga. Valor: ${formatCurrencyBRL(record.totalAmount || 0)}.`;
    }

    return `Cobrança oficial gerada e pendente. Valor: ${formatCurrencyBRL(record.totalAmount || 0)}.`;
  }

  if (Number(calculatedAmount || 0) > 0) {
    return 'Cálculo em tempo real do período selecionado. A cobrança oficial aparece quando o admin gerar o fechamento.';
  }

  return 'Sem cobrança no período selecionado.';
}

export async function loadTenantReportsIntoPage(options = {}) {
  const reportAppointmentsListElementId =
    options.reportAppointmentsListElementId || 'report-appointments-list';

  const reportStartInput = document.getElementById('report-filter-start');
  const reportEndInput = document.getElementById('report-filter-end');

  let startIso = '';
  let endIso = '';

  if (reportStartInput?.value && reportEndInput?.value) {
    startIso = buildStartOfDayIsoFromDateInput(reportStartInput.value);
    endIso = buildEndOfDayIsoFromDateInput(reportEndInput.value);
  } else {
    const currentMonth = getStartAndEndOfCurrentMonth();
    startIso = currentMonth.startIso;
    endIso = currentMonth.endIso;

    if (reportStartInput && !reportStartInput.value) {
      reportStartInput.value = currentMonth.startIso.slice(0, 10);
    }

    if (reportEndInput && !reportEndInput.value) {
      reportEndInput.value = currentMonth.endIso.slice(0, 10);
    }
  }

  const [tenant, billingSettings, appointments] = await Promise.all([
    getTenantById(tenantId),
    getBillingSettingsByTenant(tenantId),
    listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso)
  ]);

  const plan = tenant?.planId ? await getPlanById(tenant.planId) : null;

  const completedAppointments = countCompletedAppointments(appointments);

  const effectiveBillingMode = resolveEffectiveBillingMode(tenant, billingSettings, plan);
  const effectiveFixedPrice = resolveEffectiveFixedPrice(tenant, billingSettings, plan);
  const effectiveUnitPrice = resolveEffectiveUnitPrice(tenant, billingSettings, plan);

  const calculatedAmount = calculateBillingForPeriod({
    billingMode: effectiveBillingMode,
    completedAppointments,
    fixedMonthlyPrice: effectiveFixedPrice,
    pricePerExecutedService: effectiveUnitPrice
  });

  const monthReference = buildMonthReferenceFromRange(startIso, endIso);
  const billingRecord = monthReference
    ? await getBillingRecordByTenantAndMonth(tenantId, monthReference)
    : null;

  const displayedAmount = billingRecord
    ? Number(billingRecord.totalAmount || 0)
    : Number(calculatedAmount || 0);

  setTextContent('report-completed', String(completedAppointments));
  setTextContent('report-total', formatCurrencyBRL(displayedAmount));
  setTextContent('report-status', buildBillingStatusText(billingRecord, calculatedAmount));

  const reportStatusHelp = document.getElementById('report-status-help');

  if (reportStatusHelp) {
    if (billingRecord) {
      reportStatusHelp.textContent =
        `Referência da cobrança: ${billingRecord.monthRef || '-'} | Status: ${billingRecord.status || '-'}.`;
    } else if (monthReference) {
      reportStatusHelp.textContent =
        `Referência calculada: ${monthReference}. Ainda não existe cobrança oficial salva para este mês.`;
    } else {
      reportStatusHelp.textContent =
        'O período selecionado cobre mais de um mês. O valor mostrado é apenas cálculo em tempo real.';
    }
  }

  renderReportAppointmentsList(appointments, reportAppointmentsListElementId);
}

export function bindReportFilters() {
  const filterButton = document.getElementById('report-filter-button');
  const resetButton = document.getElementById('report-filter-reset-button');
  const startInput = document.getElementById('report-filter-start');
  const endInput = document.getElementById('report-filter-end');

  filterButton?.addEventListener('click', async () => {
    await loadTenantReportsIntoPage({
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