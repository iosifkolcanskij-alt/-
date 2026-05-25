// =============================================
// API / AUTH
// =============================================
const API_URL = '/api';

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

// =============================================
// FAQ TOGGLE
// =============================================
function toggleFaq(el) {
  el.classList.toggle('open');
}

// =============================================
// HOME PAGE CONTENT
// =============================================
(function initHomeContent() {
  const whatIs = document.getElementById('whatIsContent');
  if (whatIs) {
    whatIs.innerHTML = `
      <div class="what-is-card">
        <div class="what-is-text">
          <p>Самопознание — изучение своей личности: черт характера, реакций, ценностей, сильных и слабых сторон. Знание себя помогает принимать осознанные решения, строить отношения и находить дело, которое приносит удовлетворение.</p>
          <p>Приложение объединяет нумерологию, психологические тесты и гороскопы — несколько подходов к пониманию себя. Результаты носят познавательный характер и не заменяют консультацию специалиста.</p>
        </div>
        <div class="what-is-pills">
          <span class="pill pill-green">🧠 Понять себя</span>
          <span class="pill pill-purple">💡 Раскрыть таланты</span>
          <span class="pill pill-blue">🤝 Улучшить общение</span>
          <span class="pill pill-amber">🎯 Найти призвание</span>
          <span class="pill pill-green">❤️ Строить отношения</span>
          <span class="pill pill-purple">⚡ Управлять энергией</span>
        </div>
      </div>`;
  }

  const faq = document.getElementById('faqContent');
  if (faq) {
    const items = [
      ['Нужна ли регистрация?', 'Нет. Нумерология, тесты и зодиак работают без аккаунта. Регистрация нужна только для синхронизации истории между устройствами.'],
      ['Куда сохраняются результаты?', 'Без входа — в браузере на этом устройстве. С аккаунтом — на сервере (MySQL), доступ с любого устройства после входа.'],
      ['Насколько точны тесты?', 'Это самооценочные опросники для саморефлексии, а не клиническая диагностика. Точность зависит от честности ответов и контекста жизни.'],
      ['Можно ли доверять нумерологии и зодиаку?', 'Они дают символический язык для размышления о себе, а не научный прогноз событий. Используйте как повод для разговора с собой.'],
      ['Как подтвердить email после регистрации?', 'На почту приходит ссылка. Перейдите по ней, затем войдите в аккаунт. Письмо можно запросить повторно в окне входа.'],
      ['Забыли пароль?', 'На экране входа нажмите «Забыли пароль?» — придёт ссылка для сброса на email.'],
    ];
    faq.innerHTML = '<div class="faq-list">' + items.map(([q, a]) => `
      <div class="faq-item" onclick="toggleFaq(this)">
        <div class="faq-q">${q} <span class="faq-arrow">▾</span></div>
        <div class="faq-a">${a}</div>
      </div>`).join('') + '</div>';
  }

  const privacy = document.getElementById('privacyContent');
  if (privacy) {
    privacy.innerHTML = `
      <div class="ps-item"><span class="ps-icon">🔒</span> Данные тестов не передаются третьим лицам</div>
      <div class="ps-item"><span class="ps-icon">📱</span> Без регистрации всё остаётся в браузере</div>
      <div class="ps-item"><span class="ps-icon">☁️</span> С аккаунтом история хранится в вашей БД на сервере</div>
      <div class="ps-item"><span class="ps-icon">🧪</span> Не является медицинской или психиатрической услугой</div>`;
  }
})();

// =============================================
// THEME
// =============================================
let currentTheme = localStorage.getItem('theme') || 'dark';
document.body.setAttribute('data-theme', currentTheme);
document.getElementById('themeIcon').textContent = currentTheme === 'dark' ? '☀️' : '🌙';

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', currentTheme);
  document.getElementById('themeIcon').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', currentTheme);
}

// =============================================
// SIDE FACTS (scroll reactive)
// =============================================
const SIDE_FACTS_SETS = [
  {
    left: [
      { icon: '🔢', title: 'Факт о числах', text: 'В нумерологии число жизненного пути получают суммой цифр даты рождения с последующим сведением к 1-9 (или мастер-числам 11/22/33).' },
      { icon: '🧠', title: 'Факт о психике', text: 'Темперамент отражает биологическую основу реакции, а личностные черты и навыки саморегуляции формируются и развиваются в течение жизни.' },
      { icon: '📘', title: 'Интересно', text: 'MBTI и Big Five описывают личность по-разному: первый даёт тип, второй — непрерывный профиль по нескольким шкалам.' },
    ],
    right: [
      { icon: '⭐', title: 'Фокус внимания', text: 'Сильная самооценка результатов тестов появляется там, где совпадают минимум 2-3 независимых подхода, а не один тест.' },
      { icon: '💬', title: 'Про эмоции', text: 'Эмоциональный интеллект — это тренируемый навык: осознание эмоций, пауза перед реакцией и экологичное выражение чувств.' },
      { icon: '🧭', title: 'Практика', text: 'Полезно перепроходить опросники раз в 6-12 месяцев и смотреть динамику: так видно, как меняется стиль решений и стрессоустойчивость.' },
    ],
  },
  {
    left: [
      { icon: '🧮', title: 'Число дня', text: 'Число дня рождения часто читают как «внешний стиль»: как человек стартует, знакомится и реагирует на новые задачи.' },
      { icon: '🔷', title: 'Матрица 3×3', text: 'В психоматрице Пифагора важны не только отдельные цифры, но и линии: цель, семья, быт, духовность и темперамент.' },
      { icon: '🌀', title: 'Сюцай', text: 'Корневое число в системах типа сюцай используют как быстрый архетипический портрет — короткий, но не исчерпывающий.' },
    ],
    right: [
      { icon: '🧩', title: 'Big Five', text: 'Большая пятёрка измеряет выраженность черт, а не «тип». Это удобно для тонкой настройки самоанализа и привычек.' },
      { icon: '🤝', title: 'Привязанность', text: 'Стиль привязанности может меняться: безопасные отношения и осознанная коммуникация реально перестраивают паттерны.' },
      { icon: '🎯', title: 'Локус контроля', text: 'Сбалансированный локус контроля помогает действовать там, где есть влияние, и не выгорать там, где контроля меньше.' },
    ],
  },
  {
    left: [
      { icon: '📐', title: 'Ло-Шу', text: 'Квадрат Ло-Шу — это символ баланса. Его используют как карту акцентов, а не как буквальный прогноз судьбы.' },
      { icon: '🌙', title: 'Ритм изменений', text: 'Даже при стабильном темпераменте меняются стратегии поведения: опыт и среда смещают реакции в стрессе.' },
      { icon: '🧷', title: 'Проверка гипотез', text: 'Если выводы разных тестов совпадают, это повод усилить практику. Если расходятся — хорошая зона для самоисследования.' },
    ],
    right: [
      { icon: '📊', title: 'Динамика важнее', text: 'Сравнивать результаты в динамике полезнее, чем искать «идеальный» тип: рост виден по повторным замерам.' },
      { icon: '🫶', title: 'Эмпатия и границы', text: 'Высокая эмпатия работает лучше вместе с границами: понимание чувств других не равно обязанности спасать всех.' },
      { icon: '🛠️', title: 'Применение', text: 'Любой тест полезен, если после него есть действие: новый режим, новая привычка, новая стратегия общения.' },
    ],
  },
];

let sideFactsSetIndex = -1;
let sideFactsTicking = false;

function applySideFactsSet(idx) {
  const set = SIDE_FACTS_SETS[idx];
  if (!set) return;
  ['left', 'right'].forEach(side => {
    set[side].forEach((fact, i) => {
      const card = document.querySelector(`[data-fact-slot="${side}-${i}"]`);
      if (!card) return;
      card.classList.add('is-updating');
      const icon = card.querySelector('.sfc-icon');
      const title = card.querySelector('.sfc-title');
      const text = card.querySelector('.sfc-text');
      if (icon) icon.textContent = fact.icon;
      if (title) title.textContent = fact.title;
      if (text) text.textContent = fact.text;
      window.setTimeout(() => card.classList.remove('is-updating'), 260);
    });
  });
}

function updateSideFactsOnScroll() {
  const cards = document.querySelectorAll('[data-fact-slot]');
  if (!cards.length) return;
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const maxScroll = Math.max(1, docHeight - window.innerHeight);
  const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
  const next = Math.min(SIDE_FACTS_SETS.length - 1, Math.floor(ratio * SIDE_FACTS_SETS.length));
  if (next === sideFactsSetIndex) return;
  sideFactsSetIndex = next;
  applySideFactsSet(next);
}

function onSideFactsScroll() {
  if (sideFactsTicking) return;
  sideFactsTicking = true;
  window.requestAnimationFrame(() => {
    updateSideFactsOnScroll();
    sideFactsTicking = false;
  });
}

window.addEventListener('scroll', onSideFactsScroll, { passive: true });
window.addEventListener('resize', updateSideFactsOnScroll);
setTimeout(updateSideFactsOnScroll, 0);

// =============================================
// NAVIGATION
// =============================================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  const navBtn = document.querySelector(`[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (pageId === 'history') { fetchServerHistory().then(() => renderHistory()); }
  if (pageId === 'zodiac' && !zodiacInitialized) initZodiacPage();
  if (pageId === 'profile') { fetchServerHistory().then(() => renderProfile()); }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showTestsPage() {
  backToTestsHub();
  showPage('tests');
}

function backToTestsHub() {
  const hub = document.getElementById('testsHub');
  const header = document.getElementById('testsPageHeader');
  if (hub) hub.style.display = 'grid';
  if (header) header.style.display = 'block';
  document.querySelectorAll('.test-panel').forEach(p => { p.style.display = 'none'; });
}

function openTestPanel(id) {
  showPage('tests');
  const hub = document.getElementById('testsHub');
  const header = document.getElementById('testsPageHeader');
  if (hub) hub.style.display = 'none';
  if (header) header.style.display = 'none';
  document.querySelectorAll('.test-panel').forEach(p => { p.style.display = 'none'; });
  const panel = document.getElementById('test-panel-' + id);
  if (panel) panel.style.display = 'block';

  if (id === 'temperament' && !tempInitialized) initTempTest();
  if (id === 'mbti' && !mbtiInitialized) initMBTITest();
  if (id === 'bigfive' && !bfInitialized) initBigFiveTest();
  if (id === 'attachment' && !attInitialized) initAttachmentTest();
  if (id === 'eq' && !eqInitialized) initEQTest();
  if (id === 'locus' && !locusInitialized) initLocusTest();
}

// =============================================
// HISTORY
// =============================================
function getHistory() {
  if (authToken) return serverHistory;
  try { return JSON.parse(localStorage.getItem('sk_history') || '[]'); }
  catch { return []; }
}
async function saveHistory(entry) {
  if (authToken) {
    try {
      const row = await apiCall('/history', 'POST', {
        type:   entry.type,
        title:  entry.title,
        result: entry.result,
      });
      serverHistory.unshift({
        id: String(row.id),
        type: row.type,
        title: row.title,
        result: row.result,
        date: new Date(row.createdAt).toLocaleString('ru-RU'),
      });
    } catch(e) { console.warn('save history failed', e); }
  } else {
    const h = JSON.parse(localStorage.getItem('sk_history') || '[]');
    h.unshift({ ...entry, id: Date.now().toString(), date: new Date().toLocaleString('ru-RU') });
    localStorage.setItem('sk_history', JSON.stringify(h));
  }
}
async function deleteHistoryItem(id) {
  if (authToken) {
    try { await apiCall('/history/' + id, 'DELETE'); } catch {}
    serverHistory = serverHistory.filter(e => e.id !== id);
  } else {
    const h = JSON.parse(localStorage.getItem('sk_history') || '[]').filter(e => e.id !== id);
    localStorage.setItem('sk_history', JSON.stringify(h));
  }
  renderHistory();
}
async function clearAllHistory() {
  if (!confirm('Очистить всю историю результатов?')) return;
  if (authToken) {
    try { await apiCall('/history', 'DELETE'); } catch {}
    serverHistory = [];
  } else {
    localStorage.removeItem('sk_history');
  }
  renderHistory();
}

let historyFilter = 'all';
let historySearch = '';

function renderHistory() {
  const cont = document.getElementById('historyContent');
  let h = getHistory();

  const toolbar = `
    <div class="history-toolbar">
      <input class="search-input" type="search" placeholder="Поиск по результатам..." value="${historySearch}"
        oninput="historySearch=this.value;renderHistory()" />
    </div>
    <div class="filter-row" style="margin-bottom:16px">
      ${['all','numerology','temperament','mbti','bigfive','attachment','eq','locus'].map(f => `
        <button class="filter-btn ${historyFilter===f?'active':''}" onclick="historyFilter='${f}';renderHistory()">
          ${f==='all'?'Все':f==='numerology'?'Нумерология':f==='temperament'?'Темп.':f==='mbti'?'MBTI':f==='bigfive'?'Б5':f==='attachment'?'Привяз.':f==='eq'?'ЭИ':'Локус'}
        </button>`).join('')}
      ${h.length > 0 ? `<button class="filter-btn btn-danger" onclick="clearAllHistory()" style="margin-left:auto">Очистить всё</button>` : ''}
    </div>
  `;

  if (historySearch) h = h.filter(e => (e.title + e.result).toLowerCase().includes(historySearch.toLowerCase()));
  if (historyFilter !== 'all') h = h.filter(e => e.type === historyFilter);

  if (!getHistory().length) {
    cont.innerHTML = toolbar + `<div class="empty-state"><div class="empty-icon">📋</div><h3 class="empty-title">История пуста</h3><p class="empty-sub">Выполните расчёт нумерологии или пройдите тест</p></div>`;
    return;
  }
  if (!h.length) {
    cont.innerHTML = toolbar + `<div class="empty-state"><div class="empty-icon">🔍</div><p class="empty-sub">Ничего не найдено</p></div>`;
    return;
  }

  const list = h.map(e => `
    <div class="history-item">
      <div class="history-dot dot-${e.type}"></div>
      <div class="history-info">
        <div class="history-title">${e.title}</div>
        <div class="history-meta">${e.result} &nbsp;·&nbsp; ${e.date}</div>
      </div>
      <button class="del-btn" onclick="deleteHistoryItem('${e.id}')" title="Удалить">✕</button>
    </div>`).join('');

  cont.innerHTML = toolbar + `<div class="history-list">${list}</div>`;
}

