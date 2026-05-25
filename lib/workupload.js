/**
 * Workupload: обход «Are you a human» (SHA-256 puzzle) и получение прямой ссылки на файл.
 */
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function parseCookieHeader(setCookie) {
  const jar = {};
  const add = (line) => {
    const part = String(line).split(';')[0].trim();
    const eq = part.indexOf('=');
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1);
  };
  if (!setCookie) return jar;
  if (Array.isArray(setCookie)) setCookie.forEach(add);
  else add(setCookie);
  return jar;
}

function mergeCookies(jar, setCookie) {
  return { ...jar, ...parseCookieHeader(setCookie) };
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function requestRaw(url, jar, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      parsed,
      {
        method: options.method || 'GET',
        headers: {
          'User-Agent': UA,
          Accept: options.accept || '*/*',
          Cookie: cookieHeader(jar),
          Referer: options.referer || 'https://workupload.com/',
          Origin: 'https://workupload.com',
          ...(options.headers || {}),
        },
      },
      (res) => {
        const nextJar = mergeCookies(jar, res.headers['set-cookie']);
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
            jar: nextJar,
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(options.timeout || 120000, () => req.destroy(new Error('timeout')));
    if (options.body) req.write(options.body);
    req.end();
  });
}

function puzzleFromJar(jar) {
  const raw = jar.captcha;
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const data = JSON.parse(decoded);
    if (data.puzzle && data.find && data.range) return data;
    if (data.data && typeof data.data === 'string') {
      const inner = JSON.parse(data.data);
      if (inner.puzzle) return inner;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function solvePuzzle(puzzle, find, range) {
  const need = new Set(find);
  const out = [];
  for (let i = 0; i < range && out.length < find.length; i++) {
    if (need.has(sha256Hex(puzzle + i))) out.push(String(i));
  }
  if (out.length < find.length) {
    throw new Error('Не удалось решить проверку workupload (puzzle).');
  }
  return out.join(' ');
}

async function passHumanCheck(jar, referer) {
  let page = await requestRaw('https://workupload.com/', jar, { accept: 'text/html' });
  jar = page.jar;
  let data = puzzleFromJar(jar);
  if (!data && referer) {
    page = await requestRaw(referer, jar, { accept: 'text/html', referer: 'https://workupload.com/' });
    jar = page.jar;
    data = puzzleFromJar(jar);
  }
  if (!data) {
    const p = await requestRaw('https://workupload.com/puzzle', jar, { accept: 'application/json' });
    jar = p.jar;
    try {
      data = JSON.parse(p.body.toString()).data;
    } catch {
      data = puzzleFromJar(jar);
    }
  }
  if (!data) {
    throw new Error('Workupload: не получены данные puzzle.');
  }
  const captcha = solvePuzzle(data.puzzle, data.find, data.range);
  let post = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      post = await requestRaw('https://workupload.com/captcha', jar, {
        method: 'POST',
        accept: 'application/json',
        referer: referer || 'https://workupload.com/',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: `captcha=${encodeURIComponent(captcha)}`,
      });
      jar = post.jar;
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (!post) throw lastErr || new Error('Workupload: captcha request failed');
  const postJson = (() => {
    try {
      return JSON.parse(post.body.toString());
    } catch {
      return null;
    }
  })();
  if (postJson && postJson.success === false) {
    throw new Error('Workupload отклонил captcha.');
  }
  if (post.body.length > 0 && post.body.toString().includes('Are you a human')) {
    throw new Error(
      'Workupload блокирует автозагрузку. На Render: MC_PACK_URL и MOD_JAR_URL — прямые ссылки на .zip/.jar, или положи файлы в uploads/game/.'
    );
  }
  return jar;
}

function extractFileId(url) {
  const m = String(url || '').match(/workupload\.com\/(?:file|download|start)\/([A-Za-z0-9]+)/i);
  return m ? m[1] : null;
}

function isDirectDownloadUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return false;
  if (/workupload\.com\/file\//i.test(u)) return false;
  if (/dropbox\.com/i.test(u)) return true;
  if (/workupload\.com/i.test(u)) return true;
  return /\.(zip|jar|rar|7z)(\?|$)/i.test(u);
}

/**
 * @returns {Promise<{ downloadUrl: string, jar: object }>}
 */
async function resolveWorkuploadDownloadUrl(pageUrl) {
  const fileId = extractFileId(pageUrl);
  if (!fileId) {
    throw new Error('Некорректная ссылка workupload.');
  }
  let jar = {};
  jar = await passHumanCheck(jar, `https://workupload.com/file/${fileId}`);
  const filePage = await requestRaw(`https://workupload.com/file/${fileId}`, jar, {
    accept: 'text/html',
    referer: 'https://workupload.com/',
  });
  jar = filePage.jar;
  const html = filePage.body.toString('utf8');
  let token = '';
  const tokenMatch =
    html.match(/["']token["']\s*:\s*["']([a-z0-9]+)["']/i) ||
    html.match(/token=([a-z0-9]{20,})/i) ||
    html.match(/Cookie:\s*token=([a-z0-9]+)/i);
  if (tokenMatch) token = tokenMatch[1];

  const api = await requestRaw(
    `https://workupload.com/api/file/getDownloadServer/${fileId}`,
    jar,
    {
      accept: 'application/json',
      referer: `https://workupload.com/file/${fileId}`,
      headers: token ? { Cookie: `${cookieHeader(jar)}; token=${token}` } : {},
    }
  );
  jar = api.jar;
  let payload;
  try {
    payload = JSON.parse(api.body.toString());
  } catch {
    throw new Error(
      'Workupload не отдал ссылку. Загрузи pack/mod на сервер (uploads/game) или укажи прямые URL в Render.'
    );
  }
  const downloadUrl = payload?.data?.url;
  if (!downloadUrl) {
    throw new Error(payload?.message || 'Workupload: пустой ответ API.');
  }
  return { downloadUrl, jar, token };
}

module.exports = {
  extractFileId,
  isDirectDownloadUrl,
  resolveWorkuploadDownloadUrl,
  passHumanCheck,
  requestRaw,
  cookieHeader,
  UA,
};
