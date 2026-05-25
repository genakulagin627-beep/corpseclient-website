/**
 * Защита лоудера: проверки перед запуском клиента (путь, тип файла, опционально SHA-256).
 * Не является обходом античита на серверах — только целостность и базовые проверки.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROT_VERSION = '1.1.0';

/**
 * @param {string} filePath
 * @returns {Promise<string>} hex sha256
 */
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(filePath);
    rs.on('error', reject);
    rs.on('data', (chunk) => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
  });
}

function normalizeSha256Hex(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^sha256:/i, '');
}

/**
 * @param {{ path: string, kind?: string, integritySha256?: string }} entry
 * @returns {Promise<{ ok: true } | { ok: false, code: string, error: string }>}
 */
async function assertLaunchAllowed(entry) {
  if (!entry || typeof entry.path !== 'string') {
    return { ok: false, code: 'NO_PATH', error: 'Путь к клиенту не задан.' };
  }

  const raw = entry.path.trim();
  if (!raw) {
    return { ok: false, code: 'EMPTY', error: 'Путь к клиенту пустой.' };
  }

  let full;
  try {
    full = path.normalize(raw);
  } catch {
    return { ok: false, code: 'BAD_PATH', error: 'Некорректный путь.' };
  }

  if (!fs.existsSync(full)) {
    return { ok: false, code: 'NOT_FOUND', error: 'Файл клиента не найден по указанному пути.' };
  }

  const st = fs.statSync(full);
  if (!st.isFile()) {
    return { ok: false, code: 'NOT_FILE', error: 'Указанный путь не является файлом.' };
  }

  const kind = entry.kind === 'jar' ? 'jar' : 'exe';
  const ext = path.extname(full).toLowerCase();

  if (kind === 'jar' && ext !== '.jar') {
    return { ok: false, code: 'KIND_JAR', error: 'Для типа JAR нужен файл с расширением .jar.' };
  }

  if (kind === 'exe' && ext && ext !== '.exe' && ext !== '.bat' && ext !== '.cmd') {
    return { ok: false, code: 'KIND_EXE', error: 'Ожидался .exe (или .bat / .cmd).' };
  }

  const expected = normalizeSha256Hex(entry.integritySha256);
  if (expected) {
    if (!/^[a-f0-9]{64}$/.test(expected)) {
      return {
        ok: false,
        code: 'BAD_HASH_CFG',
        error: 'В настройках указан неверный SHA-256 (нужно 64 hex-символа).',
      };
    }
    let actual;
    try {
      actual = await sha256File(full);
    } catch (e) {
      return { ok: false, code: 'HASH_READ', error: 'Не удалось прочитать файл для проверки: ' + String(e.message || e) };
    }
    const a = Buffer.from(actual, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {
        ok: false,
        code: 'HASH_MISMATCH',
        error: 'Защита: файл клиента не совпадает с ожидаемым (SHA-256). Возможна подмена.',
      };
    }
  }

  return { ok: true };
}

function getProtInfo() {
  return {
    name: 'Prot',
    version: PROT_VERSION,
    description: 'Проверка пути, типа файла и опционально SHA-256 целостности.',
  };
}

module.exports = {
  assertLaunchAllowed,
  sha256File,
  getProtInfo,
  PROT_VERSION,
};