// =============================================
// NUMEROLOGY
// =============================================
function formatDateInput(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 8);

  if (digits.length >= 2) {
    let day = parseInt(digits.slice(0, 2), 10);
    if (!Number.isNaN(day)) day = Math.min(Math.max(day, 1), 31);
    digits = String(day).padStart(2, '0') + digits.slice(2);
  }

  if (digits.length >= 4) {
    let month = parseInt(digits.slice(2, 4), 10);
    if (!Number.isNaN(month)) month = Math.min(Math.max(month, 1), 12);
    digits = digits.slice(0, 2) + String(month).padStart(2, '0') + digits.slice(4);
  }

  if (digits.length >= 4) {
    const day = parseInt(digits.slice(0, 2), 10);
    const month = parseInt(digits.slice(2, 4), 10);
    const year = digits.length === 8 ? parseInt(digits.slice(4, 8), 10) : null;
    const maxDay = getDaysInMonth(month, year);
    const safeDay = Math.min(day, maxDay);
    digits = String(safeDay).padStart(2, '0') + digits.slice(2);
  }

  let v = digits;
  if (v.length > 4) v = v.slice(0, 2) + '.' + v.slice(2, 4) + '.' + v.slice(4);
  else if (v.length > 2) v = v.slice(0, 2) + '.' + v.slice(2);
  input.value = v;
}

function isLeapYear(year) {
  if (!Number.isInteger(year)) return false;
  return (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0);
}

