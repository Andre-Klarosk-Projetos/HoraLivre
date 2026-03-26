import { requireAdmin } from '../utils/guards.js';
import { listTenants } from '../services/tenant-service.js';
import { listPlans } from '../services/plan-service.js';
import { listBillingRecords } from '../services/billing-service.js';
import {
  formatBillingMode,
  formatCurrencyBRL,
  formatSubscriptionStatus
} from '../utils/formatters.js';
import { activateAdminTab, openAdminCompanyDetails } from './admin-tabs.js';

if (!requireAdmin()) {
  throw new Error('Acesso negado.');
}

let cachedSearchData = {
  tenants: [],
  plans: [],
  billing: []
};

function getSearchInput() {
  return document.getElementById('admin-global-search-input');
}

function getClearButton() {
  return document.getElementById('admin-global-search-clear');
}

function getResultsContainer() {
  return document.getElementById('admin-global-search-results');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getPlanName(planId) {
  return cachedSearchData.plans.find((plan) => plan.id === planId)?.name || 'Plano não encontrado';
}

function buildTenantSearchIndex(tenant) {
  return normalizeText([
    tenant.businessName,
    tenant.slug,
    tenant.whatsapp,
    tenant.planId,
    getPlanName(tenant.planId),
    tenant.subscriptionStatus,
    tenant.billingMode
  ].join(' '));
}

function buildPlanSearchIndex(plan) {
  return normalizeText([
    plan.name,
    plan.description,
    plan.billingMode
  ].join(' '));
}

function buildBillingSearchIndex(record) {
  const tenant = cachedSearchData.tenants.find(
    (item) => item.id === (record.tenantId || record.companyId)
  );

  return normalizeText([
    tenant?.businessName,
    tenant?.slug,
    tenant?.whatsapp,
    record.referenceMonth,
    record.status,
    record.billingMode
  ].join(' '));
}

function searchTenants(query) {
  if (!query) {
    return [];
  }

  return cachedSearchData.tenants
    .filter((tenant) => buildTenantSearchIndex(tenant).includes(query))
    .slice(0, 6);
}

function searchPlans(query) {
  if (!query) {
    return [];
  }

  return cachedSearchData.plans
    .filter((plan) => buildPlanSearchIndex(plan).includes(query))
    .slice(0, 5);
}

function searchBilling(query) {
  if (!query) {
    return [];
  }

  return cachedSearchData.billing
    .filter((record) => buildBillingSearchIndex(record).includes(query))
    .slice(0, 6);
}

function buildTenantResultHtml(tenant) {
  return `
    <button
      type="button"
      class="admin-search-result-item"
      data-search-action="open-company"
      data-tenant-id="${escapeHtml(tenant.id)}"
    >
      <div class="admin-search-result-main">
        <strong>${escapeHtml(tenant.businessName || 'Empresa sem nome')}</strong>
        <span>${escapeHtml(getPlanName(tenant.planId))}</span>
      </div>
      <div class="admin-search-result-meta">
        <span>${escapeHtml(formatSubscriptionStatus(tenant.subscriptionStatus))}</span>
        <span>${escapeHtml(formatBillingMode(tenant.billingMode))}</span>
      </div>
    </button>
  `;
}

function buildPlanResultHtml(plan) {
  return `
    <button
      type="button"
      class="admin-search-result-item"
      data-search-action="open-plan"
      data-plan-id="${escapeHtml(plan.id)}"
    >
      <div class="admin-search-result-main">
        <strong>${escapeHtml(plan.name || 'Plano sem nome')}</strong>
        <span>${escapeHtml(plan.description || 'Sem descrição')}</span>
      </div>
      <div class="admin-search-result-meta">
        <span>${escapeHtml(formatBillingMode(plan.billingMode))}</span>
        <span>${escapeHtml(formatCurrencyBRL(plan.price || 0))}</span>
      </div>
    </button>
  `;
}

function buildBillingResultHtml(record) {
  const tenant = cachedSearchData.tenants.find(
    (item) => item.id === (record.tenantId || record.companyId)
  );

  return `
    <button
      type="button"
      class="admin-search-result-item"
      data-search-action="open-billing"
      data-reference-month="${escapeHtml(record.referenceMonth || '')}"
      data-billing-status="${escapeHtml(record.status || '')}"
      data-tenant-id="${escapeHtml(record.tenantId || record.companyId || '')}"
    >
      <div class="admin-search-result-main">
        <strong>${escapeHtml(tenant?.businessName || 'Cobrança sem empresa')}</strong>
        <span>Referência: ${escapeHtml(record.referenceMonth || '-')}</span>
      </div>
      <div class="admin-search-result-meta">
        <span>${escapeHtml(record.status || 'pending')}</span>
        <span>${escapeHtml(formatCurrencyBRL(record.amount ?? record.expectedAmount ?? 0))}</span>
      </div>
    </button>
  `;
}

function buildSearchSectionHtml(title, itemsHtml) {
  if (!itemsHtml.length) {
    return '';
  }

  return `
    <section class="admin-search-result-group">
      <h4>${escapeHtml(title)}</h4>
      <div class="admin-search-result-group-list">
        ${itemsHtml.join('')}
      </div>
    </section>
  `;
}

function bindSearchResultActions() {
  const container = getResultsContainer();

  if (!container) {
    return;
  }

  container.querySelectorAll('[data-search-action="open-company"]').forEach((button) => {
    button.addEventListener('click', () => {
      const tenantId = button.getAttribute('data-tenant-id');

      if (!tenantId) {
        return;
      }

      openAdminCompanyDetails(tenantId);
      hideResults();
    });
  });

  container.querySelectorAll('[data-search-action="open-plan"]').forEach((button) => {
    button.addEventListener('click', () => {
      const planId = button.getAttribute('data-plan-id');

      if (!planId) {
        return;
      }

      activateAdminTab('plans-tab');

      window.dispatchEvent(
        new CustomEvent('horalivre:open-admin-plan', {
          detail: { planId }
        })
      );

      hideResults();
    });
  });

  container.querySelectorAll('[data-search-action="open-billing"]').forEach((button) => {
    button.addEventListener('click', () => {
      const referenceMonth = button.getAttribute('data-reference-month') || '';
      const status = button.getAttribute('data-billing-status') || '';

      activateAdminTab('billing-tab');

      const monthInput = document.getElementById('billing-month-filter');
      const statusInput = document.getElementById('billing-status-filter');

      if (monthInput && referenceMonth) {
        monthInput.value = referenceMonth;
        monthInput.dispatchEvent(new Event('change'));
      }

      if (statusInput && status) {
        statusInput.value = status;
        statusInput.dispatchEvent(new Event('change'));
      }

      hideResults();
    });
  });
}

function hideResults() {
  const container = getResultsContainer();

  if (!container) {
    return;
  }

  container.hidden = true;
  container.innerHTML = '';
}

function renderResults(query) {
  const container = getResultsContainer();

  if (!container) {
    return;
  }

  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    hideResults();
    return;
  }

  const tenantResults = searchTenants(normalizedQuery);
  const planResults = searchPlans(normalizedQuery);
  const billingResults = searchBilling(normalizedQuery);

  const html = [
    buildSearchSectionHtml(
      'Empresas',
      tenantResults.map((tenant) => buildTenantResultHtml(tenant))
    ),
    buildSearchSectionHtml(
      'Planos',
      planResults.map((plan) => buildPlanResultHtml(plan))
    ),
    buildSearchSectionHtml(
      'Cobrança',
      billingResults.map((record) => buildBillingResultHtml(record))
    )
  ].join('');

  if (!html.trim()) {
    container.hidden = false;
    container.innerHTML = `
      <div class="admin-search-empty">
        <strong>Nenhum resultado encontrado</strong>
        <span>Tente outro termo, como nome da empresa, slug, plano ou referência.</span>
      </div>
    `;
    return;
  }

  container.hidden = false;
  container.innerHTML = html;
  bindSearchResultActions();
}

