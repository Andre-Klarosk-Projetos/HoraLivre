import { normalizeBusinessHours } from '../utils/business-hours.js';

const WEEK_DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

const DEFAULT_STATE = {
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  holidays: [],
  blockedDates: [],
  specialDates: []
};

function getDayCheckbox(dayKey) {
  return document.querySelector(
    `[data-availability-day="${dayKey}"], [name="workingDays"][value="${dayKey}"]`
  );
}

function getSummaryElement() {
  return document.getElementById('availability-summary');
}

function getHolidayDatesInput() {
  return document.getElementById('company-form-holidays');
}

function getBlockedDatesInput() {
  return document.getElementById('company-form-blocked-dates');
}

function getSpecialDatesContainer() {
  return document.getElementById('company-form-special-dates-list');
}

function getAddSpecialDateButton() {
  return document.getElementById('company-form-add-special-date-button');
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeDateListFromText(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSpecialDateItem(item = {}) {
  return {
    date: normalizeString(item.date),
    openingTime: normalizeString(item.openingTime || item.start),
    closingTime: normalizeString(item.closingTime || item.end),
    lunchStartTime: normalizeString(item.lunchStartTime),
    lunchEndTime: normalizeString(item.lunchEndTime),
    enabled: item.enabled !== false
  };
}

function normalizeSpecialDates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSpecialDateItem(item))
    .filter((item) => item.date);
}

function buildEmptySpecialDate() {
  return {
    date: '',
    openingTime: '',
    closingTime: '',
    lunchStartTime: '',
    lunchEndTime: '',
    enabled: true
  };
}

function createSpecialDateRowElement(item = {}) {
  const normalized = normalizeSpecialDateItem(item);
  const row = document.createElement('div');

  row.className = 'special-date-row';
  row.innerHTML = `
    <div class="special-date-row-fields">
      <label>
        <span>Data</span>
        <input type="date" data-special-date-field="date" value="${normalized.date || ''}">
      </label>

      <label>
        <span>Abertura</span>
        <input type="time" data-special-date-field="openingTime" value="${normalized.openingTime || ''}">
      </label>

      <label>
        <span>Fechamento</span>
        <input type="time" data-special-date-field="closingTime" value="${normalized.closingTime || ''}">
      </label>

      <label>
        <span>Início do almoço</span>
        <input type="time" data-special-date-field="lunchStartTime" value="${normalized.lunchStartTime || ''}">
      </label>

      <label>
        <span>Fim do almoço</span>
        <input type="time" data-special-date-field="lunchEndTime" value="${normalized.lunchEndTime || ''}">
      </label>

      <label class="special-date-enabled-field">
        <span>Ativo</span>
        <input type="checkbox" data-special-date-field="enabled" ${normalized.enabled ? 'checked' : ''}>
      </label>
    </div>

    <div class="special-date-row-actions">
      <button type="button" data-special-date-action="remove">Remover</button>
    </div>
  `;

  const removeButton = row.querySelector('[data-special-date-action="remove"]');

  removeButton?.addEventListener('click', () => {
    row.remove();
    renderAvailabilitySummary();
  });

  row.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', () => {
      renderAvailabilitySummary();
    });
  });

  return row;
}

function getSelectedWorkingDays() {
  return WEEK_DAYS
    .filter((day) => {
      const checkbox = getDayCheckbox(day.key);
      return Boolean(checkbox?.checked);
    })
    .map((day) => day.key);
}

function setSelectedWorkingDays(workingDays = []) {
  const normalizedWorkingDays = Array.isArray(workingDays) && workingDays.length
    ? workingDays
    : DEFAULT_STATE.workingDays;

  WEEK_DAYS.forEach((day) => {
    const checkbox = getDayCheckbox(day.key);

    if (!checkbox) {
      return;
    }

    checkbox.checked = normalizedWorkingDays.includes(day.key);
  });
}

function getSpecialDatesFromUi() {
  const container = getSpecialDatesContainer();

  if (!container) {
    return [];
  }

  const rows = Array.from(container.querySelectorAll('.special-date-row'));

  return rows
    .map((row) => {
      const date = row.querySelector('[data-special-date-field="date"]')?.value || '';
      const openingTime = row.querySelector('[data-special-date-field="openingTime"]')?.value || '';
      const closingTime = row.querySelector('[data-special-date-field="closingTime"]')?.value || '';
      const lunchStartTime = row.querySelector('[data-special-date-field="lunchStartTime"]')?.value || '';
      const lunchEndTime = row.querySelector('[data-special-date-field="lunchEndTime"]')?.value || '';
      const enabled = Boolean(
        row.querySelector('[data-special-date-field="enabled"]')?.checked
      );

      return {
        date,
        openingTime,
        closingTime,
        lunchStartTime,
        lunchEndTime,
        enabled
      };
    })
    .filter((item) => item.date);
}

