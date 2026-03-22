import { loginWithEmail } from '../services/auth-service.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('auth-message');

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.className = isError ? 'feedback error' : 'feedback success';
}

function redirectByRole(session) {
  if (session.role === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  window.location.href = 'cliente.html';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      showMessage('Preencha e-mail e senha.', true);
      return;
    }

    const session = await loginWithEmail(email, password);
    showMessage('Login realizado com sucesso.');
    redirectByRole(session);
  } catch (error) {
    showMessage(error.message || 'Não foi possível entrar.', true);
    console.error(error);
  }
});