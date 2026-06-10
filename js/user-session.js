// =============================================
// ЛОКАЛЬНАЯ АВТОРИЗАЦИЯ И СЕССИЯ ПОЛЬЗОВАТЕЛЯ
// =============================================
const SK_ACCOUNTS_KEY = 'sk_accounts';
const SK_SESSION_USER = 'sk_session_user';
const SK_SESSION_HISTORY = 'sk_session_history';
const SK_SESSION_PROFILE = 'sk_session_profile';
const SK_USERDATA_PREFIX = 'sk_userdata_';

function skHashPassword(password) {
  let h = 5381;
  for (let i = 0; i < password.length; i++) {
    h = ((h << 5) + h) ^ password.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(SK_ACCOUNTS_KEY) || '{}'); }
  catch { return {}; }
}

function saveAccounts(accounts) {
  localStorage.setItem(SK_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function isLoggedIn() {
  return !!sessionStorage.getItem(SK_SESSION_USER);
}

function getCurrentUser() {
  const username = sessionStorage.getItem(SK_SESSION_USER);
  if (!username) return null;
  const acc = getAccounts()[username];
  if (!acc) return null;
  return { username, name: acc.name || username };
}

function getUserDataKey(username) {
  return SK_USERDATA_PREFIX + username;
}

function loadUserSession(username) {
  sessionStorage.setItem(SK_SESSION_USER, username);
  const acc = getAccounts()[username];
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(getUserDataKey(username)) || 'null');
  } catch { data = null; }

  sessionStorage.setItem(SK_SESSION_HISTORY, JSON.stringify(data?.history || []));
  sessionStorage.setItem(SK_SESSION_PROFILE, JSON.stringify(
    data?.profile || { name: acc?.name || username, avatar: '🧑' }
  ));
}

function clearSessionData() {
  sessionStorage.removeItem(SK_SESSION_USER);
  sessionStorage.removeItem(SK_SESSION_HISTORY);
  sessionStorage.removeItem(SK_SESSION_PROFILE);
}

function requireLoginForSave() {
  if (isLoggedIn()) return true;
  showAuthModal('login');
  const err = document.getElementById('authError');
  if (err) err.textContent = 'Войдите в аккаунт, чтобы сохранять данные';
  return false;
}

function clearAuthMessages() {
  const err = document.getElementById('authError');
  const ok = document.getElementById('authSuccess');
  if (err) err.textContent = '';
  if (ok) ok.textContent = '';
}

function updateHeaderAuth() {
  const btn = document.getElementById('authBtn');
  if (!btn) return;
  const user = getCurrentUser();
  if (user) {
    btn.textContent = (user.name || user.username);
    btn.title = 'Личный кабинет';
    btn.onclick = () => showPage('profile');
  } else {
    btn.textContent = 'Войти';
    btn.title = 'Войти в личный кабинет';
    btn.onclick = () => showAuthModal('login');
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
  ['loginForm', 'registerForm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const tabsEl = document.getElementById('authTabs');
  if (tabsEl) tabsEl.style.display = 'flex';
  const map = { login: 'loginForm', register: 'registerForm' };
  const target = document.getElementById(map[tab]);
  if (target) target.style.display = 'flex';
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  clearAuthMessages();
}

function submitLogin() {
  const username = document.getElementById('loginUsername').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  clearAuthMessages();

  if (!username || !password) {
    errEl.textContent = 'Введите логин и пароль';
    return;
  }

  const accounts = getAccounts();
  const acc = accounts[username];
  if (!acc || acc.passwordHash !== skHashPassword(password)) {
    errEl.textContent = 'Неверный логин или пароль';
    return;
  }

  loadUserSession(username);
  hideAuthModal();
  updateHeaderAuth();
  if (typeof resetAllTests === 'function') resetAllTests();
  if (document.querySelector('.page.active')?.id === 'page-history') renderHistory();
  if (document.querySelector('.page.active')?.id === 'page-profile') renderProfile();
  showPage('profile');
}

function submitRegister() {
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const name = document.getElementById('regName').value.trim();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;
  const errEl = document.getElementById('authError');
  const okEl = document.getElementById('authSuccess');
  clearAuthMessages();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    errEl.textContent = 'Логин: 3–30 символов, латиница, цифры и _';
    return;
  }
  if (password.length < 4) {
    errEl.textContent = 'Пароль — минимум 4 символа';
    return;
  }
  if (password !== password2) {
    errEl.textContent = 'Пароли не совпадают';
    return;
  }

  const accounts = getAccounts();
  if (accounts[username]) {
    errEl.textContent = 'Такой логин уже занят';
    return;
  }

  accounts[username] = {
    passwordHash: skHashPassword(password),
    name: name || username,
    createdAt: new Date().toISOString(),
  };
  saveAccounts(accounts);

  loadUserSession(username);
  hideAuthModal();
  updateHeaderAuth();
  if (typeof resetAllTests === 'function') resetAllTests();
  if (okEl) okEl.textContent = 'Аккаунт создан';
  showPage('profile');
}

function saveUserData() {
  if (!isLoggedIn()) {
    showAuthModal('login');
    return;
  }
  const username = sessionStorage.getItem(SK_SESSION_USER);
  const history = getHistory();
  const profile = getProfile();
  localStorage.setItem(getUserDataKey(username), JSON.stringify({
    history,
    profile,
    savedAt: new Date().toISOString(),
  }));

  const btn = document.getElementById('saveUserDataBtn');
  if (btn) {
    const prev = btn.textContent;
    btn.textContent = '✓ Данные сохранены';
    btn.disabled = true;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    window.setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
    }, 2200);
  }
}

function logout() {
  if (!confirm('Выйти из аккаунта? Несохранённые данные текущей сессии будут удалены.')) return;
  clearSessionData();
  if (typeof resetAllTests === 'function') resetAllTests();
  updateHeaderAuth();
  showPage('home');
  if (typeof renderHistory === 'function') renderHistory();
}

document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    const username = sessionStorage.getItem(SK_SESSION_USER);
    if (!getAccounts()[username]) {
      clearSessionData();
    }
  }
  updateHeaderAuth();
});
