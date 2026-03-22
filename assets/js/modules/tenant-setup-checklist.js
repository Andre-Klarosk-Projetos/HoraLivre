import { requireTenantUser } from '../utils/guards.js';
import { getTenantId } from '../state/session-store.js';
import { getTenantById } from '../services/tenant-service.js';
import { listServicesByTenant } from '../services/service-service.js';
import { clearElement } from '../utils/dom-utils.js';
import { activateClientTab } from './tenant-tabs.js';

if (!requireTenantUser()) {
  throw new Error('Acesso negado.');
}

const tenantId = getTenantId();

function hasBasicCompanyData(tenant) {
  return Boolean(
    String(tenant?.businessName || '').trim() &&
    String(tenant?.whatsapp || '').trim()
  );
}

function hasPublicSlug(tenant) {
  return Boolean(String(tenant?.slug || '').trim());
}

function hasServices(services) {
  return Array.isArray(services) && services.length > 0;
}

function hasBusinessHoursConfigured(tenant) {
  const businessHours = tenant?.businessHours || {};

  return Object.values(businessHours).some((item) => {
    return item?.enabled === true &&
      String(item?.start || '').trim() &&
      String(item?.end || '').trim();
  });
}

function isPublicPageReady(tenant) {
  return tenant?.publicPageEnabled === true;
}

function buildChecklistItems(tenant, services) {
  return [
    {
      id: 'company-data',
      title: 'Preencher dados básicos da empresa',
      description: 'Defina nome da empresa e WhatsApp para identificar sua operação.',
      completed: hasBasicCompanyData(tenant),
      targetTab: 'company-tab'
    },
    {
      id: 'public-slug',
      title: 'Configurar slug público',
      description: 'O slug é necessário para sua página pública ter um link próprio.',
      completed: hasPublicSlug(tenant),
      targetTab: 'company-tab'
    },
    {
      id: 'services',
      title: 'Cadastrar pelo menos 1 serviço',
      description: 'Sem serviço, não há opção para o cliente final agendar.',
      completed: hasServices(services),
      targetTab: 'services-tab'
    },
    {
      id: 'business-hours',
      title: 'Configurar horários de atendimento',
      description: 'Defina os dias e horários em que sua empresa atende.',
      completed: hasBusinessHoursConfigured(tenant),
      targetTab: 'company-tab'
    },
    {
      id: 'public-page',
      title: 'Habilitar página pública',
      description: 'Ative sua página pública para começar a receber agendamentos.',
      completed: isPublicPageReady(tenant),
      targetTab: 'company-tab'
    }
  ];
}

function renderProgress(items) {
  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const progressTextElement = document.getElementById('setup-progress-text');
  const progressFillElement = document.getElementById('setup-progress-fill');

  if (progressTextElement) {
    progressTextElement.textContent = `${completedCount} de ${totalCount} concluídos`;
  }

  if (progressFillElement) {
    progressFillElement.style.width = `${percent}%`;
  }
}

function renderChecklist(items) {
  const element = document.getElementById('setup-checklist');

  if (!element) {
    return;
  }

  clearElement(element);

  items.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.className = `setup-checklist-item ${item.completed ? 'completed' : 'pending'}`;

    listItem.innerHTML = `
      <div class="setup-checklist-status">
        ${item.completed ? '✓' : '!'}
      </div>

      <div class="setup-checklist-content">
        <strong>${item.title}</strong>
        <p>${item.description}</p>
        <span class="setup-checklist-badge">
          ${item.completed ? 'Concluído' : 'Pendente'}
        </span>
      </div>

      <div class="setup-checklist-actions">
        <button class="button" type="button" data-setup-target-tab="${item.targetTab}">
          ${item.completed ? 'Revisar' : 'Resolver'}
        </button>
      </div>
    `;

    element.appendChild(listItem);
  });

  const buttons = element.querySelectorAll('[data-setup-target-tab]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-setup-target-tab');

      if (targetTab) {
        activateClientTab(targetTab);
      }
    });
  });
}

export async function renderTenantSetupChecklist() {
  const [tenant, services] = await Promise.all([
    getTenantById(tenantId),
    listServicesByTenant(tenantId)
  ]);

  const items = buildChecklistItems(tenant, services);

  renderProgress(items);
  renderChecklist(items);
}