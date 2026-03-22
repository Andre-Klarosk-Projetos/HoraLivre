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

function closeMobileMenu() {
  const sidebarNav = document.getElementById('client-tab-nav');
  sidebarNav?.classList.remove('open');
}

export function activateClientTab(tabId) {
  const buttons = getAllTabButtons();
  const panels = getAllTabPanels();

  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-tab-target') === tabId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.id === tabId;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  const activePanel = document.getElementById(tabId);

  if (activePanel) {
    activePanel.scrollIntoView({
      behavior: 'auto',
      block: 'start'
    });
  }

  if (window.innerWidth <= 960) {
    closeMobileMenu();
  }
}

export function bindClientTabs() {
  const buttons = getAllTabButtons();
  const mobileToggle = document.getElementById('sidebar-mobile-toggle');
  const sidebarNav = document.getElementById('client-tab-nav');

  buttons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();

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