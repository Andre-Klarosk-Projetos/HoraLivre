function getAllAdminTabButtons() {
  return [
    ...document.querySelectorAll('[data-admin-tab-target]')
  ];
}

function getAllAdminTabPanels() {
  return [
    ...document.querySelectorAll('.tab-panel')
  ];
}

function closeAdminMobileMenu() {
  const sidebarNav = document.getElementById('admin-tab-nav');
  sidebarNav?.classList.remove('open');
}

export function activateAdminTab(tabId) {
  const buttons = getAllAdminTabButtons();
  const panels = getAllAdminTabPanels();

  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-admin-tab-target') === tabId;
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
    closeAdminMobileMenu();
  }
}

export function bindAdminTabs() {
  const buttons = getAllAdminTabButtons();
  const mobileToggle = document.getElementById('admin-sidebar-mobile-toggle');
  const sidebarNav = document.getElementById('admin-tab-nav');

  buttons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();

      const tabId = button.getAttribute('data-admin-tab-target');

      if (!tabId) {
        return;
      }

      activateAdminTab(tabId);
    });
  });

  mobileToggle?.addEventListener('click', () => {
    sidebarNav?.classList.toggle('open');
  });

  activateAdminTab('dashboard-tab');
}