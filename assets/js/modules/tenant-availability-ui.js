import { WEEKDAY_OPTIONS } from '../utils/business-hours.js';

let holidayDates = [];
let blockedDates = [];
let specialDates = [];
let selectedWorkingDays = [];

function sortDateStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sortSpecialDates(values) {
  return [...values].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function renderWorkingDaysChips() {
  const container = document.getElementById('working-days-chips');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  WEEKDAY_OPTIONS.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `day-chip ${selectedWorkingDays.includes(day.value) ? 'active' : ''}`;
    button.textContent = day.label;

    button.addEventListener('click', () => {
      if (selectedWorkingDays.includes(day.value)) {
        selectedWorkingDays = selectedWorkingDays.filter((item) => item !== day.value);
      } else {
        selectedWorkingDays = [...selectedWorkingDays, day.value];
      }

      renderWorkingDaysChips();
      renderAvailabilitySummary();
    });

    container.appendChild(button);
  });
}

function createTagItem(label, onRemove) {
  const item = document.createElement('div');
  item.className = 'tag-item';

  const text = document.createElement('span');
  text.textContent = label;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', onRemove);

  item.appendChild(text);
  item.appendChild(removeButton);

  return item;
}

function renderHolidayList() {
  const container = document.getElementById('holiday-list');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  sortDateStrings(holidayDates).forEach((date) => {
    container.appendChild(
      createTagItem(date, () => {
        holidayDates = holidayDates.filter((item) => item !== date);
        renderHolidayList();
        renderAvailabilitySummary();
      })
    );
  });
}

function renderBlockedDateList() {
  const container = document.getElementById('blocked-date-list');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  sortDateStrings(blockedDates).forEach((date) => {
    container.appendChild(
      createTagItem(date, () => {
        blockedDates = blockedDates.filter((item) => item !== date);
        renderBlockedDateList();
        renderAvailabilitySummary();
      })
    );
  });
}

function formatSpecialDateLabel(item) {
  if (item.isClosed) {
    return `${item.date} - fechado`;
  }

  return `${item.date} - ${item.openingTime || '--:--'} às ${item.closingTime || '--:--'}`;
}

function renderSpecialDateList() {
  const container = document.getElementById('special-date-list');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  sortSpecialDates(specialDates).forEach((item) => {
    container.appendChild(
      createTagItem(formatSpecialDateLabel(item), () => {
        specialDates = specialDates.filter((current) => current.date !== item.date);
        renderSpecialDateList();
        renderAvailabilitySummary();
      })
    );
  });
}

export function renderAvailabilitySummary() {
  const container = document.getElementById('company-availability-summary');

  if (!container) {
    return;
  }

  const openingTime = document.getElementById('company-form-opening-time')?.value || '--:--';
  const closingTime = document.getElementById('company-form-closing-time')?.value || '--:--';
  const lunchStartTime = document.getElementById('company-form-lunch-start-time')?.value || '-';
  const lunchEndTime = document.getElementById('company-form-lunch-end-time')?.value || '-';
  const slotInterval = document.getElementById('company-form-slot-interval-minutes')?.value || '-';

  const selectedDayLabels = WEEKDAY_OPTIONS
    .filter((item) => selectedWorkingDays.includes(item.value))
    .map((item) => item.label)
    .join(', ');

  container.innerHTML = `
    <div><strong>Dias:</strong> ${selectedDayLabels || 'Nenhum selecionado'}</div>
    <div><strong>Horário padrão:</strong> ${openingTime} às ${closingTime}</div>
    <div><strong>Almoço:</strong> ${lunchStartTime} às ${lunchEndTime}</div>
    <div><strong>Intervalo:</strong> ${slotInterval} minutos</div>
    <div><strong>Feriados:</strong> ${holidayDates.length}</div>
    <div><strong>Datas fechadas:</strong> ${blockedDates.length}</div>
    <div><strong>Datas especiais:</strong> ${specialDates.length}</div>
  `;
}

export function getAvailabilityUiState() {
  return {
    workingDays: [...selectedWorkingDays],
    holidays: [...holidayDates],
    blockedDates: [...blockedDates],
    specialDates: [...specialDates]
  };
}

export function setAvailabilityUiState(value = {}) {
  selectedWorkingDays = Array.isArray(value.workingDays) ? value.workingDays.map(String) : [];
  holidayDates = Array.isArray(value.holidays) ? value.holidays.map(String) : [];
  blockedDates = Array.isArray(value.blockedDates) ? value.blockedDates.map(String) : [];
  specialDates = Array.isArray(value.specialDates) ? [...value.specialDates] : [];

  renderWorkingDaysChips();
  renderHolidayList();
  renderBlockedDateList();
  renderSpecialDateList();
  renderAvailabilitySummary();
}

export function bindAvailabilityUi() {
  const addHolidayButton = document.getElementById('add-holiday-button');
  const holidayDateInput = document.getElementById('holiday-date-input');

  const addBlockedDateButton = document.getElementById('add-blocked-date-button');
  const blockedDateInput = document.getElementById('blocked-date-input');

  const addSpecialDateButton = document.getElementById('add-special-date-button');

  addHolidayButton?.addEventListener('click', () => {
    const value = holidayDateInput?.value || '';

    if (!value || holidayDates.includes(value)) {
      return;
    }

    holidayDates = [...holidayDates, value];
    holidayDateInput.value = '';
    renderHolidayList();
    renderAvailabilitySummary();
  });

  addBlockedDateButton?.addEventListener('click', () => {
    const value = blockedDateInput?.value || '';

    if (!value || blockedDates.includes(value)) {
      return;
    }

    blockedDates = [...blockedDates, value];
    blockedDateInput.value = '';
    renderBlockedDateList();
    renderAvailabilitySummary();
  });

  addSpecialDateButton?.addEventListener('click', () => {
    const date = document.getElementById('special-date-date')?.value || '';
    const isClosed = document.getElementById('special-date-is-closed')?.value === 'true';
    const openingTime = document.getElementById('special-date-opening-time')?.value || '';
    const closingTime = document.getElementById('special-date-closing-time')?.value || '';
    const lunchStartTime = document.getElementById('special-date-lunch-start-time')?.value || '';
    const lunchEndTime = document.getElementById('special-date-lunch-end-time')?.value || '';
    const slotIntervalMinutes = Number(
      document.getElementById('special-date-slot-interval-minutes')?.value || 30
    );

    if (!date) {
      return;
    }

    const payload = {
      date,
      isClosed,
      openingTime,
      closingTime,
      lunchStartTime,
      lunchEndTime,
      slotIntervalMinutes
    };

    specialDates = specialDates.filter((item) => item.date !== date);
    specialDates.push(payload);

    document.getElementById('special-date-date').value = '';
    document.getElementById('special-date-is-closed').value = 'false';
    document.getElementById('special-date-opening-time').value = '';
    document.getElementById('special-date-closing-time').value = '';
    document.getElementById('special-date-lunch-start-time').value = '';
    document.getElementById('special-date-lunch-end-time').value = '';
    document.getElementById('special-date-slot-interval-minutes').value = '30';

    renderSpecialDateList();
    renderAvailabilitySummary();
  });

  [
    'company-form-opening-time',
    'company-form-closing-time',
    'company-form-lunch-start-time',
    'company-form-lunch-end-time',
    'company-form-slot-interval-minutes'
  ].forEach((id) => {
    const element = document.getElementById(id);
    element?.addEventListener('change', renderAvailabilitySummary);
  });

  renderWorkingDaysChips();
  renderHolidayList();
  renderBlockedDateList();
  renderSpecialDateList();
  renderAvailabilitySummary();
}