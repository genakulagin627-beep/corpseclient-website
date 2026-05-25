const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const {
  getInProtectPaths,
  resetDir,
  fileOk,
  manifestFingerprint,
  packFingerprint,
  readInstallState,
  writeInstallState,
  resolveMinecraftRoot,
  isMinecraftInstalled,
  MIN_ZIP_BYTES,
  MIN_MOD_BYTES,
} = require('./paths');
const { resolveWorkuploadDownloadUrl, isDirectDownloadUrl } = require('../lib/workupload');
const {
  DEFAULT_MC_PACK_URL,
  DEFAULT_MOD_JAR_URL,
  normalizeDownloadUrl,
} = require('../lib/download-url');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
        headers: { 'User-Agent': UA, Accept: '*/*', Referer: 'https://workupload.com/', ...extraHeaders },
      },
      (res) => {
        const code = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, parsed).href;
          const nextHeaders = { ...extraHeaders };
          if (new URL(next).host !== parsed.host) delete nextHeaders.Authorization;
          return resolve(fetchWithRedirects(next, maxRedirects - 1, nextHeaders));
        }
        resolve(res);
      }
    );
    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('timeout')));
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
  return fetchWithRedirects(downloadUrl);
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
    file.on('finish', () => file.close(() => resolve()));
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
    res = await resolveWorkuploadUrl(sourceUrl);
  } else {
    res = await fetchWithRedirects(sourceUrl, 12, headers);
  }
  const code = res.statusCode || 0;
  if (code === 502 || code === 503) {
    throw new Error((await readJsonErrorBody(res)) || `Ошибка сервера (${code})`);
  }
  if (code >= 400) {
    res.resume();
    throw new Error(`Ошибка загрузки (${code})`);
  }
  const ct = String(res.headers['content-type'] || '').toLowerCase();
  if (ct.includes('text/html') && !/\/api\/launcher\//i.test(sourceUrl)) {
    res.resume();
    throw new Error('Скачана страница вместо файла. Проверь ссылку (Dropbox: dl=1).');
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

function sniffZip(zipPath) {
  const head = Buffer.alloc(4);
  const fd = fs.openSync(zipPath, 'r');
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  return head[0] === 0x50 && head[1] === 0x4b;
}

function walkFiles(dir, depth = 0, maxDepth = 10) {
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

function findModsDir(mcRoot) {
  function walk(dir, depth) {
    if (depth > 10 || !fs.existsSync(dir)) return null;
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
      const inner = walk(full, depth + 1);
      if (inner) return inner;
    }
    return null;
  }
  const found = walk(mcRoot, 0);
  if (found) return found;
  const guessed = path.join(mcRoot, 'mods');
  fs.mkdirSync(guessed, { recursive: true });
  return guessed;
}

/** Запуск именно Minecraft / лаунчера из сборки — не mod.jar */
function findMinecraftLaunch(mcRoot) {
  const files = walkFiles(mcRoot);
  const bat = files.find(
    (f) => /\.bat$/i.test(f) && /start|launch|play|run|minecraft|fabric/i.test(path.basename(f))
  );
  if (bat) return { path: bat, kind: 'bat' };
  const exePriority = [/minecraft.*launcher/i, /minecraft\.exe/i, /fabric.*\.exe/i, /prism/i, /hmcl/i];
  for (const re of exePriority) {
    const hit = files.find((f) => re.test(f) && !/unins|setup|install|update/i.test(f));
    if (hit) return { path: hit, kind: 'exe' };
  }
  const anyExe = files.find((f) => /\.exe$/i.test(f) && !/unins|setup|install|update|java/i.test(f));
  if (anyExe) return { path: anyExe, kind: 'exe' };
  const javaw = files.find((f) => /javaw\.exe$/i.test(f));
  if (javaw) return { path: javaw, kind: 'exe' };
  return null;
}

async function extractFabricPack(paths, packUrl, onProgress) {
  if (!fileOk(paths.packZip, MIN_ZIP_BYTES)) {
    throw new Error('Нет 1.21.4.zip — сначала нажми «Скачать Minecraft».');
  }
  if (!sniffZip(paths.packZip)) {
    throw new Error('1.21.4.zip повреждён или это не zip. Скачай заново.');
  }
  emitProgress(onProgress, {
    phase: 'Распаковка Fabric 1.21.4…',
    received: 0,
    total: 0,
    percent: -1,
  });
  resetDir(paths.minecraft);
  await extractZipWin(paths.packZip, paths.minecraft);
}

/**
 * Только Minecraft: скачать zip + распаковать в C:\InProtect\minecraft
 */
async function installMinecraft(manifest, onProgress, opts = {}) {
  const paths = getInProtectPaths();
  const packUrl = normalizeDownloadUrl(
    String(manifest.minecraftPackUrl || DEFAULT_MANIFEST.minecraftPackUrl).trim()
  );
  const fp = packFingerprint(packUrl);
  const force = !!opts.forceReinstall;
  const state = readInstallState(paths.root);
  const dlOpts = { authToken: opts.authToken };

  if (!force && state?.packFingerprint === fp && isMinecraftInstalled(paths)) {
    emitProgress(onProgress, { phase: 'Minecraft уже установлен', percent: 100, received: 1, total: 1 });
    return { ok: true, installDir: paths.root, cached: true };
  }

  if (force || !fileOk(paths.packZip, MIN_ZIP_BYTES)) {
    await downloadUrlToFile(
      packUrl,
      paths.packZip,
      'Скачивание Minecraft 1.21.4 Fabric…',
      onProgress,
      dlOpts
    );
  } else {
    emitProgress(onProgress, { phase: 'Архив уже скачан', percent: 100, received: 1, total: 1 });
  }

  await extractFabricPack(paths, packUrl, onProgress);

  writeInstallState(paths.root, {
    packFingerprint: fp,
    packUrl,
    installedAt: new Date().toISOString(),
  });

  emitProgress(onProgress, { phase: 'Minecraft 1.21.4 готов', percent: 100, received: 1, total: 1 });
  return { ok: true, installDir: paths.root, cached: false };
}

async function ensureModInMods(paths, modUrl, onProgress, dlOpts) {
  if (!fileOk(paths.modCache, MIN_MOD_BYTES)) {
    await downloadUrlToFile(
      modUrl,
      paths.modCache,
      'Скачивание мода…',
      onProgress,
      dlOpts
    );
  } else {
    emitProgress(onProgress, { phase: 'Мод уже скачан', percent: 100, received: 1, total: 1 });
  }
  const mcRoot = resolveMinecraftRoot(paths.minecraft);
  const modsDir = findModsDir(mcRoot);
  const modDest = path.join(modsDir, 'corpse-1.0.0.jar');
  fs.copyFileSync(paths.modCache, modDest);
  return { mcRoot, modsDir, modDest };
}

/**
 * Play: установить MC если нет → мод в mods → запуск .exe/.bat из сборки
 */
async function prepareLaunch(manifest, onProgress, opts = {}) {
  const paths = getInProtectPaths();
  const packUrl = normalizeDownloadUrl(
    String(manifest.minecraftPackUrl || DEFAULT_MANIFEST.minecraftPackUrl).trim()
  );
  const modUrl = normalizeDownloadUrl(
    String(manifest.modJarUrl || DEFAULT_MANIFEST.modJarUrl).trim()
  );
  const dlOpts = { authToken: opts.authToken };

  if (!isMinecraftInstalled(paths)) {
    emitProgress(onProgress, { phase: 'Устанавливаем Minecraft…', percent: 0, received: 0, total: 0 });
    await installMinecraft(manifest, onProgress, opts);
  }

  emitProgress(onProgress, { phase: 'Кладём мод в mods…', percent: 0, received: 0, total: 0 });
  const { mcRoot, modDest } = await ensureModInMods(paths, modUrl, onProgress, dlOpts);

  const launch = findMinecraftLaunch(mcRoot);
  if (!launch) {
    throw new Error(
      'В сборке нет Minecraft Launcher (.exe) или start.bat. Проверь содержимое 1.21.4.zip.'
    );
  }

  emitProgress(onProgress, { phase: 'Запуск Minecraft…', percent: 100, received: 1, total: 1 });
  return {
    installDir: paths.root,
    gameDir: mcRoot,
    launchPath: launch.path,
    launchKind: launch.kind,
    modPath: modDest,
    cached: isMinecraftInstalled(paths),
  };
}

module.exports = {
  DEFAULT_MANIFEST,
  installMinecraft,
  prepareLaunch,
  downloadUrlToFile,
  getInProtectPaths,
};
