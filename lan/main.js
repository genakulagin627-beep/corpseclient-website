const { app, BrowserWindow, ipcMain, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const Store = require('electron-store');
const prot = require('./prot');
const { prepareInstance, DEFAULT_MANIFEST } = require('./download-manager');

let mainWindow = null;

const store = new Store({ name: 'launcher-config' });
const obfuscatorStore = new Store({ name: 'launcher-obfuscator' });

function getObfuscatorPrefs() {
  return obfuscatorStore.get('prefs', {
    proguardJar: '',
    lastIn: '',
    lastOut: '',
  });
}

function setObfuscatorPrefs(prefs) {
  obfuscatorStore.set('prefs', { ...getObfuscatorPrefs(), ...prefs });
}

/** PIN для входа во вкладку «Настройки» (можно переопределить env LAUNCHER_SETTINGS_PIN) */
const SETTINGS_PIN_BUF = Buffer.from(
  String(process.env.LAUNCHER_SETTINGS_PIN || 'nurl'),
  'utf8'
);

const PRODUCTION_API_BASE = 'https://corpseclient.onrender.com/api';
const SITE_HOME_URL = 'https://corpseclient.onrender.com/index.html#home';

const defaultConfig = {
  launcherApiBaseUrl: PRODUCTION_API_BASE,
  username: 'Player',
  subExpires: '',
  profileId: '',
  shaderPreset: 'aurora',
  versions: [
    {
      id: '1.16.5',
      title: 'Minecraft 1.16.5',
      tag: 'Legacy',
      active: false,
      cloudInstall: false,
      kind: 'exe',
      path: '',
      cardImage: 'assets/ikon/fon/1.16.5.png',
      integritySha256: '',
    },
    {
      id: '1.21.4',
      title: 'Minecraft 1.21.4 Fabric',
      tag: 'Cloud',
      active: true,
      cloudInstall: true,
      kind: 'exe',
      path: '',
      cardImage: 'assets/ikon/fon/1.21.4.png',
      integritySha256: '',
    },
  ],
};

let settingsUnlockUntil = 0;
const SETTINGS_UNLOCK_MS = 45 * 60 * 1000;

function getAuthToken() {
  return String(store.get('authToken') || '').trim();
}

function setAuthToken(token) {
  const safe = String(token || '').trim();
  if (safe) {
    store.set('authToken', safe);
  } else {
    store.delete('authToken');
  }
}

function getBridgeSecret() {
  let s = String(store.get('bridgeSecret') || '').trim();
  if (s && /^[a-f0-9]{64}$/i.test(s)) return s.toLowerCase();
  s = crypto.randomBytes(32).toString('hex');
  store.set('bridgeSecret', s);
  return s;
}

function normalizeApiBase(url) {
  let u = String(url || '').trim().replace(/\/+$/, '');
  if (!u) return PRODUCTION_API_BASE;
  if (!/\/api$/i.test(u)) u = `${u}/api`;
  return u;
}

function mergeVersions(savedVersions) {
  const defaultsById = Object.fromEntries(defaultConfig.versions.map((v) => [v.id, { ...v }]));
  const list =
    Array.isArray(savedVersions) && savedVersions.length ? savedVersions : defaultConfig.versions;
  const merged = list.map((saved) => {
    const def = defaultsById[saved?.id];
    if (!def) return { ...saved };
    return {
      ...def,
      ...saved,
      cloudInstall: !!def.cloudInstall,
      active: saved.active !== undefined ? !!saved.active : !!def.active,
      tag: def.tag || saved.tag,
      title: def.title || saved.title,
    };
  });
  for (const def of defaultConfig.versions) {
    if (!merged.some((v) => v.id === def.id)) merged.push({ ...def });
  }
  return merged;
}

function versionUsesCloudInstall(v) {
  return !!(v && v.cloudInstall);
}

function getConfig() {
  const raw = store.get('config');
  if (!raw || typeof raw !== 'object') {
    return { ...defaultConfig, versions: mergeVersions(null) };
  }
  const merged = {
    ...defaultConfig,
    ...raw,
    versions: mergeVersions(raw.versions),
  };
  const api = normalizeApiBase(merged.launcherApiBaseUrl);
  let needsSave = JSON.stringify(raw.versions || []) !== JSON.stringify(merged.versions);
  if (api !== merged.launcherApiBaseUrl) {
    merged.launcherApiBaseUrl = api;
    needsSave = true;
  }
  if (/localhost|127\.0\.0\.1/i.test(api) && !process.env.LAUNCHER_USE_LOCAL_API) {
    merged.launcherApiBaseUrl = PRODUCTION_API_BASE;
    needsSave = true;
  }
  if (needsSave) store.set('config', merged);
  return merged;
}

function isSettingsUnlocked() {
  return Date.now() < settingsUnlockUntil;
}

function getApiBaseUrl() {
  return normalizeApiBase(getConfig().launcherApiBaseUrl);
}

function mapApiError(status, data, fallback) {
  const code = data && data.error ? String(data.error) : '';
  if (status === 0 || code === 'network') return 'Нет связи с сервером CorpseClient. Открой сайт в браузере.';
  if (status === 401 || code === 'credentials') return 'Неверный email или пароль.';
  if (status === 403 && code === 'banned') return 'Аккаунт заблокирован.';
  if (status === 403 && code === 'no_subscription') return 'Нет активной подписки.';
  if (status === 409 || code === 'exists') return 'Этот email уже зарегистрирован.';
  if (status === 400 && code === 'invalid') return 'Проверь email, ник и пароль (мин. 6 символов).';
  if (code) return code;
  return fallback;
}

async function apiRequest(pathname, options = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${pathname}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: { error: 'network' },
      message: `Нет связи с сервером (${base}). Проверь интернет и что сайт открывается.`,
    };
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

function formatSubDate(iso) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function syncConfigFromLauncherProfile(profile) {
  if (!profile || !profile.user) return;
  const prev = getConfig();
  const next = {
    ...prev,
    username: profile.user.displayName || prev.username || 'Player',
    profileId: profile.user.email || prev.profileId || '',
    subExpires: formatSubDate(profile.subscription_until),
  };
  store.set('config', next);
}

async function getLauncherProfileByToken(token) {
  const authToken = String(token || '').trim();
  if (!authToken) {
    return { ok: false, error: 'Войди в аккаунт лаунчера.' };
  }
  const me = await apiRequest('/launcher/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!me.ok) {
    if (me.status === 401 || me.status === 403) {
      setAuthToken('');
      const msg =
        me.data?.error === 'banned'
          ? 'Аккаунт заблокирован.'
          : 'Сессия истекла. Войди снова.';
      return { ok: false, error: msg };
    }
    if (me.status === 0) {
      return { ok: false, error: 'Нет связи с сервером CorpseClient.' };
    }
    return { ok: false, error: mapApiError(me.status, me.data, 'Не удалось проверить подписку.') };
  }
  syncConfigFromLauncherProfile(me.data);
  return {
    ok: true,
    user: me.data.user,
    hasSubscription: !!me.data.has_subscription,
    subscriptionUntil: me.data.subscription_until || null,
  };
}

function buildLaunchSession(access, entry) {
  const now = new Date();
  return {
    schema: 'inprotect.launch.session.v1',
    nonce: crypto.randomBytes(16).toString('hex'),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    launcherVersion: app.getVersion(),
    launcherPid: process.pid,
    hostUser: os.userInfo().username,
    clientVersionId: String(entry?.id || ''),
    hasSubscription: !!access?.hasSubscription,
    subscriptionUntil: access?.subscriptionUntil || null,
    user: {
      uid: access?.user?.uid ?? null,
      email: access?.user?.email || '',
      displayName: access?.user?.displayName || 'Player',
      role: access?.user?.role || 'user',
    },
  };
}

function writeLaunchSessionFiles(entry, sessionPayload) {
  const rawPath = String(entry.path || '').trim();
  const clientDir = fs.existsSync(rawPath) && fs.statSync(rawPath).isDirectory()
    ? rawPath
    : path.dirname(rawPath);
  const jsonPath = path.join(clientDir, 'inprotect-session.json');
  const sigPath = path.join(clientDir, 'inprotect-session.sig');
  const jsonRaw = JSON.stringify(sessionPayload, null, 2);
  const signature = crypto.createHmac('sha256', getBridgeSecret()).update(jsonRaw, 'utf8').digest('hex');
  fs.writeFileSync(jsonPath, jsonRaw, 'utf8');
  fs.writeFileSync(sigPath, signature, 'utf8');
  return { jsonPath, sigPath, signature };
}

function checkSettingsPin(input) {
  const a = Buffer.from(String(input ?? ''), 'utf8');
  const b = SETTINGS_PIN_BUF;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function appIconPath() {
  const p = path.join(__dirname, 'assets', 'verses.png');
  return fs.existsSync(p) ? p : null;
}

function createWindow() {
  const iconPath = appIconPath();
  const win = new BrowserWindow({
    width: 920,
    height: 620,
    minWidth: 800,
    minHeight: 520,
    frame: false,
    backgroundColor: '#121212',
    show: false,
    roundedCorners: true,
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  mainWindow = win;

  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-close', () => win.close());
}

function sendDownloadProgress(patch) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', patch);
  }
}

async function fetchLauncherManifest() {
  const token = getAuthToken();
  if (!token) return { ...DEFAULT_MANIFEST };
  const res = await apiRequest('/launcher/manifest', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok && res.data) {
    return {
      minecraftPackUrl: res.data.minecraftPackUrl || DEFAULT_MANIFEST.minecraftPackUrl,
      modJarUrl: res.data.modJarUrl || DEFAULT_MANIFEST.modJarUrl,
    };
  }
  return { ...DEFAULT_MANIFEST };
}

async function launchPrepared(prepared, access, entry) {
  const launchPath = prepared.launchPath;
  if (entry.integritySha256 && String(entry.integritySha256).trim()) {
    const gate = await prot.assertLaunchAllowed({ ...entry, path: launchPath });
    if (!gate.ok) {
      return { ok: false, error: gate.error || 'Прот: запуск отклонён.', code: gate.code };
    }
  }

  try {
    const session = buildLaunchSession(access, { ...entry, path: launchPath });
    const sessionFiles = writeLaunchSessionFiles(
      { path: launchPath, id: entry.id },
      session
    );
    const launchArgs = ['--inprotect-session', sessionFiles.jsonPath];
    const launchEnv = {
      ...process.env,
      INPROTECT_SESSION_PATH: sessionFiles.jsonPath,
      INPROTECT_SESSION_SIG_PATH: sessionFiles.sigPath,
      INPROTECT_BRIDGE_SECRET: getBridgeSecret(),
      INPROTECT_UID: String(session.user.uid ?? ''),
      INPROTECT_NICK: String(session.user.displayName || ''),
      INPROTECT_EMAIL: String(session.user.email || ''),
      INPROTECT_ROLE: String(session.user.role || ''),
      INPROTECT_HAS_SUB: session.hasSubscription ? '1' : '0',
      INPROTECT_SUB_UNTIL: String(session.subscriptionUntil || ''),
    };
    const cwd = prepared.installDir;

    if (prepared.launchKind === 'jar') {
      const child = spawn('java', ['-jar', launchPath, ...launchArgs], {
        detached: true,
        stdio: 'ignore',
        cwd,
        env: launchEnv,
      });
      child.unref();
    } else if (prepared.launchKind === 'bat') {
      const child = spawn('cmd.exe', ['/c', launchPath, ...launchArgs], {
        detached: true,
        stdio: 'ignore',
        cwd,
        env: launchEnv,
      });
      child.unref();
    } else {
      const child = spawn(launchPath, launchArgs, {
        detached: true,
        stdio: 'ignore',
        cwd,
        env: launchEnv,
      });
      child.unref();
    }
    return { ok: true, sessionPath: sessionFiles.jsonPath, installDir: prepared.installDir };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function launchClient(entry, access) {
  if (!entry || !entry.path) {
    return { ok: false, error: 'Путь не задан. Откройте настройки.' };
  }
  const p = entry.path.trim();
  if (!p) return { ok: false, error: 'Путь не задан.' };

  const gate = await prot.assertLaunchAllowed(entry);
  if (!gate.ok) {
    return { ok: false, error: gate.error || 'Прот: запуск отклонён.', code: gate.code };
  }

  try {
    const session = buildLaunchSession(access, entry);
    const sessionFiles = writeLaunchSessionFiles(entry, session);
    const launchArgs = ['--inprotect-session', sessionFiles.jsonPath];
    const launchEnv = {
      ...process.env,
      INPROTECT_SESSION_PATH: sessionFiles.jsonPath,
      INPROTECT_SESSION_SIG_PATH: sessionFiles.sigPath,
      INPROTECT_BRIDGE_SECRET: getBridgeSecret(),
      INPROTECT_UID: String(session.user.uid ?? ''),
      INPROTECT_NICK: String(session.user.displayName || ''),
      INPROTECT_EMAIL: String(session.user.email || ''),
      INPROTECT_ROLE: String(session.user.role || ''),
      INPROTECT_HAS_SUB: session.hasSubscription ? '1' : '0',
      INPROTECT_SUB_UNTIL: String(session.subscriptionUntil || ''),
    };

    if (entry.kind === 'jar') {
      const child = spawn('java', ['-jar', p, ...launchArgs], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(p),
        env: launchEnv,
      });
      child.unref();
    } else {
      const child = spawn(p, launchArgs, {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(p),
        env: launchEnv,
      });
      child.unref();
    }
    return { ok: true, sessionPath: sessionFiles.jsonPath };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('config-get', () => getConfig());

  ipcMain.handle('settings-gate-status', () => ({
    unlocked: isSettingsUnlocked(),
  }));

  ipcMain.handle('settings-gate-unlock', (_e, pin) => {
    if (!checkSettingsPin(pin)) {
      return { ok: false, error: 'Неверный PIN.' };
    }
    settingsUnlockUntil = Date.now() + SETTINGS_UNLOCK_MS;
    return { ok: true };
  });

  ipcMain.handle('settings-gate-lock', () => {
    settingsUnlockUntil = 0;
    return true;
  });

  ipcMain.handle('config-save', (_e, incoming) => {
    if (!isSettingsUnlocked()) {
      return { ok: false, error: 'Настройки заблокированы. Введи PIN.' };
    }
    const prev = getConfig();
    const next = { ...prev, ...incoming };
    store.set('config', next);
    return { ok: true };
  });

  ipcMain.handle('launch', async (_e, versionId) => {
    const access = await getLauncherProfileByToken(getAuthToken());
    if (!access.ok) {
      return { ok: false, error: access.error };
    }
    if (!access.hasSubscription) {
      return { ok: false, error: 'Подписка не активна. Запуск недоступен.' };
    }
    const cfg = getConfig();
    const v = cfg.versions?.find((x) => x.id === versionId);
    if (!v) return { ok: false, error: 'Версия не найдена.' };

    if (versionUsesCloudInstall(v)) {
      try {
        const manifest = await fetchLauncherManifest();
        const prepared = await prepareInstance(manifest, sendDownloadProgress, {
          authToken: getAuthToken(),
        });
        return launchPrepared(prepared, access, v);
      } catch (e) {
        sendDownloadProgress({ phase: 'Ошибка', received: 0, total: 0, percent: 0 });
        return { ok: false, error: String(e.message || e) };
      }
    }

    return launchClient(v, access);
  });

  ipcMain.handle('auth-login', async (_e, payload) => {
    const email = String(payload?.email || '').trim();
    const password = String(payload?.password || '');
    if (!email || !password) {
      return { ok: false, error: 'Введи email и пароль.' };
    }
    const login = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok || !login.data?.token) {
      return { ok: false, error: mapApiError(login.status, login.data, 'Ошибка входа.') };
    }
    setAuthToken(login.data.token);
    return getLauncherProfileByToken(login.data.token);
  });

  ipcMain.handle('auth-register', async (_e, payload) => {
    const nickname = String(payload?.nickname || '').trim();
    const email = String(payload?.email || '').trim();
    const password = String(payload?.password || '');
    if (!nickname || !email || password.length < 6) {
      return { ok: false, error: 'Нужны ник, email и пароль от 6 символов.' };
    }
    const reg = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nickname, email, password }),
    });
    if (!reg.ok || !reg.data?.token) {
      return { ok: false, error: mapApiError(reg.status, reg.data, 'Ошибка регистрации.') };
    }
    setAuthToken(reg.data.token);
    return getLauncherProfileByToken(reg.data.token);
  });

  ipcMain.handle('auth-status', async () => {
    const token = getAuthToken();
    if (!token) {
      return { ok: false, error: 'Не авторизован.' };
    }
    return getLauncherProfileByToken(token);
  });

  ipcMain.handle('auth-logout', () => {
    setAuthToken('');
    return { ok: true };
  });

  ipcMain.handle('open-site', () => {
    shell.openExternal(SITE_HOME_URL);
    return true;
  });

  ipcMain.handle('get-site-url', () => SITE_HOME_URL);

  ipcMain.handle('get-api-base', () => getApiBaseUrl());

  ipcMain.handle('prot-info', () => prot.getProtInfo());

  ipcMain.handle('obfuscator-get-prefs', () => getObfuscatorPrefs());

  ipcMain.handle('obfuscator-save-prefs', (_e, prefs) => {
    setObfuscatorPrefs(prefs || {});
    return true;
  });

  ipcMain.handle('obfuscate-run', (_e, payload) => {
    const { runObfuscate } = require('./obfuscator/engine');
    const inJar = String(payload?.inJar || '').trim();
    const outJar = String(payload?.outJar || '').trim();
    const proguardJar = String(payload?.proguardJar || '').trim();
    if (!inJar || !outJar) {
      return { ok: false, log: '', error: 'Укажи входной и выходной JAR.' };
    }
    return runObfuscate({
      inJar,
      outJar,
      proguardJar: proguardJar || undefined,
    });
  });

  ipcMain.handle('dialog-pick-jar-open', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
      title: 'Выбери JAR',
      filters: [{ name: 'JAR', extensions: ['jar'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.length) return null;
    return filePaths[0];
  });

  ipcMain.handle('dialog-pick-proguard', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
      title: 'Выбери proguard.jar',
      filters: [{ name: 'JAR', extensions: ['jar'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.length) return null;
    return filePaths[0];
  });

  ipcMain.handle('dialog-save-jar', async (_e, defaultName) => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win || undefined, {
      title: 'Куда сохранить обфусцированный JAR',
      defaultPath: defaultName || 'client-obf.jar',
      filters: [{ name: 'JAR', extensions: ['jar'] }],
    });
    if (canceled || !filePath) return null;
    return filePath;
  });

  ipcMain.handle('prot-compute-hash', async (_e, filePath) => {
    const raw = String(filePath || '').trim();
    if (!raw) return { ok: false, error: 'Укажи путь к файлу.' };
    let full;
    try {
      full = path.normalize(raw);
    } catch {
      return { ok: false, error: 'Некорректный путь.' };
    }
    if (!fs.existsSync(full)) return { ok: false, error: 'Файл не найден.' };
    const st = fs.statSync(full);
    if (!st.isFile()) return { ok: false, error: 'Это не файл.' };
    try {
      const sha256 = await prot.sha256File(full);
      return { ok: true, sha256 };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
