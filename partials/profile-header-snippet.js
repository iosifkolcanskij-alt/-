// Snippet inserted into renderProfile innerHTML - not a standalone file
    ${currentUser ? `
    <motion class="profile-hero glass-card">
      <div class="profile-hero-top">
        <button type="button" class="profile-hero-avatar" onclick="toggleAvatarPicker()" title="Сменить аватар">
          <span id="profileAvatarDisp">${avatarEmoji}</span>
          <span class="profile-hero-avatar-edit">✎</span>
        </button>
        <div class="profile-hero-info">
          <h3 class="profile-hero-name">${escapeHtml(userName || currentUser.username)}</h3>
          <p class="profile-hero-login">@${escapeHtml(displayUser)}</p>
          <div class="profile-hero-badges">
            <span class="profile-badge ${emailVerified ? 'profile-badge-ok' : 'profile-badge-warn'}">${emailVerified ? '✓ Email подтверждён' : '⚠ Подтвердите email'}</span>
            <span class="profile-badge">${authProvider === 'google' ? 'Google' : 'Email'}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm profile-logout-btn" onclick="logout()">Выйти</button>
      </div>
      <div class="profile-avatar-picker" id="avatarPicker" style="display:none">
        ${AVATARS.map(a => `<button type="button" class="avatar-opt" onclick="selectAvatar('${a}')">${a}</button>`).join('')}
      </div>
      <div class="profile-data-grid">
        <div class="profile-data-item"><span class="pdi-label">Email</span><span class="pdi-value">${escapeHtml(displayEmail)}</span></div>
        <div class="profile-data-item"><span class="pdi-label">Логин</span><span class="pdi-value">@${escapeHtml(displayUser)}</span></div>
        ${memberSince ? `<div class="profile-data-item"><span class="pdi-label">В системе с</span><span class="pdi-value">${memberSince}</span></div>` : ''}
        <div class="profile-data-item"><span class="pdi-label">Дата рождения</span><span class="pdi-value">${p.zodiacDate ? escapeHtml(p.zodiacDate) : '—'}</span></div>
        ${p.westSign ? `<motion class="profile-data-item"><span class="pdi-label">Знак зодиака</span><span class="pdi-value">${escapeHtml(p.westSign)}</span></div>` : ''}
        ${p.chSign ? `<div class="profile-data-item"><span class="pdi-label">Год Шэнсяо</span><span class="pdi-value">${escapeHtml(p.chSign)}</span></div>` : ''}
      </div>
      <div class="profile-name-edit">
        <label class="field-label" for="profileNameInput">Отображаемое имя</label>
        <div class="input-row">
          <input type="text" id="profileNameInput" class="input-field" value="${escapeHtml(userName)}" />
          <button type="button" class="btn btn-primary" onclick="saveProfileName()">Сохранить</button>
        </div>
      </div>
    </div>` : `
    <div class="glass-card profile-guest-card">
      <div class="profile-guest-icon">🔐</div>
      <h3 class="profile-guest-title">Войдите в аккаунт</h3>
      <p class="profile-guest-text">Подтверждение email, сброс пароля и вход через Google. История синхронизируется на сервере.</p>
      <div class="profile-guest-actions">
        <button type="button" class="btn btn-primary" onclick="showAuthModal('login')">Войти</button>
        <button type="button" class="btn btn-secondary" onclick="showAuthModal('register')">Регистрация</button>
        <button type="button" class="auth-google-btn profile-guest-google" onclick="loginWithGoogle()">Google</button>
      </div>
    </div>
    <div class="glass-card profile-local-card">
      <motion class="section-title">Локально в браузере</div>
      <div class="profile-avatar-row">
        <div class="profile-avatar">${avatarEmoji}</motion>
      </div>
      <label class="field-label" for="profileNameInput">Имя</label>
      <div class="input-row">
        <input type="text" id="profileNameInput" class="input-field" value="${escapeHtml(userName)}" />
        <button type="button" class="btn btn-primary" onclick="saveProfileName()">Сохранить</button>
      </div>
      ${p.zodiacDate ? `<p class="input-hint">Дата рождения: ${escapeHtml(p.zodiacDate)}</p>` : '<p class="input-hint">Укажите дату в разделе «Нумерология»</p>'}
    </div>`}