async function loadSearchData() {
  const [tenants, plans, billing] = await Promise.all([
    listTenants(),
    listPlans(),
    typeof listBillingRecords === 'function'
      ? listBillingRecords()
      : Promise.resolve([])
  ]);

  cachedSearchData = {
    tenants: Array.isArray(tenants) ? tenants : [],
    plans: Array.isArray(plans) ? plans : [],
    billing: Array.isArray(billing) ? billing : []
  };
}

function bindSearchUi() {
  const input = getSearchInput();
  const clearButton = getClearButton();

  input?.addEventListener('input', () => {
    renderResults(input.value);
  });

  input?.addEventListener('focus', () => {
    if (input.value.trim()) {
      renderResults(input.value);
    }
  });

  clearButton?.addEventListener('click', () => {
    if (input) {
      input.value = '';
      input.focus();
    }

    hideResults();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (
      target instanceof Node
      && getResultsContainer()?.contains(target)
    ) {
      return;
    }

    if (
      target instanceof Node
      && getSearchInput()?.contains?.(target)
    ) {
      return;
    }

    if (target === getSearchInput()) {
      return;
    }

    hideResults();
  });

  window.addEventListener('horalivre:admin-data-changed', async () => {
    await loadSearchData();

    if (input?.value?.trim()) {
      renderResults(input.value);
    }
  });
}

async function initAdminSearch() {
  try {
    await loadSearchData();
    bindSearchUi();
  } catch (error) {
    console.error('Erro ao inicializar a busca global do admin.', error);
  }
}

initAdminSearch();
