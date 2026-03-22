function getAllTabButtons() {
  return [
    ...document.querySelectorAll('[data-tab-target]')
  ];
}

function getAllTabPanels() {
  return [
    ...document.querySelectorAll('.tab-panel')
  ];
}

export function activateClientTab(tabId) {
  const buttons = getAllTabButtons();
  const panels = getAllTabPanels();

  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-tab-target') === tabId;
    button.classList.toggle('active', isActive);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === tabId);
  });

  if (window.innerWidth <= 960) {
    const sidebarNav = document.getElementById('client-tab-nav');
    sidebarNav?.classList.remove('open');
  }
}

export function bindClientTabs() {
  const buttons = getAllTabButtons();
  const mobileToggle = document.getElementById('sidebar-mobile-toggle');
  const sidebarNav = document.getElementById('client-tab-nav');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab-target');

      if (!tabId) {
        return;
      }

      activateClientTab(tabId);
    });
  });

  mobileToggle?.addEventListener('click', () => {
    sidebarNav?.classList.toggle('open');
  });

  activateClientTab('dashboard-tab');
}