import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import {
  listAppointmentsByTenant,
  listAppointmentsByTenantAndPeriod
} from '../services/appointment-service.js';
import { listServicesByTenant } from '../services/service-service.js';
import { listCustomersByTenant } from '../services/customer-service.js';
import {
  formatCurrencyBRL,
  formatAppointmentStatus
} from '../utils/formatters.js';
import {
  formatDateTimeForDisplay,
  buildStartOfDayIsoFromDateInput,
  buildEndOfDayIsoFromDateInput
} from '../utils/date-utils.js';
import {
  clearElement,
  setText
} from '../utils/dom-utils.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getReportsFilterValues() {
  const startInput = document.getElementById('reports-filter-start');
  const endInput = document.getElementById('reports-filter-end');

  return {
    startValue: startInput?.value || '',
    endValue: endInput?.value || '',
    startIso: buildStartOfDayIsoFromDateInput(startInput?.value || ''),
    endIso: buildEndOfDayIsoFromDateInput(endInput?.value || '')
  };
}

function getAppointmentStatusClassName(status) {
  if (status === 'scheduled') {
    return 'scheduled';
  }

  if (status === 'confirmed') {
    return 'confirmed';
  }

  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'canceled') {
    return 'canceled';
  }

  if (status === 'no_show') {
    return 'no-show';
  }

  return 'default';
}

function calculateReportsSummary(appointments = [], customers = [], services = []) {
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === 'completed'
  );

  const confirmedAppointments = appointments.filter(
    (appointment) => appointment.status === 'confirmed'
  );

  const scheduledAppointments = appointments.filter(
    (appointment) => appointment.status === 'scheduled'
  );

  const canceledAppointments = appointments.filter(
    (appointment) => appointment.status === 'canceled'
  );

  const noShowAppointments = appointments.filter(
    (appointment) => appointment.status === 'no_show'
  );

  const grossRevenue = completedAppointments.reduce(
    (total, appointment) => total + normalizeNumber(appointment.price, 0),
    0
  );

  return {
    totalAppointments: appointments.length,
    completedAppointments: completedAppointments.length,
    confirmedAppointments: confirmedAppointments.length,
    scheduledAppointments: scheduledAppointments.length,
    canceledAppointments: canceledAppointments.length,
    noShowAppointments: noShowAppointments.length,
    totalCustomers: customers.length,
    totalServices: services.length,
    grossRevenue
  };
}

function buildReportAppointmentCardHtml(appointment) {
  const statusClassName = getAppointmentStatusClassName(appointment.status);

  return `
    <div class="entity-card-header">
      <div>
        <h3>${appointment.customerName || '-'}</h3>
        <span class="appointment-status-badge appointment-status-${statusClassName}">
          ${formatAppointmentStatus(appointment.status)}
        </span>
      </div>
    </div>

    <div class="entity-card-body">
      <p><strong>Serviço</strong><br>${appointment.serviceName || '-'}</p>
      <p><strong>Valor</strong><br>${formatCurrencyBRL(appointment.price || 0)}</p>
      <p><strong>Início</strong><br>${formatDateTimeForDisplay(appointment.startAt)}</p>
      <p><strong>Fim</strong><br>${formatDateTimeForDisplay(appointment.endAt)}</p>
      <p><strong>Origem</strong><br>${appointment.source || '-'}</p>
      <p><strong>Observações</strong><br>${appointment.notes || '-'}</p>
      <p><strong>Identificador</strong><br>${appointment.id}</p>
    </div>
  `;
}

function updateReportsSummaryIntoPage(summary) {
  setText('report-stat-total-appointments', String(summary.totalAppointments));
  setText('report-stat-completed', String(summary.completedAppointments));
  setText('report-stat-confirmed', String(summary.confirmedAppointments));
  setText('report-stat-scheduled', String(summary.scheduledAppointments));
  setText('report-stat-canceled', String(summary.canceledAppointments));
  setText('report-stat-no-show', String(summary.noShowAppointments));
  setText('report-stat-customers', String(summary.totalCustomers));
  setText('report-stat-services', String(summary.totalServices));
  setText('report-stat-gross-revenue', formatCurrencyBRL(summary.grossRevenue));
}

async function getReportData(options = {}) {
  const appointments = (
    options.startIso && options.endIso
      ? await listAppointmentsByTenantAndPeriod(
          tenantId,
          options.startIso,
          options.endIso
        )
      : await listAppointmentsByTenant(tenantId)
  );

  const [customers, services] = await Promise.all([
    listCustomersByTenant(tenantId),
    listServicesByTenant(tenantId)
  ]);

  return {
    appointments,
    customers,
    services,
    summary: calculateReportsSummary(appointments, customers, services)
  };
}

export async function loadTenantReportsIntoPage(options = {}) {
  const {
    reportAppointmentsListElementId = 'report-appointments-list'
  } = options;

  const reportAppointmentsListElement = document.getElementById(
    reportAppointmentsListElementId
  );

  const filterValues = getReportsFilterValues();
  const { appointments, summary } = await getReportData({
    startIso: filterValues.startIso,
    endIso: filterValues.endIso
  });

  updateReportsSummaryIntoPage(summary);

  if (!reportAppointmentsListElement) {
    return;
  }

  clearElement(reportAppointmentsListElement);

  if (!appointments.length) {
    const emptyItem = document.createElement('li');

    emptyItem.className = 'entity-card appointment-card-item empty-state-item';
    emptyItem.innerHTML = `
      <h3>Nenhum agendamento encontrado</h3>
      <p>Não há registros para o filtro selecionado.</p>
    `;

    reportAppointmentsListElement.appendChild(emptyItem);
    return;
  }

  appointments.forEach((appointment) => {
    const listItem = document.createElement('li');
    const statusClassName = getAppointmentStatusClassName(appointment.status);

    listItem.className = `entity-card appointment-card-item appointment-status-${statusClassName}`;
    listItem.innerHTML = buildReportAppointmentCardHtml(appointment);

    reportAppointmentsListElement.appendChild(listItem);
  });
}

export function bindReportFilters(options = {}) {
  const {
    reportAppointmentsListElementId = 'report-appointments-list'
  } = options;

  const applyButton = document.getElementById('reports-filter-button');
  const resetButton = document.getElementById('reports-filter-reset-button');
  const startInput = document.getElementById('reports-filter-start');
  const endInput = document.getElementById('reports-filter-end');

  applyButton?.addEventListener('click', async () => {
    await loadTenantReportsIntoPage({
      reportAppointmentsListElementId
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
      reportAppointmentsListElementId
    });
  });
}
