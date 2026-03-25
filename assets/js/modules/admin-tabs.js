const DEFAULT_TAB_ID = 'dashboard-tab';
const STORAGE_KEY = 'horalivre_admin_active_tab';

function getAllAdminTabButtons() {
  return [...document.querySelectorAll('[data-admin-tab-target]')];
}

function getAllAdminTabPanels() {
  return [...document.querySelectorAll('[data-admin-tab-panel], .tab-panel')];
}

function closeAdminMobileMenu() {
  const sidebarNav = document.getElementById('admin-tab-nav');
  sidebarNav?.classList.remove('open');
}

function getTabIdFromHash() {
  const hash = String(window.location.hash || '').replace('#', '').trim();
  return hash || null;
}

function persistActiveTab(tabId) {
  try {
    localStorage.setItem(STORAGE_KEY, tabId);
  } catch (error) {
    console.error('Não foi possível persistir a aba ativa.', error);
  }
}

function readPersistedTab() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Não foi possível ler a aba persistida.', error);
    return null;
  }
}

function isValidTabId(tabId) {
  return Boolean(document.getElementById(tabId));
}

export function activateAdminTab(tabId, options = {}) {
  const {
    updateHash = true,
    scrollToTop = true
  } = options;

  const targetTabId = isValidTabId(tabId) ? tabId : DEFAULT_TAB_ID;

  const buttons = getAllAdminTabButtons();
  const panels = getAllAdminTabPanels();

  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-admin-tab-target') === targetTabId;

    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.id === targetTabId;

    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  persistActiveTab(targetTabId);

  if (updateHash) {
    history.replaceState(null, '', `#${targetTabId}`);
  }

  if (scrollToTop) {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  if (window.innerWidth <= 960) {
    closeAdminMobileMenu();
  }
}

function bindTabButtons() {
  const buttons = getAllAdminTabButtons();

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
}

function bindMobileToggle() {
  const mobileToggle = document.getElementById('admin-sidebar-mobile-toggle');
  const sidebarNav = document.getElementById('admin-tab-nav');

  mobileToggle?.addEventListener('click', () => {
    sidebarNav?.classList.toggle('open');
  });
}

function resolveInitialTab() {
  const hashTab = getTabIdFromHash();

  if (hashTab && isValidTabId(hashTab)) {
    return hashTab;
  }

  const persistedTab = readPersistedTab();

  if (persistedTab && isValidTabId(persistedTab)) {
    return persistedTab;
  }

  return DEFAULT_TAB_ID;
}

function bindHashChange() {
  window.addEventListener('hashchange', () => {
    const hashTab = getTabIdFromHash();

    if (!hashTab || !isValidTabId(hashTab)) {
      return;
    }

    activateAdminTab(hashTab, {
      updateHash: false
    });
  });
}

export function openAdminCompanyDetails(tenantId) {
  if (!tenantId) {
    return;
  }

  activateAdminTab('companies-tab');

  window.dispatchEvent(
    new CustomEvent('horalivre:open-admin-company', {
      detail: { tenantId }
    })
  );
}

export function bindAdminTabs() {
  bindTabButtons();
  bindMobileToggle();
  bindHashChange();

  activateAdminTab(resolveInitialTab(), {
    updateHash: true,
    scrollToTop: false
  });
}

bindAdminTabs();
