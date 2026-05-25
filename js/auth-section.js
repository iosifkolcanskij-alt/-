// =============================================
// API / AUTH
// =============================================
const API_URL = (window.SK_BASE || '') + '/api';

let authToken   = localStorage.getItem('sk_token') || null;
let currentUser = (() => { try { return JSON.parse(localStorage.getItem('sk_user')||'null'); } catch { return null; } })();
let serverHistory = [];
let pendingVerifyEmail = '';

class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code || null;
  }
}

async function apiCall(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
  if (body) opts.body = JSON.stringify(body);
  let data;
  try {
    const r = await fetch(API_URL + path, opts);
    data = await r.json();
    if (!r.ok) throw new ApiError(data.error || 'Ошибка сервера', data.code || null);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Сервер недоступен. Запустите: php -S localhost:8080 router.php', 'NETWORK');
  }
  return data;
}

function setAuthSession(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('sk_token', token);
  localStorage.setItem('sk_user', JSON.stringify(user));
  const p = getProfile();
  if (user.name) p.name = user.name;
  if (user.avatar) p.avatar = user.avatar;
  saveProfile(p);
}

function clearAuthMessages() {
  const err = document.getElementById('authError');
  const ok = document.getElementById('authSuccess');
  if (err) err.textContent = '';
  if (ok) ok.textContent = '';
}

async function fetchServerHistory() {
  if (!authToken) return;
  try {
    const rows = await apiCall('/history');
    serverHistory = rows.map(r => ({
      id: String(r.id),
      type: r.type,
      title: r.title,
      result: r.result,
      date: new Date(r.createdAt).toLocaleString('ru-RU'),
    }));
  } catch(e) { console.warn('history fetch failed', e); }
}

function updateHeaderAuth() {
  const btn = document.getElementById('authBtn');
  if (!btn) return;
  if (currentUser) {
    btn.textContent = (currentUser.avatar || '🧑') + ' ' + (currentUser.name || currentUser.username);
    btn.onclick = () => showPage('profile');
  } else {
    btn.textContent = 'Войти';
    btn.onclick = () => showAuthModal();
  }
}

function showAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchAuthTab(tab);
}
function hideAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
  clearAuthMessages();
}
function switchAuthTab(tab) {
  ['loginForm', 'registerForm', 'verifyPendingForm', 'forgotForm', 'resetForm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const tabsEl = document.getElementById('authTabs');
  const showTabs = tab === 'login' || tab === 'register';
  if (tabsEl) tabsEl.style.display = showTabs ? 'flex' : 'none';
  const map = { login: 'loginForm', register: 'registerForm', verify: 'verifyPendingForm', forgot: 'forgotForm', reset: 'resetForm' };
  const target = document.getElementById(map[tab]);
  if (target) target.style.display = 'block';
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', showTabs && t.dataset.tab === tab);
  });
  clearAuthMessages();
}

async function submitLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  clearAuthMessages();
  try {
    const data = await apiCall('/auth/login', 'POST', { email, password });
    setAuthSession(data.token, data.user);
    hideAuthModal();
    updateHeaderAuth();
    await fetchServerHistory();
    if (document.querySelector('.page.active')?.id === 'page-history') renderHistory();
    if (document.querySelector('.page.active')?.id === 'page-profile') renderProfile();
  } catch (e) {
    if (e.code === 'EMAIL_NOT_VERIFIED') {
      pendingVerifyEmail = email;
      const el = document.getElementById('verifyPendingEmail');
      if (el) el.textContent = email;
      switchAuthTab('verify');
    }
    errEl.textContent = e.message;
  }
}

async function submitRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const name = document.getElementById('regName').value.trim();
  const errEl = document.getElementById('authError');
  clearAuthMessages();
  try {
    const data = await apiCall('/auth/register', 'POST', { username, email, password, name: name || username });
    pendingVerifyEmail = email;
    document.getElementById('verifyPendingEmail').textContent = email;
    const okEl = document.getElementById('authSuccess');
    if (okEl) okEl.textContent = data.message || 'Проверьте почту';
    switchAuthTab('verify');
  } catch (e) { errEl.textContent = e.message; }
}

