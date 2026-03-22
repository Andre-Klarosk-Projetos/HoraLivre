function getAllTabButtons() {
  return Array.from(document.querySelectorAll('[data-client-tab-target]'));
}

function getAllTabPanels() {
  return Array.from(document.querySelectorAll('.tab-panel'));
}

export function activateClientTab(tabId) {
  const buttons = getAllTabButtons();
  const panels = getAllTabPanels();

  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-client-tab-target') === tabId;
    button.classList.toggle('active', isActive);
  });

  panels.forEach((panel) => {
    const isActive = panel.id === tabId;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

export function bindClientTabs() {
  const buttons = getAllTabButtons();

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-client-tab-target');

      if (tabId) {
        activateClientTab(tabId);
      }
    });
  });
}