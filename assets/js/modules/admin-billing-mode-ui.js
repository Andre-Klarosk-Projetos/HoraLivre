function toggleFieldWrapperVisibility(inputId, shouldShow) {
  const inputElement = document.getElementById(inputId);

  if (!inputElement) {
    return;
  }

  const wrapper = inputElement.closest('label');

  if (!wrapper) {
    return;
  }

  wrapper.style.display = shouldShow ? '' : 'none';
}

function applyBillingModeVisibility(mode, fieldIds) {
  const isFree = mode === 'free';
  const isMonthly = mode === 'fixed_plan';
  const isAnnual = mode === 'annual_plan';
  const isPerService = mode === 'per_service';

  toggleFieldWrapperVisibility(fieldIds.monthlyPriceId, isMonthly);
  toggleFieldWrapperVisibility(fieldIds.annualPriceId, isAnnual);
  toggleFieldWrapperVisibility(fieldIds.annualBillingMonthId, isAnnual);
  toggleFieldWrapperVisibility(fieldIds.perServicePriceId, isPerService);

  if (isFree) {
    toggleFieldWrapperVisibility(fieldIds.monthlyPriceId, false);
    toggleFieldWrapperVisibility(fieldIds.annualPriceId, false);
    toggleFieldWrapperVisibility(fieldIds.annualBillingMonthId, false);
    toggleFieldWrapperVisibility(fieldIds.perServicePriceId, false);
  }
}

export function bindBillingModeVisibility(selectId, fieldIds) {
  const selectElement = document.getElementById(selectId);

  if (!selectElement) {
    return;
  }

  const updateVisibility = () => {
    applyBillingModeVisibility(selectElement.value, fieldIds);
  };

  selectElement.addEventListener('change', updateVisibility);
  updateVisibility();
}

export function refreshBillingModeVisibility(selectId, fieldIds) {
  const selectElement = document.getElementById(selectId);

  if (!selectElement) {
    return;
  }

  applyBillingModeVisibility(selectElement.value, fieldIds);
}