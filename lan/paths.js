const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INPROTECT_ROOT = path.join('C:', 'InProtect');
const INSTALL_STATE_FILE = 'install-state.json';
const MIN_ZIP_BYTES = 50_000;
const MIN_MOD_BYTES = 20_000;

function getInProtectPaths() {
  const root = INPROTECT_ROOT;
  const minecraft = path.join(root, 'minecraft');
  const packZip = path.join(root, '1.21.4.zip');
  const modCache = path.join(root, 'corpse-1.0.0.jar');
  for (const dir of [root, minecraft]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { root, minecraft, packZip, modCache };
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

function packFingerprint(packUrl) {
  return crypto.createHash('sha256').update(String(packUrl), 'utf8').digest('hex').slice(0, 24);
}

function readInstallState(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, INSTALL_STATE_FILE), 'utf8'));
  } catch {
    return null;
  }
}

function writeInstallState(root, data) {
  fs.writeFileSync(path.join(root, INSTALL_STATE_FILE), JSON.stringify(data, null, 2), 'utf8');
}

function resolveMinecraftRoot(minecraftDir) {
  if (!fs.existsSync(minecraftDir)) return minecraftDir;
  let entries;
  try {
    entries = fs.readdirSync(minecraftDir);
  } catch {
    return minecraftDir;
  }
  if (entries.length === 1) {
    const sub = path.join(minecraftDir, entries[0]);
    try {
      if (fs.statSync(sub).isDirectory()) {
        const hasMods = fs.existsSync(path.join(sub, 'mods'));
        const hasMc = fs.existsSync(path.join(sub, '.minecraft'));
        if (hasMods || hasMc) return sub;
      }
    } catch (_) {}
  }
  return minecraftDir;
}

function isMinecraftInstalled(paths) {
  const mcRoot = resolveMinecraftRoot(paths.minecraft);
  return dirHasContent(mcRoot);
}

module.exports = {
  INPROTECT_ROOT,
  MIN_ZIP_BYTES,
  MIN_MOD_BYTES,
  getInProtectPaths,
  resetDir,
  fileOk,
  dirHasContent,
  packFingerprint,
  readInstallState,
  writeInstallState,
  resolveMinecraftRoot,
  isMinecraftInstalled,
};
