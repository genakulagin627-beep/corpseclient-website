const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { app } = require('electron');
const {
  resolveWorkuploadDownloadUrl,
  isDirectDownloadUrl,
} = require('../lib/workupload');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DEFAULT_MANIFEST = {
  minecraftPackUrl: 'https://workupload.com/file/DfDbfTtSUsz',
  modJarUrl: 'https://workupload.com/file/BLmQgMPqCXW',
};

function emitProgress(onProgress, patch) {
  if (typeof onProgress === 'function') onProgress(patch);
}

function randomInstallDir() {
  const base = path.join(app.getPath('userData'), 'instances');
  fs.mkdirSync(base, { recursive: true });
  const dir = path.join(base, crypto.randomBytes(12).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
  const priority = [
    /javaw\.exe$/i,
    /minecraft\.exe$/i,
    /fabric.*\.exe$/i,
    /\.exe$/i,
  ];
  for (const re of priority) {
    const hit = files.find((f) => re.test(f) && !/unins|setup|install|update/i.test(f));
    if (hit) return hit;
  }
  const bat = files.find((f) => /\.bat$/i.test(f) && /start|run|launch|play/i.test(f));
  if (bat) return bat;
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

async function prepareInstance(manifest, onProgress, opts = {}) {
  const installDir = randomInstallDir();
  const packUrl = String(manifest.minecraftPackUrl || DEFAULT_MANIFEST.minecraftPackUrl).trim();
  const modUrl = String(manifest.modJarUrl || DEFAULT_MANIFEST.modJarUrl).trim();
  const dlOpts = { authToken: opts.authToken };

  const packTmp = path.join(installDir, '_pack_dl.bin');
  await downloadUrlToFile(packUrl, packTmp, 'Скачивание Minecraft Fabric…', onProgress, dlOpts);

  const head = Buffer.alloc(4);
  const fd = fs.openSync(packTmp, 'r');
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  const isZip = head[0] === 0x50 && head[1] === 0x4b;

  if (isZip) {
    emitProgress(onProgress, { phase: 'Распаковка…', received: 0, total: 0, percent: -1 });
    await extractZipWin(packTmp, installDir);
    try {
      fs.unlinkSync(packTmp);
    } catch (_) {}
  } else {
    const ext = packUrl.toLowerCase().includes('.jar') ? '.jar' : '.exe';
    const finalPack = path.join(installDir, `client_pack${ext}`);
    fs.renameSync(packTmp, finalPack);
  }

  const modsDir = findModsDir(installDir);
  const modDest = path.join(modsDir, 'corpseclient-mod.jar');
  await downloadUrlToFile(modUrl, modDest, 'Скачивание мода…', onProgress, dlOpts);

  const launchPath = findLaunchExecutable(installDir);
  if (!launchPath) {
    throw new Error('Не найден .exe для запуска в скачанном архиве.');
  }

  emitProgress(onProgress, { phase: 'Готово', received: 1, total: 1, percent: 100 });
  return {
    installDir,
    launchPath,
    launchKind: /\.jar$/i.test(launchPath) ? 'jar' : /\.bat$/i.test(launchPath) ? 'bat' : 'exe',
    modPath: modDest,
  };
}

module.exports = {
  DEFAULT_MANIFEST,
  formatBytes,
  prepareInstance,
  downloadUrlToFile,
};
