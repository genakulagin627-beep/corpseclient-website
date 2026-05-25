let config = null;

function versionUsesCloudInstall(v) {
  return !!(v && v.cloudInstall);
}
let authState = null;

function $(id) {
  return document.getElementById(id);
}

function showLoader(title, sub) {
  const el = $('app-loader');
  if (!el) return;
  const t = $('app-loader-title');
  const s = $('app-loader-sub');
  if (t) t.textContent = title || 'Загрузка…';
  if (s) s.textContent = sub || 'Подготавливаем интерфейс';
  el.classList.remove('is-hidden');
  el.setAttribute('aria-busy', 'true');
}

function hideLoader() {
  const el = $('app-loader');
  if (!el) return;
  el.classList.add('is-hidden');
  el.setAttribute('aria-busy', 'false');
}

function showDownloadOverlay(show) {
  const el = $('download-overlay');
  if (!el) return;
  el.classList.toggle('hidden', !show);
  el.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function updateDownloadProgress(p) {
  if (!p) return;
  const phase = $('dl-phase');
  const stats = $('dl-stats');
  const fill = $('dl-bar-fill');
  if (phase) phase.textContent = p.phase || 'Загрузка…';
  const rec = p.received || 0;
  const tot = p.total || 0;
  if (stats) {
    if (tot > 0 && p.percent >= 0) {
      stats.textContent = `${formatDlBytes(rec)} / ${formatDlBytes(tot)} (${p.percent}%)`;
    } else {
      stats.textContent = formatDlBytes(rec);
    }
  }
  if (fill) {
    const w = p.percent >= 0 ? Math.min(100, p.percent) : tot ? Math.min(100, Math.round((rec / tot) * 100)) : 8;
    fill.style.width = `${w}%`;
  }
}

function formatDlBytes(n) {
  if (!n || n < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

async function withLoader(title, sub, fn) {
  showLoader(title, sub);
  try {
    return await fn();
  } finally {
    hideLoader();
  }
}

function showToast(message, isError) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function formatSubLine(expires) {
  if (!expires || !String(expires).trim()) return 'Подписка: не указана';
  return `Истекает: ${expires}`;
}

function formatSubscriptionStatus(auth) {
  if (!auth) return 'Войди, чтобы проверить подписку.';
  if (!auth.ok) return auth.error || 'Нет активной сессии.';
  const until = auth.subscriptionUntil ? `до ${new Date(auth.subscriptionUntil).toLocaleString('ru-RU')}` : 'дата не указана';
  return auth.hasSubscription ? `Подписка активна (${until})` : 'Подписка не активна.';
}

function setAuthGateOpen(isOpen) {
  const gate = $('auth-gate');
  if (!gate) return;
  gate.classList.toggle('hidden', !isOpen);
}

function setAuthGateStatus(text) {
  const el = $('auth-gate-status');
  if (el) el.textContent = text;
}

function switchAuthTab(tab) {
  const loginForm = $('auth-login-form');
  const regForm = $('auth-register-form');
  const btnLogin = $('auth-tab-login');
  const btnReg = $('auth-tab-register');
  const isLogin = tab !== 'register';
  loginForm?.classList.toggle('hidden', !isLogin);
  regForm?.classList.toggle('hidden', isLogin);
  btnLogin?.classList.toggle('active', isLogin);
  btnReg?.classList.toggle('active', !isLogin);
}

function applyHeader() {
  const user = authState && authState.ok ? authState.user || null : null;
  $('hdr-username').textContent = (user && user.displayName) || config.username || 'Player';
  const subIso = authState && authState.ok ? authState.subscriptionUntil : null;
  if (subIso) {
    try {
      const d = new Date(subIso);
      const pad = (n) => String(n).padStart(2, '0');
      $('hdr-sub').textContent = `Подписка до ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    } catch (_) {
      $('hdr-sub').textContent = formatSubLine(config.subExpires);
    }
  } else {
    $('hdr-sub').textContent = formatSubLine(config.subExpires);
  }
  $('hdr-profile').textContent = (user && user.email) || config.profileId || '—';
  const av = $('avatar');
  av.style.backgroundImage = 'url("assets/verses.png")';
  av.style.backgroundSize = 'cover';
  av.style.backgroundPosition = 'center';
  applySubStatusBadge();
}

function applySubStatusBadge() {
  const el = $('hdr-sub-status');
  if (!el) return;
  if (!authState || !authState.ok) {
    el.textContent = '';
    el.className = 'sub-status-line';
    return;
  }
  const active = !!authState.hasSubscription;
  el.textContent = active ? '● Подписка активна — можно запускать клиент' : '● Подписка не активна — купи на сайте';
  el.className = 'sub-status-line ' + (active ? 'sub-status-line--ok' : 'sub-status-line--bad');
}

function applyAuthStatus() {
  const user = authState && authState.ok ? authState.user || null : null;
  if (user) {
    setAuthGateStatus(`Аккаунт: ${user.displayName || 'Player'} (${user.email || '—'}). ${formatSubscriptionStatus(authState)}`);
    return;
  }
  setAuthGateStatus('Сначала войди в аккаунт сайта, потом откроется лоудер.');
}

async function refreshAuthState(showMessage = false) {
  authState = await window.launcher.authStatus();
  config = await window.launcher.getConfig();
  applyHeader();
  applyAuthStatus();
  renderCards();
  setAuthGateOpen(!authState.ok);
  if (showMessage) {
    if (authState.ok) showToast(authState.hasSubscription ? 'Подписка активна' : 'Подписка не активна', !authState.hasSubscription);
    else showToast(authState.error || 'Не авторизован', true);
  }
}

async function doAuthLogin() {
  const email = $('auth-email')?.value?.trim() || '';
  const password = $('auth-password')?.value || '';
  const res = await withLoader('Вход…', 'Проверяем аккаунт и подписку.', () => window.launcher.authLogin(email, password));
  authState = res;
  config = await window.launcher.getConfig();
  applyHeader();
  applyAuthStatus();
  if (res.ok) {
    showToast(res.hasSubscription ? 'Вход выполнен. Доступ открыт.' : 'Вход выполнен, но подписка не активна.', !res.hasSubscription);
    const p = $('auth-password');
    if (p) p.value = '';
    setAuthGateOpen(false);
    renderCards();
    return;
  }
  showToast(res.error || 'Ошибка входа', true);
  setAuthGateOpen(true);
}

async function doAuthLogout() {
  await window.launcher.authLogout();
  authState = null;
  applyAuthStatus();
  setAuthGateOpen(true);
  showToast('Выход выполнен');
}

async function doAuthRegister() {
  const nickname = $('auth-reg-nickname')?.value?.trim() || '';
  const email = $('auth-reg-email')?.value?.trim() || '';
  const password = $('auth-reg-password')?.value || '';
  const res = await withLoader('Регистрация…', 'Создаем аккаунт и проверяем подписку.', () =>
    window.launcher.authRegister(nickname, email, password)
  );
  authState = res;
  config = await window.launcher.getConfig();
  applyHeader();
  applyAuthStatus();
  if (res.ok) {
    setAuthGateOpen(false);
    renderCards();
    showToast(res.hasSubscription ? 'Регистрация успешна. Доступ открыт.' : 'Регистрация успешна. Нужна подписка для запуска.', !res.hasSubscription);
    const p = $('auth-reg-password');
    if (p) p.value = '';
    return;
  }
  showToast(res.error || 'Ошибка регистрации', true);
  setAuthGateOpen(true);
}

function applyShaderPreset(id) {
  const preset = id && window.ShaderBg ? id : 'aurora';
  if (window.ShaderBg && typeof window.ShaderBg.setPreset === 'function') {
    window.ShaderBg.setPreset(preset);
  }
}

function toFileUrl(localPath) {
  let p = localPath.trim().replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(p)) return `url("file:///${p}")`;
  if (p.startsWith('/')) return `url("file://${p}")`;
  return `url("file:///${p}")`;
}

/** Относительные пути (assets/...) — как в CSS; абсолютные — file:// */
function cardBackgroundUrl(imagePath) {
  const raw = String(imagePath || '').trim();
  if (!raw) return null;
  const norm = raw.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(norm) || norm.startsWith('/')) {
    return toFileUrl(raw);
  }
  return `url("${encodeURI(norm)}")`;
}

function cardBackgroundStyle(v) {
  if (v.cardImage && String(v.cardImage).trim()) {
    return cardBackgroundUrl(v.cardImage);
  }
  return null;
}

function renderCards() {
  const root = $('version-cards');
  root.innerHTML = '';
  const list = config.versions || [];

  list.forEach((v) => {
    const el = document.createElement('div');
    const isActive = !!v.active;
    el.className = 'version-card' + (isActive ? '' : ' inactive');
    const bg = cardBackgroundStyle(v);
    if (bg) el.style.setProperty('--card-bg-img', bg);

    el.innerHTML = `
      <div class="version-card-body">
        <div class="version-titles">
          <h2>${escapeHtml(v.title || v.id)}</h2>
          <div class="tag">${escapeHtml(v.tag || 'Stable')}</div>
        </div>
        <button type="button" class="play-btn" data-version="${escapeAttr(v.id)}" title="Запуск" aria-label="Play">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    `;
    root.appendChild(el);
  });

  const canPlay = authState && authState.ok && authState.hasSubscription;
  root.querySelectorAll('.play-btn').forEach((btn) => {
    btn.disabled = !canPlay;
    btn.title = canPlay ? 'Запуск' : 'Нужна активная подписка';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!canPlay) {
        showToast('Нет активной подписки. Оформи на сайте.', true);
        return;
      }
      const id = btn.getAttribute('data-version');
      const v = (config.versions || []).find((x) => x.id === id);
      if (v && versionUsesCloudInstall(v)) {
        showDownloadOverlay(true);
        hideLoader();
        try {
          const res = await window.launcher.launch(id);
          if (res.ok) showToast('Клиент запущен');
          else showToast(res.error || 'Ошибка запуска', true);
        } finally {
          showDownloadOverlay(false);
        }
        return;
      }
      const res = await withLoader('Запуск…', 'Проверяем подписку и открываем клиент.', () => window.launcher.launch(id));
      if (res.ok) showToast('Клиент запущен');
      else showToast(res.error || 'Ошибка запуска', true);
    });
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

const SHADER_OPTIONS = [
  { id: 'off', label: 'Выкл. (тёмный фон)' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'plasma', label: 'Plasma' },
  { id: 'silk', label: 'Silk' },
  { id: 'chroma', label: 'Chroma' },
  { id: 'noise', label: 'Noise' },
];

function renderSettingsForm() {
  const form = $('settings-form');
  form.innerHTML = '';

  const look = document.createElement('div');
  look.className = 'setting-block';
  look.innerHTML = `
    <h3>Оформление</h3>
    <p class="hint">Фоновый эффект (WebGL).</p>
    <div class="field-row">
      <label for="in-shader">Шейдер / пресет</label>
      <select id="in-shader">
        ${SHADER_OPTIONS.map(
          (o) =>
            `<option value="${escapeAttr(o.id)}" ${(config.shaderPreset || 'aurora') === o.id ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
        ).join('')}
      </select>
    </div>
  `;
  form.appendChild(look);
  const shEl = $('in-shader');
  if (shEl) {
    shEl.addEventListener('change', (e) => applyShaderPreset(e.target.value));
  }

  const profile = document.createElement('div');
  profile.className = 'setting-block';
  profile.innerHTML = `
    <h3>Профиль</h3>
    <div class="field-row">
      <label for="in-user">Отображаемое имя</label>
      <input type="text" id="in-user" value="${escapeAttr(config.username || '')}" />
    </div>
    <div class="field-row">
      <label for="in-sub">Дата окончания (например 21.04.2026)</label>
      <input type="text" id="in-sub" value="${escapeAttr(config.subExpires || '')}" />
    </div>
    <div class="field-row">
      <label for="in-prof">Второй ярлык (профиль)</label>
      <input type="text" id="in-prof" value="${escapeAttr(config.profileId || '')}" />
    </div>
  `;
  form.appendChild(profile);

  const vers = config.versions || [];
  const hasAccent = vers.some((x) => x.active);
  vers.forEach((v, i) => {
    const block = document.createElement('div');
    block.className = 'setting-block';
    block.dataset.versionId = v.id;
    const checked = v.active || (!hasAccent && i === 0);
    const cloud = versionUsesCloudInstall(v);
    block.innerHTML = `
      <h3>${escapeHtml(v.title || v.id)}</h3>
      ${
        cloud
          ? `<p class="hint">Облачный запуск: сборка и мод скачиваются автоматически при Play. Путь вручную не нужен.</p>`
          : ''
      }
      <div class="field-row ${cloud ? 'hidden' : ''}">
        <label>Тип запуска</label>
        <select class="in-kind">
          <option value="exe" ${v.kind !== 'jar' ? 'selected' : ''}>EXE (файл клиента)</option>
          <option value="jar" ${v.kind === 'jar' ? 'selected' : ''}>JAR (java -jar)</option>
        </select>
      </div>
      <div class="field-row ${cloud ? 'hidden' : ''}">
        <label>Полный путь к файлу</label>
        <input type="text" class="in-path" value="${escapeAttr(v.path || '')}" placeholder="C:\\Games\\client.exe" />
      </div>
      <div class="field-row">
        <label>Фон карточки (путь к картинке, опционально)</label>
        <input type="text" class="in-img" value="${escapeAttr(v.cardImage || '')}" placeholder="C:\\img\\bg.png" />
      </div>
      <div class="field-row">
        <label>Защита: SHA-256 клиента (если пусто — не проверяется)</label>
        <input type="text" class="in-sha" value="${escapeAttr(v.integritySha256 || '')}" placeholder="64 символа hex" spellcheck="false" />
      </div>
      <div class="pin-actions">
        <button type="button" class="btn secondary btn-hash" data-version="${escapeAttr(v.id)}">Вычислить SHA-256 по пути</button>
      </div>
      <div class="field-row">
        <label>
          <input type="radio" name="card-accent" class="in-active" value="${escapeAttr(v.id)}" ${checked ? 'checked' : ''} />
          Главная карточка (остальные приглушены)
        </label>
      </div>
    `;
    form.appendChild(block);
  });

  form.querySelectorAll('.btn-hash').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const vid = btn.getAttribute('data-version');
      const block = Array.from(form.querySelectorAll('.setting-block[data-version-id]')).find(
        (el) => el.dataset.versionId === vid
      );
      const pathIn = block?.querySelector('.in-path');
      const shaIn = block?.querySelector('.in-sha');
      const p = pathIn?.value?.trim();
      if (!p) {
        showToast('Сначала укажи путь к клиенту', true);
        return;
      }
      showToast('Считаю SHA-256…');
      const res = await withLoader('Проверка файла…', 'Считаю SHA-256, это может занять пару секунд.', () =>
        window.launcher.protComputeHash(p)
      );
      if (res.ok && shaIn) {
        shaIn.value = res.sha256;
        showToast('SHA-256 подставлен — сохрани настройки');
      } else {
        showToast(res.error || 'Ошибка хеша', true);
      }
    });
  });
}

function collectSettingsFromForm() {
  const next = { ...config };
  const sh = $('in-shader');
  if (sh) next.shaderPreset = sh.value;

  const u = $('in-user');
  const s = $('in-sub');
  const p = $('in-prof');
  if (u) next.username = u.value.trim() || 'Player';
  if (s) next.subExpires = s.value.trim();
  if (p) next.profileId = p.value.trim();

  const blocks = $('settings-form').querySelectorAll('.setting-block[data-version-id]');
  const accent = $('settings-form').querySelector('input[name="card-accent"]:checked');
  const accentId = accent ? accent.value : null;
  const versions = [];
  blocks.forEach((block) => {
    const id = block.dataset.versionId;
    const orig = (config.versions || []).find((x) => x.id === id) || {};
    const cloud = versionUsesCloudInstall(orig);
    const kindEl = block.querySelector('.in-kind');
    const pathEl = block.querySelector('.in-path');
    versions.push({
      ...orig,
      id,
      cloudInstall: orig.cloudInstall ?? cloud,
      kind: kindEl && kindEl.value === 'jar' ? 'jar' : orig.kind || 'exe',
      path: pathEl ? pathEl.value.trim() : orig.path || '',
      cardImage: block.querySelector('.in-img').value.trim(),
      integritySha256: (block.querySelector('.in-sha')?.value || '').trim(),
      active: accentId === id,
    });
  });
  next.versions = versions;

  return next;
}

async function updateSettingsShell() {
  const st = await window.launcher.settingsGateStatus();
  const gate = $('settings-gate');
  const inner = $('settings-inner');
  const sub = $('settings-sub');
  const pinIn = $('settings-pin-input');

  if (st.unlocked) {
    gate.classList.add('hidden');
    inner.classList.remove('hidden');
    if (sub) sub.textContent = 'Пути к клиенту, профиль, оформление';
    renderSettingsForm();
  } else {
    inner.classList.add('hidden');
    gate.classList.remove('hidden');
    if (sub) sub.textContent = 'Вход только по PIN';
    if (pinIn) {
      pinIn.value = '';
      pinIn.focus();
    }
  }
}

async function trySettingsUnlock() {
  const pinIn = $('settings-pin-input');
  const pin = pinIn ? pinIn.value : '';
  const res = await window.launcher.settingsGateUnlock(pin);
  if (res.ok) {
    showToast('Добро пожаловать');
    await updateSettingsShell();
  } else {
    showToast(res.error || 'Ошибка', true);
    if (pinIn) pinIn.select();
  }
}

async function loadObfuscatorPrefs() {
  try {
    const p = await window.launcher.obfuscatorGetPrefs();
    const a = $('obf-in');
    const b = $('obf-out');
    const c = $('obf-pg');
    if (a) a.value = p.lastIn || '';
    if (b) b.value = p.lastOut || '';
    if (c) c.value = p.proguardJar || '';
  } catch (_) {}
}

async function saveObfuscatorPrefs() {
  try {
    await window.launcher.obfuscatorSavePrefs({
      lastIn: $('obf-in')?.value?.trim() || '',
      lastOut: $('obf-out')?.value?.trim() || '',
      proguardJar: $('obf-pg')?.value?.trim() || '',
    });
  } catch (_) {}
}

function switchView(name) {
  const home = $('view-home');
  const settings = $('view-settings');
  const obf = $('view-obfuscator');
  document.querySelectorAll('.nav-btn[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  home.classList.toggle('hidden', name !== 'home');
  settings.classList.toggle('hidden', name !== 'settings');
  if (obf) obf.classList.toggle('hidden', name !== 'obfuscator');
  if (name === 'settings') {
    updateSettingsShell();
  }
  if (name === 'obfuscator') {
    loadObfuscatorPrefs();
  }
}

async function init() {
  showLoader('Загрузка…', 'Подключаемся к лаунчеру и читаем настройки');
  config = await window.launcher.getConfig();
  applyHeader();
  await refreshAuthState(false);
  renderCards();

  try {
    const pi = await window.launcher.protInfo();
    const el = $('prot-badge');
    if (el && pi) {
      el.textContent = `Прот v${pi.version} · путь, тип файла, опционально SHA-256`;
    }
  } catch (_) {}

  const canvas = $('shader-bg');
  if (window.ShaderBg && canvas) {
    window.ShaderBg.init(canvas, config.shaderPreset || 'aurora');
  }

  document.getElementById('win-min').addEventListener('click', () => window.launcher.minimize());
  document.getElementById('win-close').addEventListener('click', () => window.launcher.close());

  document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btn-exit').addEventListener('click', () => window.launcher.close());

  if (window.launcher.onDownloadProgress) {
    window.launcher.onDownloadProgress(updateDownloadProgress);
  }
  document.getElementById('btn-auth-login').addEventListener('click', () => doAuthLogin());
  document.getElementById('btn-auth-register').addEventListener('click', () => doAuthRegister());
  document.getElementById('btn-auth-logout')?.addEventListener('click', () => doAuthLogout());
  document.getElementById('btn-refresh-sub')?.addEventListener('click', () => refreshAuthState(true));
  const openSite = () => window.launcher.openSite();
  document.getElementById('btn-open-site')?.addEventListener('click', openSite);
  document.getElementById('btn-open-site-main')?.addEventListener('click', openSite);

  try {
    const api = await window.launcher.getApiBase();
    const hint = $('auth-api-hint');
    if (hint && api) hint.textContent = `Сервер: ${api}`;
  } catch (_) {}
  document.getElementById('auth-tab-login').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('auth-tab-register').addEventListener('click', () => switchAuthTab('register'));
  const authPass = $('auth-password');
  if (authPass) {
    authPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAuthLogin();
    });
  }
  const regPass = $('auth-reg-password');
  if (regPass) {
    regPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAuthRegister();
    });
  }

  document.getElementById('btn-settings-pin-enter').addEventListener('click', () => trySettingsUnlock());
  const pinInput = $('settings-pin-input');
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') trySettingsUnlock();
    });
  }

  document.getElementById('btn-settings-lock').addEventListener('click', async () => {
    await window.launcher.settingsGateLock();
    showToast('Настройки заблокированы');
    await updateSettingsShell();
  });

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const next = collectSettingsFromForm();
    const res = await withLoader('Сохранение…', 'Записываем конфиг и обновляем интерфейс.', () => window.launcher.saveConfig(next));
    if (res && res.ok === false) {
      showToast(res.error || 'Сохранение недоступно', true);
      await updateSettingsShell();
      return;
    }
    config = await window.launcher.getConfig();
    applyHeader();
    applyShaderPreset(config.shaderPreset);
    renderCards();
    showToast('Сохранено');
    switchView('home');
  });

  const obfLog = $('obf-log');
  $('obf-pick-in')?.addEventListener('click', async () => {
    const fp = await window.launcher.dialogPickJarOpen();
    if (fp && $('obf-in')) {
      $('obf-in').value = fp;
      await saveObfuscatorPrefs();
    }
  });
  $('obf-pick-out')?.addEventListener('click', async () => {
    const def = $('obf-in')?.value?.trim();
    let suggest = 'client-obf.jar';
    if (def && def.toLowerCase().endsWith('.jar')) {
      suggest = def.replace(/\.jar$/i, '-obf.jar');
    }
    const fp = await window.launcher.dialogSaveJar(suggest);
    if (fp && $('obf-out')) {
      $('obf-out').value = fp;
      await saveObfuscatorPrefs();
    }
  });
  $('obf-pick-pg')?.addEventListener('click', async () => {
    const fp = await window.launcher.dialogPickProguard();
    if (fp && $('obf-pg')) {
      $('obf-pg').value = fp;
      await saveObfuscatorPrefs();
    }
  });
  ['obf-in', 'obf-out', 'obf-pg'].forEach((id) => {
    $(id)?.addEventListener('change', () => saveObfuscatorPrefs());
  });
  $('obf-run')?.addEventListener('click', async () => {
    await saveObfuscatorPrefs();
    const inJar = $('obf-in')?.value?.trim() || '';
    const outJar = $('obf-out')?.value?.trim() || '';
    const proguardJar = $('obf-pg')?.value?.trim() || '';
    if (obfLog) {
      obfLog.textContent = 'Запуск ProGuard…';
    }
    const res = await withLoader('Обфускация…', 'ProGuard работает. Это может занять немного времени.', () =>
      window.launcher.obfuscateRun({ inJar, outJar, proguardJar })
    );
    if (obfLog) {
      obfLog.textContent = (res.log || '') + (res.error ? '\n\nОшибка: ' + res.error : '');
    }
    if (res.ok) showToast('Обфускация завершена');
    else showToast(res.error || 'Ошибка обфускации', true);
  });

  hideLoader();
}

init().catch((e) => {
  hideLoader();
  showToast(e?.message || 'Ошибка инициализации', true);
});
