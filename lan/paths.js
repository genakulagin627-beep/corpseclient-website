const fs = require('fs');
const path = require('path');

/** Корневая папка клиента на диске C: */
const INPROTECT_ROOT = path.join('C:', 'InProtect');

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

module.exports = {
  INPROTECT_ROOT,
  getInProtectPaths,
  resetDir,
};
