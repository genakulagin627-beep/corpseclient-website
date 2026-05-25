const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Корневая папка клиента на диске C: */
const INPROTECT_ROOT = path.join('C:', 'InProtect');
const INSTALL_STATE_FILE = 'install-state.json';
const MIN_JAR_BYTES = 40_000;
const MIN_ZIP_BYTES = 50_000;

function getInProtectPaths() {
  const root = INPROTECT_ROOT;
  const game = path.join(root, 'game');
  const mods = path.join(root, 'mods');
  const clientJar = path.join(root, 'corpse-1.0.0.jar');
  const packZip = path.join(root, 'pack.zip');
  for (const dir of [root, game, mods]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { root, game, mods, clientJar, packZip };
}

function resetDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function fileOk(filePath, minBytes = 1) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size >= minBytes;
  } catch {
    return false;
  }
}

function dirHasContent(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isFile() && st.size > 0) return true;
      if (st.isDirectory() && dirHasContent(full)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function manifestFingerprint(packUrl, modUrl) {
  return crypto.createHash('sha256').update(`${packUrl}|${modUrl}`, 'utf8').digest('hex').slice(0, 24);
}

function readInstallState(root) {
  const p = path.join(root, INSTALL_STATE_FILE);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeInstallState(root, data) {
  fs.writeFileSync(path.join(root, INSTALL_STATE_FILE), JSON.stringify(data, null, 2), 'utf8');
}

function isInstallReady(paths) {
  return fileOk(paths.clientJar, MIN_JAR_BYTES) && dirHasContent(paths.game);
}

module.exports = {
  INPROTECT_ROOT,
  INSTALL_STATE_FILE,
  MIN_JAR_BYTES,
  MIN_ZIP_BYTES,
  getInProtectPaths,
  resetDir,
  fileOk,
  dirHasContent,
  manifestFingerprint,
  readInstallState,
  writeInstallState,
  isInstallReady,
};
