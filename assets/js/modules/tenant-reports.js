import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import {
  listAppointmentsByTenantAndPeriod
} from '../services/appointment-service.js';
import {
  getCurrentMonthBillingRecordForTenant
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
  getStartAndEndOfCurrentMonth,
  formatDateTimeForDisplay
} from '../utils/date-utils.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

function buildBillingStatusText(record) {
  if (!record) {
    return {
      title: 'Nenhuma cobrança oficial encontrada para o mês atual.',
      help: 'O resumo abaixo mostra apenas o período filtrado.'
    };
  }

  return {
    title: `Cobrança oficial gerada e ${record.status === 'pending' ? 'pendente' : record.status}. Valor: ${formatCurrencyBRL(record.amount || 0)}.`,
    help: `Referência da cobrança: ${record.reference || '-'} | Status: ${record.status || '-'}`
  };
}

export async function loadTenantReportsIntoPage(options = {}) {
  const startIso = options.startIso || getStartAndEndOfCurrentMonth().startIso;
  const endIso = options.endIso || getStartAndEndOfCurrentMonth().endIso;

  const [appointments, billingRecord] = await Promise.all([
    listAppointmentsByTenantAndPeriod(tenantId, startIso, endIso),
    getCurrentMonthBillingRecordForTenant(tenantId)
  ]);

  const completedAppointments = appointments.filter((appointment) => appointment.status === 'completed');
  const completedCount = completedAppointments.length;
  const totalValue = completedAppointments.reduce((sum, appointment) => {
    return sum + Number(appointment.price || 0);
  }, 0);

  const reportCompletedElement = document.getElementById('report-completed');
  const reportTotalElement = document.getElementById('report-total');
  const reportStatusElement = document.getElementById('report-status');
  const reportStatusHelpElement = document.getElementById('report-status-help');
  const reportAppointmentsListElement = document.getElementById('report-appointments-list');

  if (reportCompletedElement) {
    reportCompletedElement.textContent = String(completedCount);
  }

  if (reportTotalElement) {
    reportTotalElement.textContent = formatCurrencyBRL(totalValue);
  }

  const billingStatusText = buildBillingStatusText(billingRecord);

  if (reportStatusElement) {
    reportStatusElement.textContent = billingStatusText.title;
  }

  if (reportStatusHelpElement) {
    reportStatusHelpElement.textContent = billingStatusText.help;
  }

  if (!reportAppointmentsListElement) {
    return;
  }

  clearElement(reportAppointmentsListElement);

  if (!completedAppointments.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'entity-card empty-state-item';
    emptyItem.innerHTML = `
      <div class="entity-card-body">
        <strong>Nenhum atendimento concluído encontrado</strong>
        <p>Não há atendimentos concluídos para o período filtrado.</p>
      </div>
    `;
    reportAppointmentsListElement.appendChild(emptyItem);
    return;
  }

  completedAppointments.forEach((appointment) => {
    const listItem = document.createElement('li');
    listItem.className = 'entity-card';

    listItem.innerHTML = `
      <div class="entity-card-header">
        <div class="entity-title-group">
          <strong>${appointment.customerName || '-'}</strong>
          <span class="status-badge completed">${formatAppointmentStatus(appointment.status)}</span>
        </div>
      </div>

      <div class="entity-card-body">
        <div class="entity-grid-details">
          <div>
            <span class="detail-label">Serviço</span>
            <span>${appointment.serviceName || '-'}</span>
          </div>
          <div>
            <span class="detail-label">Valor</span>
            <span>${formatCurrencyBRL(appointment.price || 0)}</span>
          </div>
          <div>
            <span class="detail-label">Início</span>
            <span>${formatDateTimeForDisplay(appointment.startAt)}</span>
          </div>
          <div>
            <span class="detail-label">Fim</span>
            <span>${formatDateTimeForDisplay(appointment.endAt)}</span>
          </div>
        </div>
      </div>
    `;

    reportAppointmentsListElement.appendChild(listItem);
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

    await loadTenantReportsIntoPage();
  });
}