function setSpecialDatesIntoUi(specialDates = []) {
  const container = getSpecialDatesContainer();

  if (!container) {
    return;
  }

  container.innerHTML = '';

  const normalizedSpecialDates = normalizeSpecialDates(specialDates);

  if (!normalizedSpecialDates.length) {
    return;
  }

  normalizedSpecialDates.forEach((item) => {
    container.appendChild(createSpecialDateRowElement(item));
  });
}

function buildWorkingDaysSummary(workingDays = []) {
  if (!workingDays.length) {
    return 'Nenhum dia selecionado';
  }

  return WEEK_DAYS
    .filter((day) => workingDays.includes(day.key))
    .map((day) => day.label)
    .join(', ');
}

function buildDateListSummary(label, values = []) {
  if (!values.length) {
    return `${label}: nenhuma`;
  }

  return `${label}: ${values.join(', ')}`;
}

function buildSpecialDatesSummary(specialDates = []) {
  if (!specialDates.length) {
    return 'Datas especiais: nenhuma';
  }

  const items = specialDates.map((item) => {
    if (!item.enabled) {
      return `${item.date} (fechado)`;
    }

    return `${item.date} (${item.openingTime || '--:--'} às ${item.closingTime || '--:--'})`;
  });

  return `Datas especiais: ${items.join(', ')}`;
}

export function getAvailabilityUiState() {
  const holidaysInput = getHolidayDatesInput();
  const blockedDatesInput = getBlockedDatesInput();

  return {
    workingDays: getSelectedWorkingDays(),
    holidays: normalizeDateListFromText(holidaysInput?.value || ''),
    blockedDates: normalizeDateListFromText(blockedDatesInput?.value || ''),
    specialDates: getSpecialDatesFromUi()
  };
}

export function setAvailabilityUiState(rawBusinessHours = {}) {
  const normalized = normalizeBusinessHours(rawBusinessHours);
  const holidaysInput = getHolidayDatesInput();
  const blockedDatesInput = getBlockedDatesInput();

  setSelectedWorkingDays(normalized.workingDays);

  if (holidaysInput) {
    holidaysInput.value = (normalized.holidays || []).join('\n');
  }

  if (blockedDatesInput) {
    blockedDatesInput.value = (normalized.blockedDates || []).join('\n');
  }

  setSpecialDatesIntoUi(normalized.specialDates || []);
  renderAvailabilitySummary();
}

export function renderAvailabilitySummary() {
  const summaryElement = getSummaryElement();

  if (!summaryElement) {
    return;
  }

  const state = getAvailabilityUiState();

  summaryElement.innerHTML = `
    <p><strong>Dias de atendimento:</strong> ${buildWorkingDaysSummary(state.workingDays)}</p>
    <p>${buildDateListSummary('Feriados', state.holidays)}</p>
    <p>${buildDateListSummary('Datas bloqueadas', state.blockedDates)}</p>
    <p>${buildSpecialDatesSummary(state.specialDates)}</p>
  `;
}

export function addSpecialDateRow(item = {}) {
  const container = getSpecialDatesContainer();

  if (!container) {
    return;
  }

  const row = createSpecialDateRowElement(
    item && Object.keys(item).length ? item : buildEmptySpecialDate()
  );

  container.appendChild(row);
  renderAvailabilitySummary();
}

export function bindAvailabilityUi() {
  WEEK_DAYS.forEach((day) => {
    const checkbox = getDayCheckbox(day.key);

    checkbox?.addEventListener('change', () => {
      renderAvailabilitySummary();
    });
  });

  getHolidayDatesInput()?.addEventListener('input', () => {
    renderAvailabilitySummary();
  });

  getBlockedDatesInput()?.addEventListener('input', () => {
    renderAvailabilitySummary();
  });

  getAddSpecialDateButton()?.addEventListener('click', () => {
    addSpecialDateRow();
  });

  renderAvailabilitySummary();
}