async function submitResendVerification() {
  const email = pendingVerifyEmail || document.getElementById('regEmail')?.value.trim() || document.getElementById('loginEmail')?.value.trim();
  const errEl = document.getElementById('authError');
  const okEl = document.getElementById('authSuccess');
  clearAuthMessages();
  if (!email) { errEl.textContent = 'Укажите email'; return; }
  try {
    const data = await apiCall('/auth/resend-verification', 'POST', { email });
    okEl.textContent = data.message || 'Письмо отправлено';
  } catch (e) { errEl.textContent = e.message; }
}

async function submitForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  const errEl = document.getElementById('authError');
  const okEl = document.getElementById('authSuccess');
  clearAuthMessages();
  try {
    const data = await apiCall('/auth/forgot-password', 'POST', { email });
    okEl.textContent = data.message || 'Письмо отправлено';
  } catch (e) { errEl.textContent = e.message; }
}

async function submitResetPassword() {
  const token = document.getElementById('resetToken').value;
  const p1 = document.getElementById('resetPassword').value;
  const p2 = document.getElementById('resetPassword2').value;
  const errEl = document.getElementById('authError');
  clearAuthMessages();
  if (p1 !== p2) { errEl.textContent = 'Пароли не совпадают'; return; }
  try {
    const data = await apiCall('/auth/reset-password', 'POST', { token, password: p1 });
    setAuthSession(data.token, data.user);
    hideAuthModal();
    updateHeaderAuth();
    await fetchServerHistory();
    showPage('profile');
  } catch (e) { errEl.textContent = e.message; }
}

function loginWithGoogle() {
  window.location.href = API_URL + '/auth/google';
}

function initAuthFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const reset = params.get('reset');
  if (token) {
    authToken = token;
    localStorage.setItem('sk_token', token);
    apiCall('/auth/me').then(data => {
      setAuthSession(token, data.user);
      updateHeaderAuth();
      fetchServerHistory();
      showPage('profile');
    }).catch(() => {
      localStorage.removeItem('sk_token');
      authToken = null;
      showAuthModal('login');
    });
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }
  if (reset) {
    document.getElementById('resetToken').value = reset;
    showAuthModal('reset');
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }
  if (params.get('verified') === '1') {
    showAuthModal('login');
    document.getElementById('authSuccess').textContent = 'Email подтверждён. Войдите в аккаунт.';
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }
  const verifyMsg = { invalid: 'Ссылка недействительна', expired: 'Ссылка истекла', missing: 'Токен не найден' };
  if (params.has('verify')) {
    showAuthModal('login');
    document.getElementById('authError').textContent = verifyMsg[params.get('verify')] || 'Ошибка подтверждения';
    window.history.replaceState({}, '', window.location.pathname);
    return;
  }
  if (params.has('google')) {
    showAuthModal('login');
    document.getElementById('authError').textContent = 'Не удалось войти через Google';
    window.history.replaceState({}, '', window.location.pathname);
  }
}

async function logout() {
  if (!confirm('Выйти из аккаунта?')) return;
  authToken = null;
  currentUser = null;
  serverHistory = [];
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');
  updateHeaderAuth();
  showPage('home');
}

async function saveProfileToServer() {
  if (!authToken) return;
  try {
    const p = getProfile();
    const data = await apiCall('/auth/profile', 'PUT', {
      name: p.name || (currentUser && currentUser.name),
      avatar: p.avatar || '🧑',
    });
    currentUser = data.user;
    localStorage.setItem('sk_user', JSON.stringify(currentUser));
    updateHeaderAuth();
  } catch(e) { console.warn('profile save failed', e); }
}

if (authToken) {
  fetchServerHistory().then(() => {
    if (document.querySelector('.page.active')?.id === 'page-history') renderHistory();
  });
  apiCall('/auth/me').then(d => {
    currentUser = d.user;
    localStorage.setItem('sk_user', JSON.stringify(currentUser));
    updateHeaderAuth();
  }).catch(() => {
    authToken = null;
    currentUser = null;
    serverHistory = [];
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_user');
    updateHeaderAuth();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthFromUrl();
  updateHeaderAuth();
});