function getDaysInMonth(month, year) {
  if (month === 2) {
    // If year is not fully entered yet, allow up to 29.
    return Number.isInteger(year) ? (isLeapYear(year) ? 29 : 28) : 29;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseAndValidateDateDigits(digits) {
  if (digits.length < 8) return { valid: false };
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return { valid: false };
  if (month < 1 || month > 12) return { valid: false };
  const maxDay = getDaysInMonth(month, year);
  if (day < 1 || day > maxDay) return { valid: false };

  return { valid: true, day, month, year };
}

function computePythagorasData(digits8) {
  const d = digits8.split('').map(Number);
  const num1 = d.reduce((a, b) => a + b, 0);
  const num2 = String(num1).split('').map(Number).reduce((a, b) => a + b, 0);
  const first = d.find(x => x !== 0) ?? 0;
  const num3 = Math.abs(num1 - 2 * first);
  const num4 = String(num3).split('').map(Number).reduce((a, b) => a + b, 0);
  const allNums = digits8 + String(num1) + String(num2) + String(num3) + String(num4);
  const matrix = {};
  for (let i = 1; i <= 9; i++) matrix[i] = 0;
  for (const ch of allNums) {
    if (ch !== '0' && matrix[ch] !== undefined) matrix[ch]++;
  }
  const lines = {
    goal: matrix[1] + matrix[4] + matrix[7],
    family: matrix[2] + matrix[5] + matrix[8],
    habits: matrix[3] + matrix[6] + matrix[9],
    selfEsteem: matrix[1] + matrix[2] + matrix[3],
    everyday: matrix[4] + matrix[5] + matrix[6],
    talent: matrix[7] + matrix[8] + matrix[9],
    spirituality: matrix[1] + matrix[5] + matrix[9],
    temperament: matrix[3] + matrix[5] + matrix[7],
  };
  return { matrix, lines, num1, num2, num3, num4, allNums };
}

function buildPythagorasHTML(digits8, data) {
  const { matrix, lines, num1, num2, num3, num4, allNums } = data;
  const matrixRows = [[7, 8, 9], [4, 5, 6], [1, 2, 3]];
  const matrixHTML = `
    <div class="matrix-grid">
      ${matrixRows.map(row => row.map(di => {
        const c = matrix[di]; const name = CELL_NAMES[di];
        return `<div class="matrix-cell ${c > 0 ? 'has-digit' : ''}">
          <span class="cell-name">${name}</span>
          <span class="cell-value">${c > 0 ? String(di).repeat(c) : '—'}</span>
          <span class="cell-count">${c > 0 ? '(' + c + ')' : ''}</span>
        </div>`;
      }).join('')).join('')}
    </div>`;

  const cellsHTML = Object.entries(matrix).map(([dig, c]) => {
    const text = getCellInterp(dig, c);
    const val = c > 0 ? String(dig).repeat(c) : '—';
    return `<div class="interp-item">
      <div class="interp-header">
        <span class="interp-badge">${val}</span>
        <span class="interp-label">${dig}. ${CELL_NAMES[dig]}</span>
      </div>
      <div class="interp-text">${text}</div>
    </div>`;
  }).join('');

  const lineKeys = ['goal', 'family', 'habits', 'selfEsteem', 'everyday', 'talent', 'spirituality', 'temperament'];
  const linesHTML = lineKeys.map(k => {
    const info = LINE_INTERP[k];
    const s = lines[k];
    return `<div class="line-item">
      <div class="line-header">
        <div class="line-score">${s}</div>
        <div class="line-label">${info.label}</div>
        <div class="line-sublabel">${info.sub}</div>
      </div>
      <div class="line-text">${info.text(s)}</div>
    </div>`;
  }).join('');

  return `
    <div class="glass-card">
      <div class="section-title">Вычисленные числа</div>
      <div class="chip-row">
        <span class="chip">Дата <strong>${digits8}</strong></span>
        <span class="chip">Доп. 1 <strong>${num1}</strong></span>
        <span class="chip">Доп. 2 <strong>${num2}</strong></span>
        <span class="chip">Доп. 3 <strong>${num3}</strong></span>
        <span class="chip">Доп. 4 <strong>${num4}</strong></span>
      </div>
      <div style="margin-top:10px">
        <span class="field-label">Полный ряд</span>
        <div class="num-row">${allNums.split('').join(' ')}</div>
      </div>
    </div>
    <div class="glass-card">
      <div class="section-title">Психоматрица 3×3</div>
      ${matrixHTML}
    </div>
    <div class="glass-card">
      <div class="section-title">Анализ ячеек</div>
      <div class="interpretation-list">${cellsHTML}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Анализ линий</div>
      <div class="interpretation-list">${linesHTML}</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="numSaveBtn" onclick="saveNumResult(${JSON.stringify({ d: digits8, n1: num1, n2: num2, n3: num3, n4: num4 }).replace(/"/g, "'")})">Сохранить в историю</button>
    </div>
  `;
}

function reduceDayToOneNine(n) {
  let x = n;
  while (x > 9) x = String(x).split('').reduce((a, b) => a + +b, 0);
  return x;
}

function toggleArticle(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'block' ? 'none' : 'block';
}

function makeArticleButton(id, title, paragraphs) {
  return `
    <div class="num-article-wrap">
      <button type="button" class="btn btn-secondary btn-article" onclick="toggleArticle('${id}')">Читать полную статью</button>
      <div id="${id}" class="num-article" style="display:none">
        <div class="glass-card">
          <div class="section-title">${title}</div>
          ${paragraphs.map(p => `<p class="desc-text num-article-p">${p}</p>`).join('')}
        </div>
      </div>
    </div>`;
}

function calcNumerology() {
  const raw = document.getElementById('birthDateInput').value;
  const errEl = document.getElementById('numError');
  const briefEl = document.getElementById('numBrief');
  const resEl = document.getElementById('numResult');

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) {
    errEl.textContent = 'Введите полную дату рождения в формате ДД.ММ.ГГГГ';
    errEl.style.display = 'block';
    if (briefEl) briefEl.style.display = 'none';
    resEl.style.display = 'none';
    return;
  }
  const parsedDate = parseAndValidateDateDigits(digits);
  if (!parsedDate.valid) {
    errEl.textContent = 'Некорректная дата: проверьте день, месяц и високосный год';
    errEl.style.display = 'block';
    if (briefEl) briefEl.style.display = 'none';
    resEl.style.display = 'none';
    return;
  }
  errEl.style.display = 'none';

  const { day, month, year } = parsedDate;
  const digits8 = digits.slice(0, 8);

  const westSign = getZodiacByDate(day, month);
  const chSign = getChineseZodiac(year);

  const westBrief = westSign.desc.split('.').slice(0, 2).join('.') + '.';
  const chBrief = chSign.desc.split('.').slice(0, 2).join('.') + '.';

  if (briefEl) {
    briefEl.innerHTML = `
      <div class="glass-card num-brief-card">
        <div class="section-title">Краткий гороскоп по дате ${raw}</div>
        <div class="num-brief-pair">
          <div class="num-brief-item" style="--zc:${westSign.color};--zcl:${westSign.colorLight}">
            <div class="num-brief-emoji">${westSign.emoji}</div>
            <div class="num-brief-label">Знак зодиака</div>
            <div class="num-brief-name">${westSign.name}</div>
            <div class="num-brief-meta">${westSign.element} ${westSign.elementEmoji} · ${westSign.dates}</div>
            <p class="num-brief-text">${westBrief}</p>
          </div>
          <div class="num-brief-div">✦</div>
          <div class="num-brief-item num-brief-chinese">
            <div class="num-brief-emoji">${chSign.emoji}</div>
            <div class="num-brief-label">Животное года (шэнсяо)</div>
            <div class="num-brief-name">${chSign.name}</div>
            <div class="num-brief-meta">Стихия ${chSign.element} · год ${year}</div>
            <p class="num-brief-text">${chBrief}</p>
          </div>
        </div>
      </div>`;
    briefEl.style.display = 'block';
  }

  const pData = computePythagorasData(digits8);
  const lifePath = calcLifePathNumber(day, month, year);
  let sujiRoot = digits8.split('').reduce((a, b) => a + +b, 0);
  while (sujiRoot > 9) sujiRoot = String(sujiRoot).split('').reduce((a, b) => a + +b, 0);
  const dayNum = reduceDayToOneNine(day);
  let nineStar = (year + month + day) % 9;
  if (nineStar === 0) nineStar = 9;

  const loShuGrid = `
    <div class="lo-shu-grid" aria-hidden="true">
      <span>4</span><span>9</span><span>2</span>
      <span>3</span><span>5</span><span>7</span>
      <span>8</span><span>1</span><span>6</span>
    </div>`;

  resEl.innerHTML = `
    <div class="num-deep-intro glass-card">
      <div class="section-title">Разбор по числам даты</div>
      <p class="num-deep-lead">Этот раздел работает как познавательный сборник: сначала вы видите короткий вывод по своей дате, а затем можете раскрывать темы глубже. Каждая панель объясняет, как именно разные школы трактуют числа и на что обычно смотрят в интерпретации.</p>
    </div>

    <details class="num-topic" open>
      <summary>Матрица Пифагора (психоматрица)</summary>
      <div class="num-topic-body">
        <div class="glass-card">
          <p class="desc-text">Матрица Пифагора рассматривает дату рождения как набор повторяющихся чисел, из которых складываются базовые качества личности: характер, энергия, логика, труд, удача, чувство долга и другие опорные линии. Этот подход особенно любят за наглядность: вы сразу видите, каких цифр много, а каких нет совсем.</p>
          <p class="desc-text" style="margin-top:10px">Ниже показан ваш персональный расчёт. После него можно раскрыть полную статью о том, как читать строки, столбцы и диагонали психоматрицы.</p>
        </div>
        ${buildPythagorasHTML(digits8, pData)}
        ${makeArticleButton('num-article-pythagoras', 'Полная статья: матрица Пифагора', [
          'Пифагорейская традиция исходит из идеи, что дата рождения содержит устойчивый числовой код личности. Цифры не предсказывают судьбу буквально, а создают символическую карту склонностей, сильных сторон и зон, где человеку приходится прикладывать больше усилий.',
          'Самый известный формат чтения — психоматрица 3×3. Повторы единиц связывают с характером и волей, двойки — с энергетикой, тройки — с интересом к знаниям, четвёрки — со здоровьем, пятёрки — с логикой и интуицией, шестёрки — с отношением к труду, семёрки — с удачей, восьмёрки — с чувством долга, девятки — с умом и памятью.',
          'Дополнительные числа помогают расширить исходный ряд цифр. Затем интерпретируют не только отдельные ячейки, но и линии: строку целей, семейную линию, бытовую устойчивость, диагональ духовности и темперамента. Такой анализ не заменяет психологию, но хорошо работает как карта для саморазмышления.'
        ])}
      </div>
    </details>

    <details class="num-topic">
      <summary>Число жизненного пути</summary>
      <div class="num-topic-body">
        <div class="glass-card">
          <p class="desc-text"><strong>${lifePath}</strong> — ${LIFE_PATH_INTERP[lifePath] || LIFE_PATH_INTERP[reduceToDigit(lifePath, false)] || 'Интерпретация уточняется по итоговому числу жизненного пути.'}</p>
          <p class="desc-text" style="margin-top:10px">Число жизненного пути обычно рассматривают как главный вектор: какой стиль развития для вас естественнее, через какие уроки вы чаще всего взрослеете и что помогает чувствовать, что вы идёте «своей дорогой».</p>
        </div>
        ${makeArticleButton('num-article-lifepath', 'Полная статья: число жизненного пути', [
          'В западной нумерологии число жизненного пути получают сложением дня, месяца и года рождения с последующим сведением к одной цифре или мастер-числам 11, 22 и 33. Это не «ярлык», а скорее ведущий сценарий развития, через который человек обычно реализует себя.',
          'Условно числа 1, 4 и 8 связаны с волей, структурой и результатом; 2, 6 и 9 — с отношениями, заботой и гуманизмом; 3, 5 и 7 — с самовыражением, опытом и поиском смысла. Мастер-числа трактуют как усиленные версии этих сценариев: больше потенциала, но и больше внутреннего напряжения.',
          'Практически это число используют как опору для вопросов: что меня действительно двигает, где я выгораю, какой способ действия для меня органичен, а какой навязан окружением. Поэтому трактовка полезна не сама по себе, а как повод лучше заметить свои повторяющиеся жизненные мотивы.'
        ])}
      </div>
    </details>

    <details class="num-topic">
      <summary>Сюцай — корневое число даты (цифровая магия)</summary>
      <div class="num-topic-body">
        <div class="glass-card">
          <p class="desc-text">Сумма всех цифр даты сводится к числу <strong>${sujiRoot}</strong> (от 1 до 9). В японской традиции «сюцай» связывают с вибрацией числа как с опорным архетипом.</p>
          <p class="desc-text" style="margin-top:10px">${ROOT_NUMBER_INTERP[sujiRoot]}</p>
          <p class="desc-text" style="margin-top:10px">Эта трактовка часто используется как быстрый способ схватить общую «тональность» личности: через что человеку проще включаться в жизнь, как он воспринимает перемены и что делает его устойчивым.</p>
        </div>
        ${makeArticleButton('num-article-sujai', 'Полная статья: сюцай и корневое число', [
          'Подходы, которые в популярной среде объединяют словом «сюцай», обычно строятся вокруг идеи базовой вибрации даты рождения. После сведения всех цифр к одному числу получается краткий архетипический код от 1 до 9.',
          'Такие системы меньше интересуются сложными комбинациями и больше смотрят на общее настроение личности: вы человек действия или контакта, структуры или свободы, глубины или результата. За счёт этого метод нравится тем, кто хочет короткий, понятный и легко запоминающийся вывод.',
          'Лучше всего использовать корневое число как отправную точку, а не как окончательный диагноз. Оно хорошо помогает в самоописании, но становится действительно полезным лишь вместе с наблюдением за привычками, выбором профессии, способом переживать стресс и строить отношения.'
        ])}
      </div>
    </details>

    <details class="num-topic">
      <summary>Число дня рождения (день месяца)</summary>
      <div class="num-topic-body">
        <div class="glass-card">
          <p class="desc-text">День <strong>${day}</strong> → вибрация <strong>${dayNum}</strong>.</p>
          <p class="desc-text" style="margin-top:10px">${BIRTH_DAY_INTERP[dayNum]}</p>
          <p class="desc-text" style="margin-top:10px">Если число жизненного пути показывает долгую траекторию, то день рождения чаще описывает ваш «первый слой» проявления: как вы входите в контакт, как реагируете на вызов и какой оттенок характера люди считывают быстрее всего.</p>
        </div>
        ${makeArticleButton('num-article-birthday', 'Полная статья: число дня рождения', [
          'В нумерологии день месяца часто читают как личный стиль проявления. Это число ближе к повседневному характеру, чем к судьбоносным задачам: оно заметно в манере говорить, принимать решения, реагировать на давление и занимать место среди других.',
          'Например, люди с вибрацией 1 чаще выглядят самостоятельными и прямыми, с 2 — мягкими и дипломатичными, с 4 — собранными и практичными, с 5 — подвижными и свободолюбивыми. При этом само число не отменяет сложность личности, а только выделяет наиболее заметную поведенческую ноту.',
          'Полезно сравнивать число дня рождения с результатами психологических тестов. Если описания совпадают, это усиливает уверенность в выводе; если расходятся, значит перед вами особенно интересная зона, где внешний стиль и внутренний способ мышления устроены по-разному.'
        ])}
      </div>
    </details>

    <details class="num-topic">
      <summary>Девять дворцов (упрощённая звезда года)</summary>
      <div class="num-topic-body">
        <div class="glass-card">
          <p class="desc-text">${NINE_STAR_KI[nineStar]}</p>
          <p class="input-hint" style="margin-top:8px">Упрощённая связка года, месяца и дня рождения с одной из девяти «звёзд» фэн-шуй-нумерологии. Полная карта Кю-сэ-кэ требует календарных уточнений.</p>
          <p class="desc-text" style="margin-top:10px">В популярной интерпретации девять дворцов помогают увидеть, через какой тип энергии человек легче воспринимает мир: через движение, структуру, гибкость, глубину, яркость или внутренний центр.</p>
        </div>
        ${makeArticleButton('num-article-nine-star', 'Полная статья: девять дворцов и звёзды', [
          'Система девяти звёзд пришла из восточной традиции, где числа связывают не только с характером, но и с циклами времени, направлением движения энергии и способом взаимодействия человека с пространством. В упрощённом формате она нередко используется как ещё один архетипический слой портрета.',
          'В отличие от матрицы Пифагора, здесь акцент не на количестве повторов цифр, а на качестве ведущей энергии. Одни числа связывают с мягкостью и обучением, другие — с авторитетом и границами, третьи — с яркостью, видимостью или внутренней стабильностью.',
          'Такой материал полезен именно как познавательный: он расширяет взгляд на дату рождения и показывает, насколько по-разному разные школы понимают символику чисел. Если вам близка восточная метафорика, этот блок может дать неожиданные ассоциации для самонаблюдения.'
        ])}
      </div>
    </details>

    <details class="num-topic">
      <summary>Квадрат Ло-Шу</summary>
      <div class="num-topic-body">
        <div class="glass-card">
          <p class="desc-text">${LO_SHU_INTRO}</p>
          ${loShuGrid}
          <p class="desc-text" style="margin-top:12px">Ваши цифры из даты заполняют аналогичную сетку в матрице Пифагора выше — там же смотрите повторы и «силу» каждой цифры.</p>
          <p class="desc-text" style="margin-top:10px">Квадрат Ло-Шу часто используют как образ порядка внутри хаоса: девять ячеек символизируют разные роли и направления энергии, а дата рождения становится способом посмотреть, где у человека опора, а где дефицит опыта.</p>
        </div>
        ${makeArticleButton('num-article-loshu', 'Полная статья: квадрат Ло-Шу', [
          'Ло-Шу — один из самых известных магических квадратов восточной традиции. Его ценят за симметрию и идею баланса: каждая линия в сумме даёт одно и то же число, а сама сетка символически распределяет качества по устойчивой схеме.',
          'В популярной нумерологии квадрат используют как язык описания характера. Если дата рождения даёт много повторов в определённых зонах, это читается как усиление соответствующих качеств. Если каких-то чисел мало, это трактуют как области, где развитие приходит через опыт, дисциплину и осознанность.',
          'Как и другие числовые системы, Ло-Шу лучше воспринимать не как буквальный прогноз, а как карту смыслов. Его сила именно в наглядности: он помогает увидеть структуру и дальше задавать правильные вопросы о себе.'
        ])}
      </div>
    </details>
  `;

  resEl.style.display = 'block';
  resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const p = getProfile();
  p.zodiacDate = raw;
  p.westSign = westSign.name;
  p.chSign = chSign.name;
  saveProfile(p);
}

function saveNumResult(data) {
  saveHistory({
    type: 'numerology',
    title: `Матрица Пифагора — ${document.getElementById('birthDateInput').value}`,
    result: `Числа: ${data.n1}, ${data.n2}, ${data.n3}, ${data.n4}`,
  });
  const btn = document.getElementById('numSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

// =============================================
// TEMPERAMENT TEST
// =============================================
let tempAnswers = {};
let tempInitialized = false;

function initTempTest() {
  tempInitialized = true;
  tempAnswers = {};
  renderTempTest();
}

function renderTempTest() {
  const total = TEMP_QUESTIONS.length;
  const answered = Object.keys(tempAnswers).length;
  const pct = (answered/total*100).toFixed(0);

  const blocks = [...new Set(TEMP_QUESTIONS.map(q=>q.block))];

  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
  `;

  blocks.forEach(block => {
    html += `<div class="block-title">${block}</div>`;
    TEMP_QUESTIONS.filter(q=>q.block===block).forEach(q => {
      const selected = tempAnswers[q.id];
      html += `
        <div class="question-card ${selected!==undefined?'answered':''}" id="tq-${q.id}">
          <div class="question-num">Вопрос ${q.id}</div>
          <div class="question-text">${q.text}</div>
          <div class="options-list">
            ${q.options.map((opt,i) => `
              <button class="option-btn ${selected===i?'selected':''}"
                onclick="selectTempAnswer(${q.id},${i})">
                <strong>${opt.label}.</strong> ${opt.text}
              </button>`).join('')}
          </div>
        </div>`;
    });
  });

  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered<total?'disabled':''} onclick="submitTempTest()">
    ${answered<total?`Осталось ответить: ${total-answered}`:'Получить результат'}</button></div>`;

  document.getElementById('tempTest').innerHTML = html;
}

function selectTempAnswer(qId, optIdx) {
  tempAnswers[qId] = optIdx;
  renderTempTest();
}

function submitTempTest() {
  const scores = {choleric:0,sanguine:0,phlegmatic:0,melancholic:0};
  const labelPoints = {А:4,Б:3,В:2,Г:1};
  TEMP_QUESTIONS.forEach(q => {
    const idx = tempAnswers[q.id];
    if (idx===undefined) return;
    const opt = q.options[idx];
    scores[opt.type] += labelPoints[opt.label]||1;
  });

  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const dominant = sorted[0][0];
  const secondary = (sorted[0][1]-sorted[1][1]) <= 3 ? sorted[1][0] : null;
  const maxScore = sorted[0][1];

  showTempResult(dominant, secondary, scores, maxScore);
}

function showTempResult(dominant, secondary, scores, maxScore) {
  const d = TEMP_DESC[dominant];
  const s = secondary ? TEMP_DESC[secondary] : null;

  const scoreColors = {choleric:'#ef4444',sanguine:'#f59e0b',phlegmatic:'#3b82f6',melancholic:'#8b5cf6'};

  const scoreBars = Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(([type,val]) => {
    const info = TEMP_DESC[type];
    return `<div class="score-item">
      <div class="score-header">
        <span class="score-name">${info.emoji} ${info.name}</span>
        <span class="score-val">${val} баллов</span>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${(val/maxScore*100).toFixed(0)}%;background:${scoreColors[type]}"></div>
      </div>
    </div>`;
  }).join('');

  const html = `
    <div class="result-hero">
      <span class="result-emoji">${d.emoji}</span>
      <div class="result-type">${d.name}</div>
      ${s ? `<div class="result-mixed">Смешанный тип: ${d.name} / ${s.name} ${s.emoji}</div>` : ''}
    </div>

    <div class="glass-card">
      <div class="section-title">Описание</div>
      <div class="desc-text">${d.description}</div>
      ${s ? `<br><div class="desc-text"><strong>${s.emoji} Также присутствуют черты ${s.name}а:</strong><br>${s.description}</div>` : ''}
    </div>

    <div class="two-cols">
      <div class="glass-card">
        <div class="col-title col-green">✓ Сильные стороны</div>
        <ul class="strengths-list">${d.strengths.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="glass-card">
        <div class="col-title col-amber">! Слабые стороны</div>
        <ul class="weaknesses-list">${d.weaknesses.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="glass-card">
      <div class="section-title">Сравнение по баллам</div>
      <div class="score-bar-row">${scoreBars}</div>
    </div>

    <div class="glass-card">
      <div class="section-title">Как читать результат</div>
      <div class="desc-text">Темперамент показывает не «хорошесть» личности, а врождённый стиль нервной системы: скорость реакции, интенсивность эмоций, способ входить в нагрузку и восстанавливаться после неё. Доминирующий тип говорит о вашей естественной базе, а смешанный тип показывает, какими качествами эта база смягчается или усиливается.</div>
      <div class="desc-text" style="margin-top:10px">Практически это полезно для выбора режима работы, общения и отдыха. Если вы выраженный холерик или сангвиник, важно учиться управлять импульсом и распределять энергию. Если сильнее флегматический или меланхолический полюс, опорой становятся ритм, предсказуемость, тишина и экологичная эмоциональная среда.</div>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetTempTest()">Пройти снова</button>
      <button class="btn btn-primary" id="tempSaveBtn" onclick="saveTempResult('${dominant}','${secondary||''}')">Сохранить в историю</button>
    </div>
  `;

  document.getElementById('tempTest').style.display = 'none';
  document.getElementById('tempResult').innerHTML = html;
  document.getElementById('tempResult').style.display = 'block';
  window.scrollTo({top:0,behavior:'smooth'});
}

function saveTempResult(dominant, secondary) {
  const d = TEMP_DESC[dominant];
  const s = secondary ? TEMP_DESC[secondary] : null;
  saveHistory({
    type: 'temperament',
    title: `Тест темперамента — ${d.name}${s?` / ${s.name}`:''}`,
    result: `Доминирующий тип: ${d.name}`,
  });
  const btn = document.getElementById('tempSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

function resetTempTest() {
  tempAnswers = {};
  document.getElementById('tempTest').style.display = 'block';
  document.getElementById('tempResult').style.display = 'none';
  renderTempTest();
  window.scrollTo({top:0,behavior:'smooth'});
}

// =============================================
// MBTI TEST
// =============================================
let mbtiAnswers = {};
let mbtiInitialized = false;

function initMBTITest() {
  mbtiInitialized = true;
  mbtiAnswers = {};
  renderMBTITest();
}

function renderMBTITest() {
  const total = MBTI_QUESTIONS.length;
  const answered = Object.keys(mbtiAnswers).length;
  const pct = (answered/total*100).toFixed(0);

  const axes = ['EI','SN','TF','JP'];
  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
  `;

  axes.forEach(axis => {
    html += `<div class="block-title">${axis} — ${MBTI_AXIS_LABELS[axis]}</div>`;
    MBTI_QUESTIONS.filter(q=>q.axis===axis).forEach(q => {
      const sel = mbtiAnswers[q.id];
      html += `
        <div class="question-card ${sel!==undefined?'answered':''}" id="mq-${q.id}">
          <div class="question-num">Вопрос ${q.id}</div>
          <div class="question-text">${q.text}</div>
          <div class="options-list">
            ${q.options.map((opt,i) => `
              <button class="option-btn ${sel===i?'selected':''}" onclick="selectMBTIAnswer(${q.id},${i})">
                ${opt.text}
              </button>`).join('')}
          </div>
        </div>`;
    });
  });

  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered<total?'disabled':''} onclick="submitMBTITest()">
    ${answered<total?`Осталось: ${total-answered}`:'Определить тип личности'}</button></div>`;

  document.getElementById('mbtiTest').innerHTML = html;
}

function selectMBTIAnswer(qId, optIdx) {
  mbtiAnswers[qId] = optIdx;
  renderMBTITest();
}

function submitMBTITest() {
  const scores = {E:0,I:0,S:0,N:0,T:0,F:0,J:0,P:0};
  MBTI_QUESTIONS.forEach(q => {
    const idx = mbtiAnswers[q.id];
    if (idx===undefined) return;
    const opt = q.options[idx];
    scores[opt.l] += opt.v;
  });

  const threshold = 26;
  const E = scores.E > threshold ? 'E' : 'I';
  const S = scores.S > threshold ? 'S' : 'N';
  const T = scores.T > threshold ? 'T' : 'F';
  const J = scores.J > threshold ? 'J' : 'P';
  const type = E+S+T+J;

  showMBTIResult(type, scores);
}

function showMBTIResult(type, scores) {
  const info = MBTI_DESC[type] || {};
  const axes = ['EI','SN','TF','JP'];

  const axisHTML = axes.map(axis => {
    const [l1,l2] = axis.split('');
    const s1 = scores[l1]||0, s2 = scores[l2]||0;
    const total = s1+s2;
    const pct = total>0?(s1/total*100).toFixed(0):50;
    const chosen = type.includes(l1)?l1:l2;
    return `<div class="axis-item">
      <div class="axis-letters">
        <span class="${chosen===l1?'axis-letter-active':''}">${l1}</span>
        <span class="axis-name-sm">${MBTI_AXIS_LABELS[axis]}</span>
        <span class="${chosen===l2?'axis-letter-active':''}">${l2}</span>
      </div>
      <div class="axis-track" style="margin-top:6px">
        <div class="axis-fill" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:4px">
        <span>${s1}</span><span>${s2}</span>
      </div>
    </div>`;
  }).join('');

  const html = `
    <div class="result-hero">
      <div class="result-type">${type}</div>
      ${info.nick ? `<div class="result-nickname">«${info.nick}»</div>` : ''}
    </div>

    <div class="glass-card">
      <div class="section-title">Оси предпочтений</div>
      <div class="axis-row">${axisHTML}</div>
    </div>

    ${info.desc ? `<div class="glass-card">
      <div class="section-title">Описание типа</div>
      <div class="desc-text">${info.desc}</div>
    </div>` : ''}

    ${info.strengths ? `<div class="two-cols">
      <div class="glass-card">
        <div class="col-title col-green">✓ Сильные стороны</div>
        <ul class="strengths-list">${info.strengths.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="glass-card">
        <div class="col-title col-amber">! Слабые стороны</div>
        <ul class="weaknesses-list">${info.weaknesses.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>
    </div>` : ''}

    <div class="glass-card">
      <div class="section-title">Практический вывод</div>
      <div class="desc-text">MBTI лучше всего читать как карту предпочтений, а не как жёсткий характерологический диагноз. Ваш тип показывает, где мозгу естественнее брать энергию, как вы обрабатываете информацию, на что опираетесь в решениях и какой стиль организации жизни для вас психологически комфортнее.</div>
      <div class="desc-text" style="margin-top:10px">Используйте результат для самоанализа: в каких задачах вам легко, какие роли на работе и в отношениях даются естественно, что вызывает переутомление. Особенно полезно сравнивать тип MBTI с темпераментом: первый описывает способ мышления, второй — скорость и интенсивность реакций.</div>
    </div>

    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetMBTITest()">Пройти снова</button>
      <button class="btn btn-primary" id="mbtiSaveBtn" onclick="saveMBTIResult('${type}','${info.nick||''}')">Сохранить в историю</button>
    </div>
  `;

  document.getElementById('mbtiTest').style.display = 'none';
  document.getElementById('mbtiResult').innerHTML = html;
  document.getElementById('mbtiResult').style.display = 'block';
  window.scrollTo({top:0,behavior:'smooth'});
}

function saveMBTIResult(type, nick) {
  saveHistory({
    type:'mbti',
    title:`MBTI тест — ${type}${nick?` «${nick}»`:''}`,
    result:`Тип личности: ${type}`,
  });
  const btn = document.getElementById('mbtiSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

function resetMBTITest() {
  mbtiAnswers = {};
  document.getElementById('mbtiTest').style.display = 'block';
  document.getElementById('mbtiResult').style.display = 'none';
  renderMBTITest();
  window.scrollTo({top:0,behavior:'smooth'});
}

// =============================================
// BIG FIVE
// =============================================
let bfAnswers = {};
let bfInitialized = false;

function initBigFiveTest() {
  bfInitialized = true;
  bfAnswers = {};
  renderBigFiveTest();
}

function renderBigFiveTest() {
  const total = BIGFIVE_QUESTIONS.length;
  const answered = Object.keys(bfAnswers).length;
  const pct = (answered / total * 100).toFixed(0);
  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  BIGFIVE_QUESTIONS.forEach(q => {
    const sel = bfAnswers[q.id];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}">
        <div class="question-num">Утверждение ${q.id}</div>
        <div class="question-text">${q.text}</div>
        <div class="bf-scale-options">
          ${BIGFIVE_SCALE.map((label, i) => `
            <button type="button" class="bf-scale-btn ${sel === i + 1 ? 'selected' : ''}" onclick="selectBFAnswer(${q.id},${i + 1})">
              <span class="bf-scale-num">${i + 1}</span>
              <span class="bf-scale-lbl">${label}</span>
            </button>`).join('')}
        </div>
      </div>`;
  });
  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitBigFiveTest()">
    ${answered < total ? `Осталось: ${total - answered}` : 'Показать профиль OCEAN'}</button></div>`;
  document.getElementById('bfTest').innerHTML = html;
}

function selectBFAnswer(qId, val) {
  bfAnswers[qId] = val;
  renderBigFiveTest();
}

function submitBigFiveTest() {
  const sums = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  const cnt = { O: 0, C: 0, E: 0, A: 0, N: 0 };
  BIGFIVE_QUESTIONS.forEach(q => {
    let v = bfAnswers[q.id];
    if (v === undefined) return;
    if (q.rev) v = 6 - v;
    sums[q.trait] += v;
    cnt[q.trait]++;
  });
  const traits = ['O', 'C', 'E', 'A', 'N'];
  const bars = traits.map(t => {
    const avg = cnt[t] ? (sums[t] / cnt[t]).toFixed(2) : '—';
    const pct = cnt[t] ? ((sums[t] / cnt[t] - 1) / 4 * 100).toFixed(0) : 0;
    return `<div class="bf-trait-row">
      <div class="bf-trait-name">${BIGFIVE_TRAITS[t]}</div>
      <div class="bf-trait-track"><div class="bf-trait-fill" style="width:${pct}%"></div></div>
      <div class="bf-trait-val">${avg}</div>
    </div>`;
  }).join('');

  const html = `
    <div class="result-hero">
      <div class="result-type">Профиль OCEAN</div>
      <div class="result-nickname">средние по шкале 1–5</div>
    </div>
    <div class="glass-card">
      <div class="section-title">По осям</div>
      <div class="bf-result-bars">${bars}</div>
      <p class="input-hint" style="margin-top:14px">Это не клиническая диагностика, а ориентир для самонаблюдения. Высокие значения нейротизма указывают на эмоциональную чувствительность, а не на «слабость».</p>
    </div>
    <div class="glass-card">
      <div class="section-title">Что означают эти шкалы</div>
      <div class="desc-text">Большая пятёрка описывает личность через пять относительно устойчивых измерений. В отличие от типологий, здесь нет одной готовой “коробки” — вы видите профиль, где каждое качество выражено сильнее или слабее. Это удобно для более тонкого самоописания.</div>
      <div class="desc-text" style="margin-top:10px">На практике особенно полезно смотреть не на отдельные высокие цифры, а на сочетания: например, высокая открытость вместе с низкой добросовестностью создаёт сильную креативность, но сложности с рутиной; высокая доброжелательность вместе с высоким нейротизмом может говорить о сильной чувствительности к отношениям и конфликтам.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetBigFiveTest()">Пройти снова</button>
      <button class="btn btn-primary" id="bfSaveBtn" onclick="saveBigFiveResult()">Сохранить в историю</button>
    </div>`;
  document.getElementById('bfTest').style.display = 'none';
  document.getElementById('bfResult').innerHTML = html;
  document.getElementById('bfResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveBigFiveResult() {
  saveHistory({
    type: 'bigfive',
    title: 'Большая пятёрка (OCEAN)',
    result: 'Профиль сохранён — см. детали в разделе',
  });
  const btn = document.getElementById('bfSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

function resetBigFiveTest() {
  bfAnswers = {};
  document.getElementById('bfTest').style.display = 'block';
  document.getElementById('bfResult').style.display = 'none';
  renderBigFiveTest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// ATTACHMENT
// =============================================
let attAnswers = {};
let attInitialized = false;

function initAttachmentTest() {
  attInitialized = true;
  attAnswers = {};
  renderAttachmentTest();
}

function renderAttachmentTest() {
  const total = ATTACHMENT_QUESTIONS.length;
  const answered = Object.keys(attAnswers).length;
  const pct = (answered / total * 100).toFixed(0);
  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  ATTACHMENT_QUESTIONS.forEach(q => {
    const sel = attAnswers[q.id];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}">
        <div class="question-num">Вопрос ${q.id}</div>
        <div class="question-text">${q.text}</div>
        <div class="bf-scale-options att-opts">
          ${ATTACHMENT_SCALE.map((label, i) => `
            <button type="button" class="bf-scale-btn ${sel === i + 1 ? 'selected' : ''}" onclick="selectAttAnswer(${q.id},${i + 1})">
              <span class="bf-scale-num">${i + 1}</span>
              <span class="bf-scale-lbl">${label}</span>
            </button>`).join('')}
        </div>
      </div>`;
  });
  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitAttachmentTest()">
    ${answered < total ? `Осталось: ${total - answered}` : 'Результат'}</button></div>`;
  document.getElementById('attTest').innerHTML = html;
}

function selectAttAnswer(qId, val) {
  attAnswers[qId] = val;
  renderAttachmentTest();
}

function submitAttachmentTest() {
  let anx = 0, av = 0, na = 0, nv = 0;
  ATTACHMENT_QUESTIONS.forEach(q => {
    const v = attAnswers[q.id];
    if (v === undefined) return;
    if (q.ax === 'anx') { anx += v; na++; }
    else { av += v; nv++; }
  });
  const anxAvg = na ? anx / na : 0;
  const avAvg = nv ? av / nv : 0;
  let typeKey = 'secure';
  if (anxAvg >= 3 && avAvg >= 3) typeKey = 'fearful';
  else if (anxAvg >= 3) typeKey = 'anxious';
  else if (avAvg >= 3) typeKey = 'avoidant';
  const T = ATTACHMENT_TYPES[typeKey];

  const html = `
    <div class="result-hero">
      <span class="result-emoji">${T.emoji}</span>
      <div class="result-type">${T.name}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Описание</div>
      <div class="desc-text">${T.desc}</div>
      <p class="input-hint" style="margin-top:12px">Средние баллы: тревога о близости ${anxAvg.toFixed(2)}, избегание ${avAvg.toFixed(2)} (шкала 1–5).</p>
    </div>
    <div class="glass-card">
      <div class="section-title">Как использовать результат</div>
      <div class="desc-text">Стиль привязанности не определяет судьбу отношений, а показывает, как вы обычно переживаете близость, дистанцию, конфликт и зависимость. Это особенно полезно для осознания автоматических реакций: кого вы выбираете, чего боитесь, как просите о поддержке и что делаете, когда становитесь уязвимы.</div>
      <div class="desc-text" style="margin-top:10px">Даже если результат отражает тревожный или избегающий сценарий, это не “приговор”, а карта роста. Осознанная коммуникация, безопасный партнёрский опыт и терапия помогают заметно смягчить старые паттерны.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetAttachmentTest()">Пройти снова</button>
      <button class="btn btn-primary" id="attSaveBtn" onclick="saveAttachmentResult('${typeKey}')">Сохранить в историю</button>
    </div>`;
  document.getElementById('attTest').style.display = 'none';
  document.getElementById('attResult').innerHTML = html;
  document.getElementById('attResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveAttachmentResult(key) {
  const T = ATTACHMENT_TYPES[key];
  saveHistory({
    type: 'attachment',
    title: `Привязанность — ${T.name}`,
    result: T.name,
  });
  const btn = document.getElementById('attSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

function resetAttachmentTest() {
  attAnswers = {};
  document.getElementById('attTest').style.display = 'block';
  document.getElementById('attResult').style.display = 'none';
  renderAttachmentTest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// EMOTIONAL INTELLIGENCE (mini)
// =============================================
let eqAnswers = {};
let eqInitialized = false;

function initEQTest() {
  eqInitialized = true;
  eqAnswers = {};
  renderEQTest();
}

function renderEQTest() {
  const total = EQ_QUESTIONS.length;
  const answered = Object.keys(eqAnswers).length;
  const pct = (answered / total * 100).toFixed(0);
  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  EQ_QUESTIONS.forEach(q => {
    const sel = eqAnswers[q.id];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}">
        <div class="question-num">Вопрос ${q.id}</div>
        <div class="question-text">${q.text}</div>
        <div class="bf-scale-options">
          ${EQ_SCALE.map((label, i) => `
            <button type="button" class="bf-scale-btn ${sel === i + 1 ? 'selected' : ''}" onclick="selectEQAnswer(${q.id},${i + 1})">
              <span class="bf-scale-num">${i + 1}</span>
              <span class="bf-scale-lbl">${label}</span>
            </button>`).join('')}
        </div>
      </div>`;
  });
  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitEQTest()">
    ${answered < total ? `Осталось: ${total - answered}` : 'Итог'}</button></div>`;
  document.getElementById('eqTest').innerHTML = html;
}

function selectEQAnswer(qId, val) {
  eqAnswers[qId] = val;
  renderEQTest();
}

function submitEQTest() {
  let sum = 0;
  EQ_QUESTIONS.forEach(q => {
    const v = eqAnswers[q.id];
    if (v !== undefined) sum += v;
  });
  const level = EQ_LEVELS.find(l => sum <= l.max) || EQ_LEVELS[EQ_LEVELS.length - 1];

  const html = `
    <div class="result-hero">
      <div class="result-type">${level.label}</div>
      <div class="result-nickname">сумма баллов: ${sum} из 75</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Интерпретация</div>
      <div class="desc-text">${level.desc}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Развивающий вывод</div>
      <div class="desc-text">Эмоциональный интеллект отражает не только эмпатию, но и способность замечать своё состояние, выдерживать эмоции без разрушительных действий, говорить о чувствах и оставаться в контакте с людьми без слияния. Это набор навыков, а не фиксированная черта.</div>
      <div class="desc-text" style="margin-top:10px">Если показатель пока умеренный или низкий, это хороший ориентир для практики: пауза перед реакцией, словарь эмоций, работа с телесными сигналами, умение просить о поддержке и ставить границы обычно дают заметный рост даже без “идеального” темперамента или типа личности.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetEQTest()">Пройти снова</button>
      <button class="btn btn-primary" id="eqSaveBtn" onclick="saveEQResult(${JSON.stringify(level.label)})">Сохранить в историю</button>
    </div>`;
  document.getElementById('eqTest').style.display = 'none';
  document.getElementById('eqResult').innerHTML = html;
  document.getElementById('eqResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveEQResult(label) {
  saveHistory({
    type: 'eq',
    title: `Эмоциональный интеллект — ${label}`,
    result: label,
  });
  const btn = document.getElementById('eqSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

function resetEQTest() {
  eqAnswers = {};
  document.getElementById('eqTest').style.display = 'block';
  document.getElementById('eqResult').style.display = 'none';
  renderEQTest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// LOCUS OF CONTROL
// =============================================
let locusAnswers = {};
let locusInitialized = false;

function initLocusTest() {
  locusInitialized = true;
  locusAnswers = {};
  renderLocusTest();
}

function renderLocusTest() {
  const total = LOCUS_QUESTIONS.length;
  const answered = Object.keys(locusAnswers).length;
  const pct = (answered / total * 100).toFixed(0);
  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  LOCUS_QUESTIONS.forEach(q => {
    const sel = locusAnswers[q.id];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}">
        <div class="question-num">Вопрос ${q.id}</div>
        <div class="question-text">${q.text}</div>
        <div class="bf-scale-options">
          ${LOCUS_SCALE.map((label, i) => `
            <button type="button" class="bf-scale-btn ${sel === i + 1 ? 'selected' : ''}" onclick="selectLocusAnswer(${q.id},${i + 1})">
              <span class="bf-scale-num">${i + 1}</span>
              <span class="bf-scale-lbl">${label}</span>
            </button>`).join('')}
        </div>
      </div>`;
  });
  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitLocusTest()">
    ${answered < total ? `Осталось: ${total - answered}` : 'Итог'}</button></div>`;
  document.getElementById('locusTest').innerHTML = html;
}

function selectLocusAnswer(qId, val) {
  locusAnswers[qId] = val;
  renderLocusTest();
}

function submitLocusTest() {
  let bias = 0;
  LOCUS_QUESTIONS.forEach(q => {
    const v = locusAnswers[q.id];
    if (v === undefined) return;
    bias += q.int ? (v - 3) : -(v - 3);
  });
  let key = 'balanced';
  if (bias > 4) key = 'internal';
  else if (bias < -4) key = 'external';
  const P = LOCUS_PROFILES[key];

  const html = `
    <div class="result-hero">
      <span class="result-emoji">${P.emoji}</span>
      <div class="result-type">${P.name}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Интерпретация</div>
      <div class="desc-text">${P.desc}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Что это говорит о вас</div>
      <div class="desc-text">Локус контроля показывает, где вы психологически размещаете источник влияния на жизнь: внутри себя, во внешних обстоятельствах или где-то между. Эта установка влияет на мотивацию, устойчивость в кризисах, реакцию на ошибки и способ ставить цели.</div>
      <div class="desc-text" style="margin-top:10px">Сбалансированный локус обычно оказывается самым гибким: он помогает действовать там, где вы действительно можете повлиять, и не разрушаться там, где многое зависит не только от вас. Полезно пересматривать эту установку в разных сферах отдельно: работа, отношения, здоровье, деньги.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetLocusTest()">Пройти снова</button>
      <button class="btn btn-primary" id="locusSaveBtn" onclick="saveLocusResult('${key}')">Сохранить в историю</button>
    </div>`;
  document.getElementById('locusTest').style.display = 'none';
  document.getElementById('locusResult').innerHTML = html;
  document.getElementById('locusResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveLocusResult(key) {
  const P = LOCUS_PROFILES[key];
  saveHistory({
    type: 'locus',
    title: `Локус контроля — ${P.name}`,
    result: P.name,
  });
  const btn = document.getElementById('locusSaveBtn');
  btn.textContent = '✓ Сохранено';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
}

function resetLocusTest() {
  locusAnswers = {};
  document.getElementById('locusTest').style.display = 'block';
  document.getElementById('locusResult').style.display = 'none';
  renderLocusTest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// ZODIAC PAGE
// =============================================
let zodiacInitialized = false;

function initZodiacPage() {
  zodiacInitialized = true;
  renderZodiacAllSigns();
  renderChineseAllSigns();
}

function renderZodiacAllSigns() {
  const el = document.getElementById('zodiacAllSigns');
  el.innerHTML = ZODIAC_SIGNS.map((z, i) => `
    <div class="zodiac-mini-card" onclick="showZodiacDetail(${i},'west')" style="--zc:${z.color};--zcl:${z.colorLight}">
      <div class="zmc-emoji">${z.emoji}</div>
      <div class="zmc-name">${z.name}</div>
      <div class="zmc-dates">${z.dates}</div>
      <div class="zmc-element">${z.elementEmoji} ${z.element}</div>
    </div>`).join('');
}

function renderChineseAllSigns() {
  const el = document.getElementById('chineseAllSigns');
  el.innerHTML = CHINESE_ZODIAC.map((z, i) => `
    <div class="zodiac-mini-card" onclick="showZodiacDetail(${i},'chinese')" style="--zc:#f59e0b;--zcl:rgba(245,158,11,0.12)">
      <div class="zmc-emoji">${z.emoji}</div>
      <div class="zmc-name">${z.name}</div>
      <div class="zmc-dates" style="font-size:11px">${z.years.split(',').slice(0,3).join(',')}...</div>
      <div class="zmc-element">✦ ${z.element}</div>
    </div>`).join('');
}

function showZodiacDetail(idx, type) {
  const z = type === 'west' ? ZODIAC_SIGNS[idx] : CHINESE_ZODIAC[idx];
  const isWest = type === 'west';
  const resEl = document.getElementById('zodiacResult');

  const traitsHtml = z.traits.map(t => `<span class="trait-pill">${t}</span>`).join('');
  const weakHtml = z.weakness.map(t => `<span class="trait-pill weak-pill">${t}</span>`).join('');

  resEl.innerHTML = `
    <div class="zodiac-detail-card" style="--zc:${isWest ? z.color : '#f59e0b'};--zcl:${isWest ? z.colorLight : 'rgba(245,158,11,0.12)'}">
      <div class="zdc-header">
        <div class="zdc-emoji">${z.emoji}</div>
        <div>
          <div class="zdc-name">${z.name}</div>
          <div class="zdc-sub">${isWest ? `${z.dates} · ${z.element} ${z.elementEmoji} · Правитель: ${z.ruling}` : `Годы: ${z.years} · Стихия: ${z.element}`}</div>
        </div>
        <button class="zdc-close" onclick="document.getElementById('zodiacResult').style.display='none'">✕</button>
      </div>
      <p class="zdc-desc">${z.desc}</p>
      <div class="zdc-section">
        <div class="zdc-label">✓ Сильные черты</div>
        <div class="traits-wrap">${traitsHtml}</div>
      </div>
      <div class="zdc-section">
        <div class="zdc-label">! Слабые стороны</div>
        <div class="traits-wrap">${weakHtml}</div>
      </div>
      ${isWest ? `
      <div class="zdc-section">
        <div class="zdc-label">💼 Подходящие профессии</div>
        <div class="zdc-text">${z.career}</div>
      </div>
      <div class="zdc-section">
        <div class="zdc-label">🤝 Совместимость</div>
        <div class="traits-wrap">${z.compatible.map(c=>`<span class="trait-pill compat-pill">${c}</span>`).join('')}</div>
      </div>
      <div class="zdc-section">
        <div class="zdc-label">⭐ Знаменитые ${z.name}ы</div>
        <div class="zdc-text">${z.famous}</div>
      </div>` : `
      <div class="zdc-section">
        <div class="zdc-label">🤝 Совместимость</div>
        <div class="traits-wrap">${z.compatible.map(c=>`<span class="trait-pill compat-pill">${c}</span>`).join('')}</div>
      </div>
      <div class="zdc-section">
        <div class="zdc-label">🎯 Счастливые числа</div>
        <div class="traits-wrap">${z.lucky_nums.map(n=>`<span class="trait-pill">${n}</span>`).join('')}</div>
      </div>
      <div class="zdc-section">
        <div class="zdc-label">🎨 Счастливые цвета</div>
        <div class="zdc-text">${z.lucky_color}</div>
      </div>`}
    </div>`;
  resEl.style.display = 'block';
  resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function calcZodiac() {
  const raw = document.getElementById('zodiacDateInput').value;
  const errEl = document.getElementById('zodiacError');
  const digits = raw.replace(/\D/g,'');
  if (digits.length < 8) {
    errEl.textContent = 'Введите полную дату в формате ДД.ММ.ГГГГ';
    errEl.style.display = 'block';
    return;
  }
  const parsedDate = parseAndValidateDateDigits(digits);
  if (!parsedDate.valid) {
    errEl.textContent = 'Некорректная дата: проверьте день, месяц и високосный год';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  const { day, month, year } = parsedDate;

  const westSign = getZodiacByDate(day, month);
  const chSign   = getChineseZodiac(year);

  const wIdx = ZODIAC_SIGNS.indexOf(westSign);
  const cIdx = CHINESE_ZODIAC.indexOf(chSign);

  // Highlight in grids
  document.querySelectorAll('#zodiacAllSigns .zodiac-mini-card').forEach((el,i) => {
    el.classList.toggle('highlighted', i === wIdx);
  });
  document.querySelectorAll('#chineseAllSigns .zodiac-mini-card').forEach((el,i) => {
    el.classList.toggle('highlighted', i === cIdx);
  });

  const resEl = document.getElementById('zodiacResult');
  resEl.innerHTML = `
    <div class="glass-card" style="margin-top:24px;border-color:rgba(251,191,36,0.3)">
      <div class="section-title">Ваши знаки по дате ${raw}</div>
      <div class="zodiac-result-pair">
        <div class="zrp-item" onclick="showZodiacDetail(${wIdx},'west')" style="cursor:pointer">
          <div class="zrp-emoji">${westSign.emoji}</div>
          <div class="zrp-type">Западный зодиак</div>
          <div class="zrp-name">${westSign.name}</div>
          <div class="zrp-meta">${westSign.element} ${westSign.elementEmoji} · ${westSign.dates}</div>
          <div class="zrp-hint">Нажмите для подробностей</div>
        </div>
        <div class="zrp-divider">✦</div>
        <div class="zrp-item" onclick="showZodiacDetail(${cIdx},'chinese')" style="cursor:pointer">
          <div class="zrp-emoji">${chSign.emoji}</div>
          <div class="zrp-type">Китайский гороскоп</div>
          <div class="zrp-name">${chSign.name}</div>
          <div class="zrp-meta">Стихия ${chSign.element} · ${year} год</div>
          <div class="zrp-hint">Нажмите для подробностей</div>
        </div>
      </div>
    </div>`;
  resEl.style.display = 'block';
  resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Save to profile
  const p = getProfile();
  p.zodiacDate = raw;
  p.westSign   = westSign.name;
  p.chSign     = chSign.name;
  saveProfile(p);
}

// =============================================
// PROFILE / ACCOUNT
// =============================================
function getProfile() {
  try { return JSON.parse(localStorage.getItem('sk_profile') || '{}'); }
  catch { return {}; }
}
function saveProfile(data) {
  localStorage.setItem('sk_profile', JSON.stringify(data));
}

const AVATARS = ['🧑','👩','🧔','👱','🧑‍💻','👩‍🎨','🧑‍🚀','👩‍🔬','🧑‍🎓','👩‍💼','🦸','🧙'];

function buildHistoryInsights(ctx) {
  const points = [];
  if (ctx.mbtiInfo && ctx.tempInfo) {
    points.push(`Связка <strong>${ctx.mbtiInfo.name}</strong> и темперамента <strong>${ctx.tempInfo.name}</strong> показывает сочетание когнитивного стиля и скорости реакций: вы не просто мыслите определённым образом, но и проживаете этот стиль через свой естественный эмоциональный темп.`);
  } else if (ctx.mbtiInfo) {
    points.push(`По истории видно, что ваш ведущий тип мышления сейчас описывается как <strong>${ctx.mbtiInfo.name} «${ctx.mbtiInfo.nick}»</strong>. Это помогает понять, в каких задачах вы проявляете максимум естественной эффективности.`);
  } else if (ctx.tempInfo) {
    points.push(`По истории уже просматривается устойчивый поведенческий ритм: темперамент <strong>${ctx.tempInfo.name}</strong> объясняет, как вы обычно реагируете на нагрузку, темп и взаимодействие с людьми.`);
  }
  if (ctx.hasBigFive) {
    points.push('Профиль Большой пятёрки добавляет не тип, а градиенты личности. Благодаря ему ваш портрет становится менее схематичным: можно увидеть не только “кто вы”, но и насколько выражены открытость, дисциплина, социальность, мягкость и эмоциональная чувствительность.');
  }
  if (ctx.hasAttachment || ctx.hasEQ) {
    points.push('Результаты по привязанности и эмоциональному интеллекту особенно полезны для отношений. Они показывают не только внутренние черты, но и то, как вы входите в близость, выдерживаете уязвимость, считываете эмоции и восстанавливаете контакт после напряжения.');
  }
  if (ctx.hasLocus) {
    points.push('Локус контроля добавляет важный слой зрелости: он показывает, где вы видите источник влияния на события. Это напрямую связано с мотивацией, стрессоустойчивостью и тем, насколько легко брать ответственность без саморазрушения.');
  }
  if (ctx.westSign || ctx.chSign) {
    points.push('Дата рождения в вашем профиле работает как символический фон: знак зодиака и животное года не подменяют психологические результаты, а расширяют описание через архетипы, ценности и образные ассоциации.');
  }
  if (ctx.historyCount >= 4) {
    points.push(`У вас уже накоплено <strong>${ctx.historyCount}</strong> результатов, поэтому портрет личности опирается не на один случайный тест, а на несколько пересекающихся источников. Чем больше совпадений между ними, тем надёжнее можно считать общий вектор самонаблюдения.`);
  }
  return points.length ? points : ['Истории пока недостаточно для содержательного анализа. Пройдите ещё 2–3 теста, и профиль сможет собрать более связный психологический портрет.'];
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderProfile() {
  const p   = getProfile();
  const his = getHistory();
  const cont = document.getElementById('profileContent');

  // Gather latest results per type
  const latestMBTI  = his.find(h => h.type === 'mbti');
  const latestTemp  = his.find(h => h.type === 'temperament');
  const latestNum   = his.find(h => h.type === 'numerology');
  const latestBF    = his.find(h => h.type === 'bigfive');
  const latestAtt   = his.find(h => h.type === 'attachment');
  const latestEQ    = his.find(h => h.type === 'eq');
  const latestLocus = his.find(h => h.type === 'locus');

  const mbtiType = latestMBTI  ? latestMBTI.title.split('—')[1]?.trim().split(' ')[0] : null;
  const tempType = latestTemp  ? latestTemp.title.split('—')[1]?.trim().split(' ')[0]?.toLowerCase() : null;

  const westSign  = p.westSign  ? ZODIAC_SIGNS.find(z => z.name === p.westSign)  : null;
  const chSign    = p.chSign    ? CHINESE_ZODIAC.find(z => z.name === p.chSign)  : null;
  const mbtiInfo  = mbtiType    ? MBTI_DESC[mbtiType]   : null;
  const tempInfo  = tempType    ? TEMP_DESC[tempType]   : null;

  const portraitData = { mbti: mbtiType, temperament: tempType, zodiac: westSign, chineseZodiac: chSign };
  const portrait = generatePortraitText(portraitData);
  const historyInsights = buildHistoryInsights({
    mbtiInfo,
    tempInfo,
    westSign,
    chSign,
    hasBigFive: !!latestBF,
    hasAttachment: !!latestAtt,
    hasEQ: !!latestEQ,
    hasLocus: !!latestLocus,
    historyCount: his.length,
  });

  const avatarEmoji = (currentUser && currentUser.avatar) || p.avatar || '🧑';
  const userName    = (currentUser && currentUser.name) || p.name || '';
  const displayEmail = currentUser ? currentUser.email : '';
  const displayUser  = currentUser ? currentUser.username : '';
  const emailVerified = currentUser ? !!currentUser.emailVerified : false;
  const memberSince = currentUser && currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  // Tags row
  const tags = [];
  if (mbtiInfo)  tags.push(`<span class="profile-tag tag-blue">${mbtiInfo.name} «${mbtiInfo.nick}»</span>`);
  if (tempInfo)  tags.push(`<span class="profile-tag tag-amber">${tempInfo.emoji} ${tempInfo.name}</span>`);
  if (westSign)  tags.push(`<span class="profile-tag tag-gold">${westSign.emoji} ${westSign.name}</span>`);
  if (chSign)    tags.push(`<span class="profile-tag tag-red">${chSign.emoji} ${chSign.name}</span>`);

  // Stats
  const numTests = his.length;
  const daysSince = his.length ? Math.floor((Date.now() - parseInt(his[his.length-1].id||Date.now())) / 86400000) : 0;

  cont.innerHTML = `
    <!-- AUTH STATUS CARD -->
    ${currentUser ? `
    <div class="glass-card" style="margin-top:0;border-color:rgba(139,92,246,0.3)">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:36px">${currentUser.avatar || '🧑'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:18px;font-weight:700">${currentUser.name || currentUser.username}</div>
          <div style="font-size:14px;color:var(--text-muted)">@${escapeHtml(currentUser.username)} · ${escapeHtml(currentUser.email)}</div>
          <div style="font-size:13px;color:${emailVerified ? '#10b981' : '#f59e0b'};margin-top:3px">${emailVerified ? '✓ Email подтверждён' : '⚠ Подтвердите email'} · История на сервере</div>
          ${memberSince ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px">В системе с ${memberSince}</div>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="logout()" style="font-size:13px">Выйти</button>
      </div>
    </div>` : `
    <div class="glass-card" style="margin-top:0;border-color:rgba(251,191,36,0.3);text-align:center;padding:28px">
      <div style="font-size:32px;margin-bottom:8px">🔐</div>
      <div style="font-size:17px;font-weight:700;margin-bottom:6px">Войдите для синхронизации</div>
      <div style="font-size:14px;color:var(--text-muted);margin-bottom:18px">Создайте аккаунт — ваша история будет храниться на сервере и доступна с любого устройства</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="showAuthModal('login')">Войти</button>
        <button class="btn btn-secondary" onclick="showAuthModal('register')">Регистрация</button>
        <button type="button" class="auth-google-btn profile-guest-google" onclick="loginWithGoogle()">Google</button>
      </div>
    </div>`}

    <!-- EDIT CARD -->
    <div class="glass-card profile-edit-card">
      <div class="profile-avatar-row">
        <div class="profile-avatar" id="profileAvatarDisp">${avatarEmoji}</div>
        <div class="profile-avatar-picker" id="avatarPicker" style="display:none">
          ${AVATARS.map(a => `<button class="avatar-opt" onclick="selectAvatar('${a}')">${a}</button>`).join('')}
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-bottom:12px" onclick="toggleAvatarPicker()">Сменить аватар</button>
      ${currentUser ? `<p class="input-hint profile-account-hint">Данные аккаунта: ${escapeHtml(displayEmail)} · логин @${escapeHtml(displayUser)}</p>` : ''}
      <label class="field-label">Ваше имя</label>
      <div class="input-row">
        <input type="text" id="profileNameInput" class="input-field" placeholder="Введите имя..." value="${userName}" />
        <button class="btn btn-primary" onclick="saveProfileName()">Сохранить</button>
      </div>
      ${p.zodiacDate ? `<p class="input-hint" style="margin-top:8px">Дата рождения: ${p.zodiacDate}</p>` : `<p class="input-hint" style="margin-top:8px">Введите дату рождения в разделе Нумерология для полного портрета</p>`}
    </div>

    <!-- IDENTITY CARD -->
    <div class="glass-card" style="margin-top:0">
      <div class="profile-identity">
        <div class="pi-avatar">${avatarEmoji}</div>
        <div class="pi-info">
          <div class="pi-name">${userName || 'Пользователь'}</div>
          ${tags.length ? `<div class="pi-tags">${tags.join('')}</div>` : '<div class="pi-tags-empty">Пройдите тесты чтобы получить метки</div>'}
        </div>
      </div>
      <div class="profile-stats-mini">
        <div class="psm-item">
          <div class="psm-num">${numTests}</div>
          <div class="psm-label">Результатов</div>
        </div>
        <div class="psm-item">
          <div class="psm-num">${tags.length}</div>
          <div class="psm-label">Определено типов</div>
        </div>
        <div class="psm-item">
          <div class="psm-num">${4 - tags.length}</div>
          <div class="psm-label">Осталось пройти</div>
        </div>
      </div>
    </div>

    <!-- PORTRAIT -->
    <div class="glass-card" style="margin-top:0">
      <div class="section-title">Портрет личности</div>
      ${portrait.length > 1 || portrait[0].includes('Пройдите') ? '' : ''}
      <div class="portrait-paragraphs">
        ${portrait.map(p => `<div class="portrait-p">${p}</div>`).join('')}
      </div>
    </div>

    ${currentUser ? `
    <div class="glass-card" style="margin-top:0">
      <div class="section-title">Анализ по истории пользователя</div>
      <div class="portrait-paragraphs">
        ${historyInsights.map(p => `<div class="portrait-p">${p}</div>`).join('')}
      </div>
    </div>` : ''}

    <!-- COMPLETED TESTS SUMMARY -->
    <div class="glass-card" style="margin-top:0">
      <div class="section-title">Пройденные тесты</div>
      <div class="completed-tests">
        ${makeCompletedTestCard('numerology', latestNum, 'Матрица Пифагора', '⬡', 'numerology', null)}
        ${makeCompletedTestCard('temperament', latestTemp, 'Темперамент', '◈', 'tests', 'temperament')}
        ${makeCompletedTestCard('mbti', latestMBTI, 'MBTI', '◉', 'tests', 'mbti')}
        ${makeCompletedTestCard('bigfive', latestBF, 'Большая пятёрка', '🧩', 'tests', 'bigfive')}
        ${makeCompletedTestCard('attachment', latestAtt, 'Привязанность', '💞', 'tests', 'attachment')}
        ${makeCompletedTestCard('eq', latestEQ, 'Эмоц. интеллект', '🎭', 'tests', 'eq')}
        ${makeCompletedTestCard('locus', latestLocus, 'Локус контроля', '🎯', 'tests', 'locus')}
      </div>
    </div>

    <!-- ALL HISTORY IN PROFILE -->
    ${his.length > 0 ? `
    <div class="glass-card" style="margin-top:0">
      <div class="section-title">Все сохранённые результаты</div>
      <div class="profile-history-list">
        ${his.slice(0,10).map(e => `
          <div class="phi-item">
            <div class="history-dot dot-${e.type}" style="flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.title}</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${e.result}</div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:2px">${e.date}</div>
            </div>
          </div>`).join('')}
        ${his.length > 10 ? `<div style="text-align:center;padding:12px;font-size:13px;color:var(--text-dim)">и ещё ${his.length-10} результатов в Истории</div>` : ''}
      </div>
    </div>` : ''}
  `;
}

function makeCompletedTestCard(type, entry, label, icon, navKey, testPanel) {
  const done = !!entry;
  const go = testPanel
    ? `showPage('${navKey}'); openTestPanel('${testPanel}');`
    : `showPage('${navKey}');`;
  return `
    <div class="ctc-item ${done ? 'ctc-done' : 'ctc-todo'}" onclick="${go}">
      <div class="ctc-icon ctc-icon-${type}">${icon}</div>
      <div class="ctc-body">
        <div class="ctc-label">${label}</div>
        ${done
          ? `<div class="ctc-result">${entry.result}</div>
             <div class="ctc-date">${entry.date}</div>`
          : `<div class="ctc-result ctc-todo-text">Не пройден — нажмите чтобы начать</div>`}
      </div>
      <div class="ctc-status">${done ? '✓' : '→'}</div>
    </div>`;
}

function toggleAvatarPicker() {
  const el = document.getElementById('avatarPicker');
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function selectAvatar(emoji) {
  const p = getProfile(); p.avatar = emoji; saveProfile(p);
  document.getElementById('avatarPicker').style.display = 'none';
  saveProfileToServer();
  renderProfile();
}

function saveProfileName() {
  const name = document.getElementById('profileNameInput').value.trim();
  const p = getProfile(); p.name = name; saveProfile(p);
  saveProfileToServer();
  renderProfile();
}

// =============================================
// SIDE REAL CONSTELLATIONS (canvas)
// =============================================
const REAL_CONSTELLATIONS = {
  rat: {
    name: 'Крыса',
    nodes: [[0.22,0.62],[0.34,0.50],[0.48,0.46],[0.62,0.50],[0.74,0.58],[0.64,0.68],[0.50,0.70],[0.36,0.68]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[2,6]],
    symbol: [[0.24,0.70],[0.20,0.58],[0.30,0.46],[0.46,0.42],[0.62,0.46],[0.74,0.56],[0.70,0.68],[0.56,0.76],[0.40,0.76],[0.28,0.72]]
  },
  ox: {
    name: 'Бык',
    nodes: [[0.18,0.56],[0.32,0.46],[0.48,0.44],[0.64,0.50],[0.78,0.62],[0.62,0.72],[0.44,0.74]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]],
    symbol: [[0.18,0.70],[0.20,0.54],[0.34,0.44],[0.50,0.42],[0.66,0.48],[0.78,0.60],[0.74,0.74],[0.60,0.82],[0.44,0.84],[0.28,0.78]]
  },
  tiger: {
    name: 'Тигр',
    nodes: [[0.18,0.52],[0.30,0.42],[0.44,0.38],[0.58,0.40],[0.72,0.50],[0.68,0.64],[0.54,0.72],[0.38,0.70],[0.24,0.62]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0]],
    symbol: [[0.20,0.64],[0.18,0.50],[0.30,0.40],[0.46,0.36],[0.62,0.40],[0.74,0.50],[0.70,0.66],[0.56,0.76],[0.40,0.78],[0.26,0.72]]
  },
  rabbit: {
    name: 'Кролик',
    nodes: [[0.24,0.66],[0.36,0.50],[0.50,0.46],[0.64,0.52],[0.72,0.66],[0.60,0.74],[0.44,0.76],[0.30,0.74]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
    symbol: [[0.28,0.76],[0.24,0.62],[0.32,0.48],[0.48,0.42],[0.64,0.48],[0.74,0.60],[0.70,0.72],[0.56,0.80],[0.40,0.82],[0.30,0.78]]
  },
  dragon: {
    name: 'Дракон',
    nodes: [[0.16,0.58],[0.30,0.48],[0.44,0.44],[0.58,0.50],[0.70,0.60],[0.78,0.72],[0.64,0.80],[0.48,0.78],[0.34,0.70],[0.24,0.64]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],[2,7]],
    symbol: [[0.18,0.68],[0.16,0.56],[0.28,0.46],[0.44,0.42],[0.60,0.48],[0.72,0.58],[0.80,0.70],[0.72,0.82],[0.56,0.86],[0.40,0.82],[0.26,0.74]]
  },
  snake: {
    name: 'Змея',
    nodes: [[0.22,0.42],[0.34,0.36],[0.48,0.38],[0.60,0.46],[0.70,0.58],[0.64,0.70],[0.50,0.76],[0.36,0.74],[0.26,0.64]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]],
    symbol: [[0.24,0.72],[0.20,0.56],[0.28,0.44],[0.44,0.38],[0.60,0.44],[0.72,0.56],[0.68,0.70],[0.54,0.80],[0.38,0.80],[0.26,0.74]]
  },
  horse: {
    name: 'Лошадь',
    nodes: [[0.18,0.58],[0.30,0.48],[0.46,0.44],[0.62,0.48],[0.76,0.60],[0.68,0.72],[0.50,0.76],[0.34,0.72]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[2,6]],
    symbol: [[0.20,0.70],[0.18,0.54],[0.30,0.44],[0.46,0.40],[0.62,0.44],[0.76,0.56],[0.72,0.72],[0.56,0.82],[0.38,0.82],[0.24,0.74]]
  },
  goat: {
    name: 'Коза',
    nodes: [[0.20,0.60],[0.32,0.50],[0.46,0.46],[0.60,0.50],[0.72,0.60],[0.62,0.72],[0.48,0.76],[0.34,0.74]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
    symbol: [[0.22,0.72],[0.20,0.58],[0.30,0.48],[0.46,0.44],[0.62,0.48],[0.74,0.58],[0.68,0.72],[0.54,0.80],[0.38,0.80],[0.26,0.74]]
  },
  monkey: {
    name: 'Обезьяна',
    nodes: [[0.24,0.56],[0.36,0.44],[0.50,0.40],[0.64,0.44],[0.74,0.56],[0.68,0.70],[0.54,0.78],[0.40,0.78],[0.28,0.70]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0],[2,6]],
    symbol: [[0.26,0.72],[0.22,0.56],[0.34,0.44],[0.50,0.38],[0.66,0.44],[0.76,0.56],[0.70,0.72],[0.56,0.82],[0.40,0.82],[0.28,0.76]]
  },
  rooster: {
    name: 'Петух',
    nodes: [[0.22,0.58],[0.34,0.48],[0.48,0.44],[0.62,0.48],[0.74,0.60],[0.66,0.72],[0.52,0.78],[0.36,0.76]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
    symbol: [[0.24,0.72],[0.20,0.58],[0.30,0.46],[0.46,0.42],[0.62,0.46],[0.76,0.58],[0.70,0.72],[0.56,0.82],[0.40,0.82],[0.28,0.76]]
  },
  dog: {
    name: 'Собака',
    nodes: [[0.20,0.56],[0.32,0.46],[0.46,0.42],[0.62,0.46],[0.76,0.58],[0.68,0.72],[0.52,0.78],[0.36,0.76],[0.24,0.68]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0]],
    symbol: [[0.22,0.70],[0.18,0.56],[0.30,0.44],[0.46,0.40],[0.62,0.44],[0.76,0.56],[0.72,0.72],[0.56,0.82],[0.38,0.82],[0.24,0.74]]
  },
  pig: {
    name: 'Свинья',
    nodes: [[0.24,0.62],[0.36,0.52],[0.50,0.48],[0.64,0.52],[0.74,0.62],[0.66,0.74],[0.52,0.80],[0.38,0.78],[0.28,0.70]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0]],
    symbol: [[0.26,0.74],[0.22,0.60],[0.34,0.50],[0.50,0.46],[0.66,0.50],[0.76,0.62],[0.70,0.76],[0.56,0.84],[0.40,0.84],[0.28,0.78]]
  }
};

const CONSTELLATION_PAIRS = [
  ['rat', 'ox'],
  ['tiger', 'rabbit'],
  ['dragon', 'snake'],
  ['horse', 'goat'],
  ['monkey', 'rooster'],
  ['dog', 'pig'],
];

function makeDust(count) {
  return Array.from({ length: count }, (_, i) => ({
    x: (i * 59 % 100) / 100,
    y: (i * 41 % 100) / 100,
    r: 0.6 + (i % 4) * 0.35,
    phase: (i * 0.41) % (Math.PI * 2),
    speed: 0.25 + (i % 6) * 0.08,
  }));
}

const sideSky = {
  left:  { canvas: null, ctx: null, w: 0, h: 0, target: 'rat', current: 'rat', alpha: 1, dust: makeDust(70), trail: 0 },
  right: { canvas: null, ctx: null, w: 0, h: 0, target: 'ox', current: 'ox', alpha: 1, dust: makeDust(70), trail: 0 },
  scrollRatio: 0,
  pairIndex: -1,
  raf: null,
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getConstellationPalette() {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  if (isLight) {
    return {
      bgTop: 'rgba(146, 172, 236, 0.12)',
      bgBottom: 'rgba(118, 150, 224, 0.06)',
      dust: (a) => `rgba(64, 104, 204, ${a})`,
      symbolA: (a) => `rgba(88, 126, 225, ${a})`,
      symbolB: (a) => `rgba(128, 166, 245, ${a})`,
      symbolStroke: (a) => `rgba(86, 122, 212, ${a})`,
      line: (a) => `rgba(54, 98, 210, ${a})`,
      lineShadow: (a) => `rgba(66, 110, 220, ${a})`,
      cometCore: (a) => `rgba(244, 248, 255, ${a})`,
      cometAura: (a) => `rgba(78, 128, 235, ${a})`,
      starCore: (a) => `rgba(240, 246, 255, ${a})`,
      starGlow: (a) => `rgba(78, 126, 224, ${a})`,
      label: (a) => `rgba(33, 74, 166, ${a})`,
      name: (a) => `rgba(38, 80, 176, ${a})`,
    };
  }
  return {
    bgTop: 'rgba(10, 10, 24, 0.42)',
    bgBottom: 'rgba(8, 10, 22, 0.18)',
    dust: (a) => `rgba(170, 198, 255, ${a})`,
    symbolA: (a) => `rgba(120, 158, 255, ${a})`,
    symbolB: (a) => `rgba(200, 224, 255, ${a})`,
    symbolStroke: (a) => `rgba(150, 188, 255, ${a})`,
    line: (a) => `rgba(160, 198, 255, ${a})`,
    lineShadow: (a) => `rgba(122, 161, 255, ${a})`,
    cometCore: (a) => `rgba(244, 250, 255, ${a})`,
    cometAura: (a) => `rgba(170, 210, 255, ${a})`,
    starCore: (a) => `rgba(230, 240, 255, ${a})`,
    starGlow: (a) => `rgba(154, 196, 255, ${a})`,
    label: (a) => `rgba(215, 232, 255, ${a})`,
    name: (a) => `rgba(180, 206, 255, ${a})`,
  };
}

function setupSideConstellations() {
  sideSky.left.canvas = document.getElementById('constellationCanvasLeft');
  sideSky.right.canvas = document.getElementById('constellationCanvasRight');
  if (!sideSky.left.canvas || !sideSky.right.canvas) return;
  sideSky.left.ctx = sideSky.left.canvas.getContext('2d');
  sideSky.right.ctx = sideSky.right.canvas.getContext('2d');
  if (!sideSky.left.ctx || !sideSky.right.ctx) return;

  resizeSideConstellations();
  updateSideConstellationTargets();

  window.addEventListener('resize', resizeSideConstellations);
  window.addEventListener('scroll', updateSideConstellationTargets, { passive: true });
  sideSky.raf = window.requestAnimationFrame(sideConstellationFrame);
}

function resizeSingleSide(side) {
  if (!side.canvas || !side.ctx) return;
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const bounds = side.canvas.getBoundingClientRect();
  side.w = Math.max(1, bounds.width);
  side.h = Math.max(1, bounds.height);
  side.canvas.width = Math.floor(side.w * ratio);
  side.canvas.height = Math.floor(side.h * ratio);
  side.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function resizeSideConstellations() {
  resizeSingleSide(sideSky.left);
  resizeSingleSide(sideSky.right);
}

function updateSideConstellationTargets() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const maxScroll = Math.max(1, docHeight - window.innerHeight);
  sideSky.scrollRatio = Math.min(1, Math.max(0, scrollTop / maxScroll));
  const next = Math.min(CONSTELLATION_PAIRS.length - 1, Math.floor(sideSky.scrollRatio * CONSTELLATION_PAIRS.length));
  if (next === sideSky.pairIndex) return;
  sideSky.pairIndex = next;
  const [leftKey, rightKey] = CONSTELLATION_PAIRS[next];
  sideSky.left.target = leftKey;
  sideSky.right.target = rightKey;
}

function drawDust(ctx, side, timeSec, palette) {
  for (const d of side.dust) {
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * d.speed + d.phase));
    const x = (d.x * side.w + Math.sin(timeSec * 0.1 + d.phase) * 6 + side.w) % side.w;
    const y = (d.y * side.h + Math.cos(timeSec * 0.08 + d.phase) * 5 + side.h) % side.h;
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = palette.dust(0.18 + tw * 0.42);
    ctx.fill();
  }
}

function drawOneConstellation(ctx, side, key, timeSec, alphaMul, palette) {
  const c = REAL_CONSTELLATIONS[key];
  if (!c) return;

  if (c.symbol && c.symbol.length > 2) {
    ctx.beginPath();
    c.symbol.forEach((p, idx) => {
      const x = p[0] * side.w + Math.sin(timeSec * 0.3 + idx * 0.4) * 1.2;
      const y = p[1] * side.h + Math.cos(timeSec * 0.25 + idx * 0.5) * 1.2;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, side.w, side.h);
    grad.addColorStop(0, palette.symbolA(0.08 * alphaMul));
    grad.addColorStop(1, palette.symbolB(0.05 * alphaMul));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = palette.symbolStroke(0.14 * alphaMul);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const nodes = c.nodes.map((n, i) => {
    const swayX = Math.sin(timeSec * 0.9 + i * 0.9) * 2.6;
    const swayY = Math.cos(timeSec * 0.8 + i * 0.8) * 2.6;
    return [n[0] * side.w + swayX, n[1] * side.h + swayY];
  });

  ctx.lineWidth = 1.25;
  ctx.strokeStyle = palette.line(0.32 * alphaMul);
  ctx.shadowBlur = 14;
  ctx.shadowColor = palette.lineShadow(0.42 * alphaMul);
  ctx.beginPath();
  for (const [a, b] of c.edges) {
    const p1 = nodes[a];
    const p2 = nodes[b];
    if (!p1 || !p2) continue;
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // "Комета" бежит по рёбрам, усиливая ощущение живой схемы
  side.trail = (side.trail + 0.012 + Math.abs(Math.sin(timeSec * 0.4)) * 0.004) % 1;
  const totalEdges = c.edges.length || 1;
  const edgeProgress = side.trail * totalEdges;
  const edgeIdx = Math.floor(edgeProgress) % totalEdges;
  const localT = edgeProgress - Math.floor(edgeProgress);
  const trailEdge = c.edges[edgeIdx];
  if (trailEdge) {
    const p1 = nodes[trailEdge[0]];
    const p2 = nodes[trailEdge[1]];
    if (p1 && p2) {
      const tx = lerp(p1[0], p2[0], localT);
      const ty = lerp(p1[1], p2[1], localT);
      ctx.beginPath();
      ctx.arc(tx, ty, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = palette.cometCore(0.85 * alphaMul);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fillStyle = palette.cometAura(0.18 * alphaMul);
      ctx.fill();
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const [x, y] = nodes[i];
    const pulse = 0.40 + 0.60 * (0.5 + 0.5 * Math.sin(timeSec * 2.2 + i * 0.85));

    ctx.beginPath();
    ctx.arc(x, y, 2.1 + pulse * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = palette.starCore((0.52 + pulse * 0.45) * alphaMul);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 7 + pulse * 3, 0, Math.PI * 2);
    ctx.fillStyle = palette.starGlow((0.08 + pulse * 0.09) * alphaMul);
    ctx.fill();
  }

  if (Array.isArray(c.labels)) {
    ctx.font = `600 ${Math.max(10, Math.min(13, side.w * 0.065))}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.textAlign = 'left';
    for (const label of c.labels) {
      const p = nodes[label.node];
      if (!p) continue;
      ctx.fillStyle = palette.label(0.78 * alphaMul);
      ctx.fillText(label.text, p[0] + (label.dx || 0), p[1] + (label.dy || 0));
    }
  }

  ctx.font = '600 11px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.name(0.55 * alphaMul);
  ctx.fillText(c.name, side.w / 2, side.h - 16);
}

function drawSideCanvas(side, timeSec) {
  if (!side.ctx || side.w < 1 || side.h < 1) return;
  const ctx = side.ctx;
  const palette = getConstellationPalette();
  ctx.clearRect(0, 0, side.w, side.h);

  const bg = ctx.createLinearGradient(0, 0, 0, side.h);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, side.w, side.h);

  drawDust(ctx, side, timeSec, palette);

  if (side.current !== side.target) {
    side.alpha = Math.max(0, side.alpha - 0.07);
    drawOneConstellation(ctx, side, side.current, timeSec, side.alpha, palette);
    if (side.alpha <= 0.02) {
      side.current = side.target;
      side.alpha = 0;
    }
  } else {
    side.alpha = Math.min(1, side.alpha + 0.07);
    drawOneConstellation(ctx, side, side.current, timeSec, side.alpha, palette);
  }
}

function sideConstellationFrame(ts) {
  const t = ts / 1000;
  drawSideCanvas(sideSky.left, t);
  drawSideCanvas(sideSky.right, t);
  sideSky.raf = window.requestAnimationFrame(sideConstellationFrame);
}

setupSideConstellations();
// =============================================
// ENNEAGRAM TEST
// =============================================
let ennAnswers = {};
let ennInitialized = false;

function initEnnTest() {
  ennInitialized = true;
  ennAnswers = {};
  renderEnnTest();
}

function renderEnnTest() {
  const total = ENNEAGRAM_QUESTIONS.length;
  const answered = Object.keys(ennAnswers).length;
  const pct = ((answered / total) * 100).toFixed(0);

  const OPTS = [
    { v: 4, label: 'Очень похоже' },
    { v: 3, label: 'Похоже' },
    { v: 2, label: 'Немного' },
    { v: 1, label: 'Не похоже' },
  ];

  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="glass-card" style="margin-bottom:16px">
      <div class="desc-text">Оцените, насколько каждое утверждение описывает вас. Отвечайте по первому ощущению.</div>
    </div>
  `;

  ENNEAGRAM_QUESTIONS.forEach(q => {
    const sel = ennAnswers[q.id];
    const typeInfo = ENNEAGRAM_TYPES[q.type];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}" id="ennq-${q.id}">
        <div class="question-num">Тип ${q.type} · ${typeInfo.name} ${typeInfo.emoji}</div>
        <div class="question-text">${q.text}</div>
        <div class="options-list enn-opts">
          ${OPTS.map(opt => `
            <button class="option-btn ${sel === opt.v ? 'selected' : ''}" onclick="selectEnnAnswer(${q.id},${opt.v})">
              ${opt.label}
            </button>`).join('')}
        </div>
      </div>`;
  });

  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitEnnTest()">
    ${answered < total ? `Осталось ответить: ${total - answered}` : 'Получить результат'}</button></div>`;

  document.getElementById('ennTest').innerHTML = html;
}

function selectEnnAnswer(qId, val) {
  ennAnswers[qId] = val;
  renderEnnTest();
}

function submitEnnTest() {
  const scores = {};
  for (let i = 1; i <= 9; i++) scores[i] = 0;
  ENNEAGRAM_QUESTIONS.forEach(q => {
    if (ennAnswers[q.id] !== undefined) scores[q.type] += ennAnswers[q.id];
  });
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  showEnnResult(parseInt(sorted[0][0]), scores);
}

function showEnnResult(type, scores) {
  const info = ENNEAGRAM_TYPES[type];
  const maxScore = Math.max(...Object.values(scores));

  const scoreBars = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([t, v]) => {
    const ti = ENNEAGRAM_TYPES[parseInt(t)];
    return `<div class="score-item">
      <div class="score-header">
        <span class="score-name">${ti.emoji} Тип ${t} — ${ti.name}</span>
        <span class="score-val">${v}/8</span>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${Math.round(v / 8 * 100)}%;background:linear-gradient(90deg,#6366f1,#a78bfa)"></div>
      </div>
    </div>`;
  }).join('');

  const html = `
    <div class="result-hero">
      <span class="result-emoji">${info.emoji}</span>
      <div class="result-type">Тип ${type} — ${info.name}</div>
      <div class="result-nickname">${info.key}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Описание</div>
      <div class="desc-text">${info.desc}</div>
    </div>
    <div class="two-cols">
      <div class="glass-card">
        <div class="col-title col-green">✓ Сильные стороны</div>
        <ul class="strengths-list">${info.strengths.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
      <div class="glass-card">
        <div class="col-title col-amber">! Зоны роста</div>
        <ul class="weaknesses-list">${info.weaknesses.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="glass-card">
      <div class="section-title">Профиль по всем типам</div>
      <div class="score-bar-row">${scoreBars}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Об эннеаграмме</div>
      <div class="desc-text">Эннеаграмма — типология личности, описывающая 9 базовых архетипов мотивации. В отличие от MBTI, она фокусируется не на поведении, а на глубинных мотивах и страхах. Каждый тип имеет свои зоны роста и интеграции. Высокий балл по типу отражает узнавание себя, но это не жёсткий ярлык — в каждом человеке присутствуют черты нескольких типов.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetEnnTest()">Пройти снова</button>
      <button class="btn btn-primary" id="ennSaveBtn" onclick="saveEnnResult(${type})">Сохранить в историю</button>
    </div>
  `;

  document.getElementById('ennTest').style.display = 'none';
  document.getElementById('ennResult').innerHTML = html;
  document.getElementById('ennResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveEnnResult(type) {
  const info = ENNEAGRAM_TYPES[type];
  saveHistory({ type: 'enneagram', title: `Эннеаграмма — Тип ${type} (${info.name})`, result: `${info.emoji} ${info.name}` });
  const btn = document.getElementById('ennSaveBtn');
  if (btn) { btn.textContent = '✓ Сохранено'; btn.disabled = true; btn.classList.replace('btn-primary', 'btn-secondary'); }
}

function resetEnnTest() {
  ennAnswers = {};
  document.getElementById('ennTest').style.display = 'block';
  document.getElementById('ennResult').style.display = 'none';
  renderEnnTest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// LOVE LANGUAGES TEST
// =============================================
let llAnswers = {};
let llInitialized = false;

function initLLTest() {
  llInitialized = true;
  llAnswers = {};
  renderLLTest();
}

function renderLLTest() {
  const total = LOVE_LANG_QUESTIONS.length;
  const answered = Object.keys(llAnswers).length;
  const pct = ((answered / total) * 100).toFixed(0);

  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="glass-card" style="margin-bottom:16px">
      <div class="desc-text">В каждом вопросе выберите тот вариант, который важнее лично для вас прямо сейчас.</div>
    </div>
  `;

  LOVE_LANG_QUESTIONS.forEach(q => {
    const sel = llAnswers[q.id];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}" id="llq-${q.id}">
        <div class="question-num">Вопрос ${q.id} из ${total}</div>
        <div class="question-text">${q.text}</div>
        <div class="options-list">
          ${q.opts.map((opt, i) => `
            <button class="option-btn ${sel === opt.l ? 'selected' : ''}" onclick="selectLLAnswer(${q.id},'${opt.l}')">
              <strong>${['А', 'Б'][i]}.</strong> ${opt.text}
            </button>`).join('')}
        </div>
      </div>`;
  });

  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitLLTest()">
    ${answered < total ? `Осталось: ${total - answered}` : 'Узнать свой язык любви'}</button></div>`;

  document.getElementById('llTest').innerHTML = html;
}

function selectLLAnswer(qId, lang) {
  llAnswers[qId] = lang;
  renderLLTest();
}

function submitLLTest() {
  const scores = { words: 0, time: 0, gifts: 0, service: 0, touch: 0 };
  LOVE_LANG_QUESTIONS.forEach(q => { if (llAnswers[q.id]) scores[llAnswers[q.id]]++; });
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  showLLResult(sorted[0][0], sorted[1][0], scores);
}

function showLLResult(primary, secondary, scores) {
  const p = LOVE_LANG_TYPES[primary];
  const s = LOVE_LANG_TYPES[secondary];
  const total = LOVE_LANG_QUESTIONS.length;
  const langColors = { words: '#6366f1', time: '#22d3ee', gifts: '#f59e0b', service: '#10b981', touch: '#ec4899' };

  const scoreBars = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([lang, v]) => {
    const info = LOVE_LANG_TYPES[lang];
    return `<div class="score-item">
      <div class="score-header">
        <span class="score-name">${info.emoji} ${info.name}</span>
        <span class="score-val">${v} из ${total}</span>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${Math.round(v / total * 100)}%;background:${langColors[lang]}"></div>
      </div>
    </div>`;
  }).join('');

  const html = `
    <div class="result-hero">
      <span class="result-emoji">${p.emoji}</span>
      <div class="result-type">${p.name}</div>
      <div class="result-nickname">Ваш главный язык любви</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Что это значит</div>
      <div class="desc-text">${p.desc}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Второй язык — ${s.emoji} ${s.name}</div>
      <div class="desc-text">${s.desc}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Ваш профиль</div>
      <div class="score-bar-row">${scoreBars}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Как применить</div>
      <div class="desc-text">Расскажите партнёру и близким о своём языке любви и попросите их тоже пройти тест. Когда каждый знает, как другой ощущает заботу, общение становится значительно теплее и эффективнее. Концепция разработана доктором Гэри Чепменом.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetLLTest()">Пройти снова</button>
      <button class="btn btn-primary" id="llSaveBtn" onclick="saveLLResult('${primary}')">Сохранить в историю</button>
    </div>
  `;

  document.getElementById('llTest').style.display = 'none';
  document.getElementById('llResult').innerHTML = html;
  document.getElementById('llResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveLLResult(primary) {
  const info = LOVE_LANG_TYPES[primary];
  saveHistory({ type: 'lovelang', title: `Языки любви — ${info.name}`, result: `${info.emoji} ${info.name}` });
  const btn = document.getElementById('llSaveBtn');
  if (btn) { btn.textContent = '✓ Сохранено'; btn.disabled = true; btn.classList.replace('btn-primary', 'btn-secondary'); }
}

function resetLLTest() {
  llAnswers = {};
  document.getElementById('llTest').style.display = 'block';
  document.getElementById('llResult').style.display = 'none';
  renderLLTest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// ROSENBERG SELF-ESTEEM TEST
// =============================================
let seAnswers = {};
let seInitialized = false;

function initSETest() {
  seInitialized = true;
  seAnswers = {};
  renderSETest();
}

function renderSETest() {
  const total = ROSENBERG_QUESTIONS.length;
  const answered = Object.keys(seAnswers).length;
  const pct = ((answered / total) * 100).toFixed(0);

  const OPTS = [
    { v: 4, label: 'Полностью согласен' },
    { v: 3, label: 'Согласен' },
    { v: 2, label: 'Не согласен' },
    { v: 1, label: 'Совсем не согласен' },
  ];

  let html = `
    <div class="progress-wrap glass-card">
      <div class="progress-row"><span>Прогресс</span><span>${answered}/${total}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="glass-card" style="margin-bottom:16px">
      <div class="desc-text">Оцените, насколько вы согласны с каждым утверждением. Отвечайте честно — нет правильных ответов.</div>
    </div>
  `;

  ROSENBERG_QUESTIONS.forEach(q => {
    const sel = seAnswers[q.id];
    html += `
      <div class="question-card ${sel !== undefined ? 'answered' : ''}" id="seq-${q.id}">
        <div class="question-num">Утверждение ${q.id}</div>
        <div class="question-text">${q.text}</div>
        <div class="options-list enn-opts">
          ${OPTS.map(opt => `
            <button class="option-btn ${sel === opt.v ? 'selected' : ''}" onclick="selectSEAnswer(${q.id},${opt.v})">
              ${opt.label}
            </button>`).join('')}
        </div>
      </div>`;
  });

  html += `<div class="sticky-bar"><button class="sticky-btn" ${answered < total ? 'disabled' : ''} onclick="submitSETest()">
    ${answered < total ? `Осталось: ${total - answered}` : 'Посмотреть результат'}</button></div>`;

  document.getElementById('seTest').innerHTML = html;
}

function selectSEAnswer(qId, val) {
  seAnswers[qId] = val;
  renderSETest();
}

function submitSETest() {
  let total = 0;
  ROSENBERG_QUESTIONS.forEach(q => {
    const val = seAnswers[q.id];
    if (val === undefined) return;
    total += q.positive ? val : (5 - val);
  });
  showSEResult(total);
}

function showSEResult(score) {
  let level, desc, color, emoji;
  if (score >= 30) {
    level = 'Высокая самооценка'; emoji = '🌟'; color = '#10b981';
    desc = 'Вы цените себя и доверяете своим силам. Стабильная самооценка — важный фундамент для принятия решений, построения отношений и достижения целей. Это не самонадеянность, а здоровое ощущение своей ценности.';
  } else if (score >= 20) {
    level = 'Средняя самооценка'; emoji = '💛'; color = '#f59e0b';
    desc = 'Ваша самооценка в норме — достаточно устойчива, но в некоторых ситуациях или сферах могут возникать сомнения в себе. Это очень распространённый результат. Осознанная работа с убеждениями о себе поможет двигаться к большей уверенности.';
  } else {
    level = 'Пониженная самооценка'; emoji = '🌱'; color = '#6366f1';
    desc = 'Вы склонны оценивать себя критично. Это часто связано с прошлым опытом, а не с реальными качествами. Пониженная самооценка — рабочая зона: при осознанном подходе, а иногда и с помощью специалиста, она изменяется. Первый шаг — осознание.';
  }

  const pct = Math.round(((score - 10) / 30) * 100);
  const html = `
    <div class="result-hero">
      <span class="result-emoji">${emoji}</span>
      <div class="result-type" style="-webkit-text-fill-color:${color};color:${color}">${level}</div>
      <div class="result-nickname">${score} из 40 баллов</div>
    </div>
    <div class="glass-card">
      <div class="section-title">Шкала самооценки</div>
      <div class="score-item">
        <div class="score-header">
          <span class="score-name">Итоговый балл</span>
          <span class="score-val">${score} / 40</span>
        </div>
        <div class="score-track"><div class="score-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);margin-top:6px">
        <span>10 — низкая</span><span>25 — средняя</span><span>40 — высокая</span>
      </div>
    </div>
    <div class="glass-card">
      <div class="section-title">Интерпретация</div>
      <div class="desc-text">${desc}</div>
    </div>
    <div class="glass-card">
      <div class="section-title">О тесте</div>
      <div class="desc-text">Шкала самооценки Розенберга (1965) — один из самых надёжных и широко используемых психометрических инструментов. Состоит из 10 утверждений, 5 из которых оцениваются в обратном порядке. Результаты могут меняться в зависимости от текущего периода жизни.</div>
    </div>
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="resetSETest()">Пройти снова</button>
      <button class="btn btn-primary" id="seSaveBtn" onclick="saveSEResult(${score},'${level}')">Сохранить в историю</button>
    </div>
  `;

  document.getElementById('seTest').style.display = 'none';
  document.getElementById('seResult').innerHTML = html;
  document.getElementById('seResult').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveSEResult(score, level) {
  saveHistory({ type: 'selfesteem', title: `Самооценка Розенберга — ${level}`, result: `Балл: ${score}/40` });
  const btn = document.getElementById('seSaveBtn');
  if (btn) { btn.textContent = '✓ Сохранено'; btn.disabled = true; btn.classList.replace('btn-primary', 'btn-secondary'); }
}

function resetSETest() {
  seAnswers = {};
  document.getElementById('seTest').style.display = 'block';
  document.getElementById('seResult').style.display = 'none';
  renderSETest();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// EXTENDED TEST PANEL OPENER
// =============================================
function openExtendedTestPanel(id) {
  if (typeof openTestPanel === 'function') openTestPanel(id);
  if (id === 'enneagram' && !ennInitialized) initEnnTest();
  if (id === 'lovelang' && !llInitialized) initLLTest();
  if (id === 'selfesteem' && !seInitialized) initSETest();
}

// =============================================
// COSMIC SIDE WIDGETS
// =============================================
const _RU_DAYS  = ['вс','пн','вт','ср','чт','пт','сб'];
const _RU_MON   = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const _RU_MON_G = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function _getDailyNumber() {
  const n = new Date();
  let s = n.getDate() + n.getMonth() + 1 + n.getFullYear();
  while (s > 9) s = String(s).split('').reduce((a, b) => a + +b, 0);
  return s || 9;
}

function _getMoonPhase() {
  const diff = (Date.now() - new Date('2000-01-06').getTime()) / 86400000;
  const phase = ((diff % 29.53) + 29.53) % 29.53 / 29.53;
  if (phase < 0.063) return { sym: '🌑', name: 'Новолуние' };
  if (phase < 0.188) return { sym: '🌒', name: 'Растущий серп' };
  if (phase < 0.313) return { sym: '🌓', name: '1-я четверть' };
  if (phase < 0.438) return { sym: '🌔', name: 'Растущая луна' };
  if (phase < 0.563) return { sym: '🌕', name: 'Полнолуние' };
  if (phase < 0.688) return { sym: '🌖', name: 'Убывающая луна' };
  if (phase < 0.813) return { sym: '🌗', name: '4-я четверть' };
  return { sym: '🌘', name: 'Убывающий серп' };
}

function _getSunSign() {
  const now = new Date();
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  if (md >= 321 && md <= 419) return { sym: '♈', name: 'Овен' };
  if (md >= 420 && md <= 520) return { sym: '♉', name: 'Телец' };
  if (md >= 521 && md <= 620) return { sym: '♊', name: 'Близнецы' };
  if (md >= 621 && md <= 722) return { sym: '♋', name: 'Рак' };
  if (md >= 723 && md <= 822) return { sym: '♌', name: 'Лев' };
  if (md >= 823 && md <= 922) return { sym: '♍', name: 'Дева' };
  if (md >= 923 && md <= 1022) return { sym: '♎', name: 'Весы' };
  if (md >= 1023 && md <= 1121) return { sym: '♏', name: 'Скорпион' };
  if (md >= 1122 && md <= 1221) return { sym: '♐', name: 'Стрелец' };
  if (md >= 1222 || md <= 119) return { sym: '♑', name: 'Козерог' };
  if (md >= 120 && md <= 218) return { sym: '♒', name: 'Водолей' };
  return { sym: '♓', name: 'Рыбы' };
}

function _updateClock() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const hourDeg   = ((h % 12) + m / 60) * 30;
  const minuteDeg = (m + s / 60) * 6;
  const secondDeg = s * 6;

  const hEl = document.getElementById('cw-hour');
  const mEl = document.getElementById('cw-minute');
  const sEl = document.getElementById('cw-second');
  if (hEl) hEl.setAttribute('transform', `rotate(${hourDeg.toFixed(1)}, 50, 50)`);
  if (mEl) mEl.setAttribute('transform', `rotate(${minuteDeg.toFixed(1)}, 50, 50)`);
  if (sEl) sEl.setAttribute('transform', `rotate(${secondDeg}, 50, 50)`);

  const tEl = document.getElementById('cw-time-txt');
  if (tEl) tEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

  const dEl = document.getElementById('cw-date-txt');
  if (dEl) dEl.textContent = `${_RU_DAYS[now.getDay()]}, ${now.getDate()} ${_RU_MON[now.getMonth()]}`;
}

function initCosmicWidgets() {
  // Clock
  _updateClock();
  setInterval(_updateClock, 1000);

  // Constellation of month
  const conEl = document.getElementById('cw-constellation');
  if (conEl && typeof MONTH_CONSTELLATIONS !== 'undefined') {
    conEl.textContent = MONTH_CONSTELLATIONS[new Date().getMonth()].join(' · ');
  }

  // Daily number
  const num = _getDailyNumber();
  const numInfo = typeof DAILY_NUM_DESC !== 'undefined' ? DAILY_NUM_DESC[num] : null;
  const numEl = document.getElementById('dn-number');
  if (numEl) numEl.textContent = num;
  if (numInfo) {
    const nameEl = document.getElementById('dn-name');
    const descEl = document.getElementById('dn-desc');
    if (nameEl) nameEl.textContent = (numInfo.emoji || '') + ' ' + numInfo.name;
    if (descEl) descEl.textContent = numInfo.desc;
  }

  // Moon phase
  const moon = _getMoonPhase();
  const moonSymEl  = document.getElementById('dn-moon-sym');
  const moonNameEl = document.getElementById('dn-moon-name');
  if (moonSymEl)  moonSymEl.textContent  = moon.sym;
  if (moonNameEl) moonNameEl.textContent = moon.name;

  // Sun sign
  const sun = _getSunSign();
  const sunSymEl  = document.getElementById('dn-sun-sym');
  const sunNameEl = document.getElementById('dn-sun-name');
  if (sunSymEl)  sunSymEl.textContent  = sun.sym;
  if (sunNameEl) sunNameEl.textContent = sun.name;

  // Today date
  const todayEl = document.getElementById('dn-today');
  if (todayEl) {
    const now = new Date();
    todayEl.textContent = `${now.getDate()} ${_RU_MON_G[now.getMonth()]} ${now.getFullYear()}`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCosmicWidgets);
} else {
  setTimeout(initCosmicWidgets, 0);
}
