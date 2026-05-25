const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const {
  getInProtectPaths,
  resetDir,
  fileOk,
  dirHasContent,
  manifestFingerprint,
  readInstallState,
  writeInstallState,
  isInstallReady,
  MIN_JAR_BYTES,
  MIN_ZIP_BYTES,
} = require('./paths');
const {
  resolveWorkuploadDownloadUrl,
  isDirectDownloadUrl,
} = require('../lib/workupload');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const {
  DEFAULT_MC_PACK_URL,
  DEFAULT_MOD_JAR_URL,
  normalizeDownloadUrl,
} = require('../lib/download-url');

const DEFAULT_MANIFEST = {
  minecraftPackUrl: DEFAULT_MC_PACK_URL,
  modJarUrl: DEFAULT_MOD_JAR_URL,
};

function emitProgress(onProgress, patch) {
  if (typeof onProgress === 'function') onProgress(patch);
}

function fetchWithRedirects(url, maxRedirects = 12, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('too_many_redirects'));
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      parsed,
      {
        headers: {
          'User-Agent': UA,
          Accept: '*/*',
          Referer: 'https://workupload.com/',
          ...extraHeaders,
        },
      },
      (res) => {
        const code = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, parsed).href;
          const nextHeaders = { ...extraHeaders };
          if (new URL(next).host !== parsed.host) {
            delete nextHeaders.Authorization;
          }
          return resolve(fetchWithRedirects(next, maxRedirects - 1, nextHeaders));
        }
        resolve(res);
      }
    );
    req.on('error', reject);
    req.setTimeout(180000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function readJsonErrorBody(res) {
  const chunks = [];
  let total = 0;
  const text = await new Promise((resolve, reject) => {
    res.on('data', (c) => {
      total += c.length;
      if (total > 65536) {
        res.destroy();
        return reject(new Error('error_body_too_large'));
      }
      chunks.push(c);
    });
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  });
  try {
    const j = JSON.parse(text);
    return j.message || j.hint || j.error || text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

async function resolveWorkuploadUrl(pageUrl) {
  const { downloadUrl } = await resolveWorkuploadDownloadUrl(pageUrl);
  const res = await fetchWithRedirects(downloadUrl);
  return { res, finalUrl: downloadUrl };
}

function formatBytes(n) {
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

function downloadResponseToFile(res, destPath, label, onProgress) {
  return new Promise((resolve, reject) => {
    const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
    let done = 0;
    const file = fs.createWriteStream(destPath);
    res.on('data', (chunk) => {
      done += chunk.length;
      emitProgress(onProgress, {
        phase: label,
        received: done,
        total: total || done,
        percent: total ? Math.min(100, Math.round((done / total) * 100)) : -1,
      });
    });
    res.pipe(file);
    file.on('finish', () => file.close(() => resolve({ bytes: done, total })));
    file.on('error', (e) => {
      file.close();
      reject(e);
    });
    res.on('error', reject);
  });
}

async function downloadUrlToFile(sourceUrl, destPath, label, onProgress, opts = {}) {
  emitProgress(onProgress, { phase: label, received: 0, total: 0, percent: 0 });
  const headers = {};
  const token = String(opts.authToken || '').trim();
  if (token && /\/api\/launcher\/download-(pack|mod)/i.test(sourceUrl)) {
    headers.Authorization = `Bearer ${token}`;
  }
  let res;
  if (/workupload\.com\/file\//i.test(sourceUrl)) {
    const resolved = await resolveWorkuploadUrl(sourceUrl);
    res = resolved.res;
  } else if (isDirectDownloadUrl(sourceUrl)) {
    res = await fetchWithRedirects(sourceUrl, 12, headers);
  } else {
    res = await fetchWithRedirects(sourceUrl, 12, headers);
  }
  const code = res.statusCode || 0;
  if (code === 502 || code === 503) {
    const msg = await readJsonErrorBody(res);
    throw new Error(msg || `Сервер не отдал файл (${code})`);
  }
  if (code >= 400) {
    res.resume();
    throw new Error(`Ошибка загрузки (${code})`);
  }
  const ct = String(res.headers['content-type'] || '').toLowerCase();
  if (ct.includes('text/html') && !/\/api\/launcher\//i.test(sourceUrl)) {
    res.resume();
    throw new Error(
      'Получена HTML-страница вместо файла. Задай на Render прямые MC_PACK_URL / MOD_JAR_URL или залей файлы в uploads/game/.'
    );
  }
  return downloadResponseToFile(res, destPath, label, onProgress);
}

function extractZipWin(zipPath, destDir) {
  const ps = `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true }
    );
    let err = '';
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `Expand-Archive exit ${code}`));
    });
  });
}

function walkFiles(dir, depth = 0, maxDepth = 8) {
  if (depth > maxDepth || !fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walkFiles(full, depth + 1, maxDepth));
    else out.push(full);
  }
  return out;
}

function findLaunchExecutable(rootDir) {
  const files = walkFiles(rootDir);
  const jar =
    files.find((f) => /corpse.*\.jar$/i.test(f)) ||
    files.find((f) => /fabric.*\.jar$/i.test(f) && !/sources/i.test(f));
  if (jar) return { path: jar, kind: 'jar' };
  const priority = [/javaw\.exe$/i, /minecraft\.exe$/i, /fabric.*\.exe$/i, /\.exe$/i];
  for (const re of priority) {
    const hit = files.find((f) => re.test(f) && !/unins|setup|install|update/i.test(f));
    if (hit) return { path: hit, kind: 'exe' };
  }
  const bat = files.find((f) => /\.bat$/i.test(f) && /start|run|launch|play/i.test(f));
  if (bat) return { path: bat, kind: 'bat' };
  return null;
}

function findModsDir(rootDir) {
  function walkDirs(dir, depth) {
    if (depth > 8 || !fs.existsSync(dir)) return null;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      if (name.toLowerCase() === 'mods') return full;
      const inner = walkDirs(full, depth + 1);
      if (inner) return inner;
    }
    return null;
  }
  const found = walkDirs(rootDir, 0);
  if (found) return found;
  const guessed = path.join(rootDir, 'mods');
  fs.mkdirSync(guessed, { recursive: true });
  return guessed;
}

function syncJarCopies(paths) {
  const modInMods = path.join(paths.mods, 'corpse-1.0.0.jar');
  try {
    fs.copyFileSync(paths.clientJar, modInMods);
  } catch (_) {}
  try {
    const modsInGame = findModsDir(paths.game);
    fs.copyFileSync(paths.clientJar, path.join(modsInGame, 'corpse-1.0.0.jar'));
  } catch (_) {}
}

function buildLaunchResult(paths) {
  const modInMods = path.join(paths.mods, 'corpse-1.0.0.jar');
  let launchPath = paths.clientJar;
  let launchKind = 'jar';
  const alt = findLaunchExecutable(paths.game);
  if (!fileOk(launchPath, MIN_JAR_BYTES) && alt) {
    launchPath = alt.path;
    launchKind = alt.kind;
  }
  if (!fs.existsSync(launchPath)) {
    throw new Error(`Файл клиента не найден в ${paths.root}.`);
  }
  return {
    installDir: paths.root,
    gameDir: paths.game,
    launchPath,
    launchKind,
    clientJarPath: paths.clientJar,
    modPath: modInMods,
    packZipPath: paths.packZip,
    cached: true,
  };
}

function sniffPackFile(packPath) {
  const head = Buffer.alloc(256);
  const fd = fs.openSync(packPath, 'r');
  fs.readSync(fd, head, 0, 256, 0);
  fs.closeSync(fd);
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const sniff = head.slice(0, 120).toString('utf8').toLowerCase();
  const looksHtml =
    head[0] === 0x3c ||
    (head[0] === 0xef && head[1] === 0xbb) ||
    sniff.includes('<!doctype') ||
    sniff.includes('<html');
  return { isZip, looksHtml };
}

async function extractPackToGame(packZip, game, packUrl, onProgress) {
  const { isZip, looksHtml } = sniffPackFile(packZip);
  if (looksHtml) {
    throw new Error(
      'Скачана страница вместо zip. Проверь MC_PACK_URL на Render (Dropbox: dl=1).'
    );
  }
  if (isZip) {
    emitProgress(onProgress, {
      phase: 'Распаковка в C:\\InProtect\\game…',
      received: 0,
      total: 0,
      percent: -1,
    });
    await extractZipWin(packZip, game);
  } else {
    const ext = packUrl.toLowerCase().includes('.jar') ? '.jar' : '.exe';
    fs.copyFileSync(packZip, path.join(game, `client_pack${ext}`));
  }
}

async function prepareInstance(manifest, onProgress, opts = {}) {
  const paths = getInProtectPaths();
  const packUrl = normalizeDownloadUrl(
    String(manifest.minecraftPackUrl || DEFAULT_MANIFEST.minecraftPackUrl).trim()
  );
  const modUrl = normalizeDownloadUrl(
    String(manifest.modJarUrl || DEFAULT_MANIFEST.modJarUrl).trim()
  );
  const fingerprint = manifestFingerprint(packUrl, modUrl);
  const dlOpts = { authToken: opts.authToken };
  const force = !!opts.forceReinstall;
  const state = readInstallState(paths.root);

  if (!force && state?.fingerprint === fingerprint && isInstallReady(paths)) {
    emitProgress(onProgress, {
      phase: 'Уже установлено — запуск…',
      received: 1,
      total: 1,
      percent: 100,
    });
    syncJarCopies(paths);
    const result = buildLaunchResult(paths);
    result.cached = true;
    return result;
  }

  const needJar = force || !fileOk(paths.clientJar, MIN_JAR_BYTES);
  const needGame = force || !dirHasContent(paths.game);
  const needPackDownload = needGame && (force || !fileOk(paths.packZip, MIN_ZIP_BYTES));

  if (needJar) {
    emitProgress(onProgress, { phase: 'Скачивание мода (jar)…', received: 0, total: 0, percent: 0 });
    await downloadUrlToFile(modUrl, paths.clientJar, 'Скачивание corpse-1.0.0.jar…', onProgress, dlOpts);
  } else {
    emitProgress(onProgress, { phase: 'Мод уже на диске C:\\InProtect', received: 1, total: 1, percent: 100 });
  }
  syncJarCopies(paths);

  if (needPackDownload) {
    await downloadUrlToFile(packUrl, paths.packZip, 'Скачивание сборки Fabric…', onProgress, dlOpts);
  } else if (needGame && fileOk(paths.packZip, MIN_ZIP_BYTES)) {
    emitProgress(onProgress, { phase: 'Сборка уже скачана', received: 1, total: 1, percent: 100 });
  }

  if (needGame) {
    if (!fileOk(paths.packZip, MIN_ZIP_BYTES)) {
      throw new Error('Нет pack.zip для распаковки. Удали C:\\InProtect\\install-state.json и нажми Play снова.');
    }
    resetDir(paths.game);
    await extractPackToGame(paths.packZip, paths.game, packUrl, onProgress);
  } else {
    emitProgress(onProgress, { phase: 'Сборка уже распакована', received: 1, total: 1, percent: 100 });
  }

  writeInstallState(paths.root, {
    fingerprint,
    packUrl,
    modUrl,
    installedAt: new Date().toISOString(),
  });

  emitProgress(onProgress, { phase: 'Запуск…', received: 1, total: 1, percent: 100 });
  const result = buildLaunchResult(paths);
  result.cached = false;
  return result;
}

module.exports = {
  DEFAULT_MANIFEST,
  formatBytes,
  prepareInstance,
  downloadUrlToFile,
  getInProtectPaths,
};
