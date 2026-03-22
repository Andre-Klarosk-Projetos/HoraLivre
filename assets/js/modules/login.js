import { loginWithEmail } from '../services/auth-service.js';
import { showFeedback } from '../utils/dom-utils.js';

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const feedbackElement = document.getElementById('login-feedback');

function getSafeString(value) {
  return String(value || '').trim();
}

function resolveRedirectFromProfile(profile) {
  const role = getSafeString(profile?.role).toLowerCase();
  const isPlatformAdmin =
    role === 'admin' ||
    role === 'platform_admin' ||
    role === 'master_admin';

  if (isPlatformAdmin) {
    return './admin.html';
  }

  return './cliente.html';
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const email = getSafeString(emailInput?.value);
  const password = getSafeString(passwordInput?.value);

  if (!email || !password) {
    showFeedback(feedbackElement, 'Informe seu e-mail e sua senha.', 'error');
    return;
  }

  try {
    showFeedback(feedbackElement, 'Entrando...', 'success');

    const loginResult = await loginWithEmail(email, password);

    const resolvedProfile =
      loginResult?.profile ||
      loginResult?.userProfile ||
      loginResult?.session ||
      loginResult ||
      null;

    const redirectUrl = resolveRedirectFromProfile(resolvedProfile);

    showFeedback(feedbackElement, 'Login realizado com sucesso. Redirecionando...', 'success');

    window.location.href = redirectUrl;
  } catch (error) {
    console.error('Erro ao fazer login no HoraLivre:', error);

    showFeedback(
      feedbackElement,
      error?.message || 'Não foi possível entrar. Verifique seu e-mail e senha.',
      'error'
    );
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLoginSubmit);
}