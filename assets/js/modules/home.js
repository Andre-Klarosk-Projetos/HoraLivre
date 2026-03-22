import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

import { auth, db } from '../config/firebase-init.js';

const openAdminButton = document.getElementById('open-admin-button');
const openClientPanelButton = document.getElementById('open-client-panel-button');
const openPublicPageButton = document.getElementById('open-public-page-button');
const feedbackElement = document.getElementById('home-access-feedback');

let currentAccessProfile = {
  isAuthenticated: false,
  isPlatformAdmin: false,
  isCompanyUser: false,
  companyName: '',
  companyId: '',
  companySlug: '',
  email: ''
};

function showHomeFeedback(message, type = 'info') {
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = message;
  feedbackElement.className = `home-feedback ${type}`;
}

function hideHomeFeedback() {
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = '';
  feedbackElement.className = 'home-feedback hidden';
}

async function resolveCurrentProfile(user) {
  if (!user) {
    currentAccessProfile = {
      isAuthenticated: false,
      isPlatformAdmin: false,
      isCompanyUser: false,
      companyName: '',
      companyId: '',
      companySlug: '',
      email: ''
    };
    return;
  }

  const adminReference = doc(db, 'platformAdmins', user.uid);
  const companyUserReference = doc(db, 'tenantUsers', user.uid);

  const [adminSnapshot, companyUserSnapshot] = await Promise.all([
    getDoc(adminReference),
    getDoc(companyUserReference)
  ]);

  let companyName = '';
  let companyId = '';
  let companySlug = '';

  if (companyUserSnapshot.exists()) {
    const companyUserData = companyUserSnapshot.data();
    companyId = companyUserData.tenantId || '';

    if (companyId) {
      const companyReference = doc(db, 'tenants', companyId);
      const companySnapshot = await getDoc(companyReference);

      if (companySnapshot.exists()) {
        const companyData = companySnapshot.data();
        companyName = companyData.businessName || '';
        companySlug = companyData.slug || '';
      }
    }
  }

  currentAccessProfile = {
    isAuthenticated: true,
    isPlatformAdmin: adminSnapshot.exists(),
    isCompanyUser: companyUserSnapshot.exists(),
    companyName,
    companyId,
    companySlug,
    email: user.email || ''
  };
}

function redirectToLogin() {
  window.location.href = './login.html';
}

function handleAdminAccess() {
  hideHomeFeedback();

  if (!currentAccessProfile.isAuthenticated) {
    redirectToLogin();
    return;
  }

  if (currentAccessProfile.isPlatformAdmin) {
    window.location.href = './admin.html';
    return;
  }

  if (currentAccessProfile.isCompanyUser) {
    const companyName = currentAccessProfile.companyName || 'sua empresa';

    showHomeFeedback(
      `A conta ligada está vinculada à empresa "${companyName}" e não possui perfil de administrador da plataforma. Use o painel da empresa para continuar.`,
      'error'
    );
    return;
  }

  showHomeFeedback(
    'Sua conta está autenticada, mas não possui perfil configurado para acessar o admin da plataforma.',
    'error'
  );
}

function handleCompanyPanelAccess() {
  hideHomeFeedback();

  if (!currentAccessProfile.isAuthenticated) {
    redirectToLogin();
    return;
  }

  if (currentAccessProfile.isCompanyUser) {
    window.location.href = './cliente.html';
    return;
  }

  if (currentAccessProfile.isPlatformAdmin) {
    showHomeFeedback(
      'A conta ligada é um administrador da plataforma. Para acessar uma empresa, use o painel admin e entre pela gestão da empresa cliente.',
      'info'
    );
    return;
  }

  showHomeFeedback(
    'Sua conta está autenticada, mas não possui vínculo com uma empresa cliente.',
    'error'
  );
}

function handlePublicPageAccess() {
  hideHomeFeedback();

  if (!currentAccessProfile.isAuthenticated) {
    redirectToLogin();
    return;
  }

  if (currentAccessProfile.isCompanyUser) {
    const companyName = currentAccessProfile.companyName || 'sua empresa';
    const companySlug = String(currentAccessProfile.companySlug || '').trim();

    if (!companySlug) {
      showHomeFeedback(
        `A conta ligada está vinculada à empresa "${companyName}", mas essa empresa ainda não possui um slug público configurado. Defina o slug no painel da empresa para abrir a página pública.`,
        'error'
      );
      return;
    }

    window.location.href = `./agendar.html?slug=${encodeURIComponent(companySlug)}`;
    return;
  }

  if (currentAccessProfile.isPlatformAdmin) {
    showHomeFeedback(
      'A conta ligada é um administrador da plataforma. A página pública pertence a uma empresa cliente específica. Abra a empresa pelo admin ou use o slug correto.',
      'info'
    );
    return;
  }

  showHomeFeedback(
    'Sua conta está autenticada, mas não possui vínculo com uma empresa cliente para abrir uma página pública.',
    'error'
  );
}

openAdminButton?.addEventListener('click', () => {
  handleAdminAccess();
});

openClientPanelButton?.addEventListener('click', () => {
  handleCompanyPanelAccess();
});

openPublicPageButton?.addEventListener('click', () => {
  handlePublicPageAccess();
});

onAuthStateChanged(auth, async (user) => {
  try {
    await resolveCurrentProfile(user);
  } catch (error) {
    console.error('Erro ao validar acesso na home do HoraLivre:', error);
  }
});