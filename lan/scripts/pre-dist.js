/**
 * Закрывает процессы Electron/Launcher и очищает lan/release перед electron-builder.
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'release');

function killImages(names) {
  for (const name of names) {
    try {
      execSync(`taskkill /F /IM ${name}`, { stdio: 'ignore', windowsHide: true });
    } catch (_) {
      /* not running */
    }
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeDistDir() {
  if (!fs.existsSync(dist)) return true;
  for (let i = 0; i < 12; i++) {
    try {
      fs.rmSync(dist, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      return true;
    } catch (e) {
      if (i === 5) {
        const stale = `${dist}.old.${Date.now()}`;
        try {
          fs.renameSync(dist, stale);
          console.log('Renamed locked dist to', stale);
          return true;
        } catch (_) {
          /* keep retrying delete */
        }
      }
      sleep(500);
    }
  }
  return false;
}

killImages(['electron.exe', 'Launcher.exe', 'app-builder.exe']);
sleep(800);

if (!removeDistDir()) {
  console.error('');
  console.error('Не удалось удалить dist/. Закрой вручную:');
  console.error('  - окно лаунчера (npm start)');
  console.error('  - Cursor/проводник, если открыта папка lan\\dist');
  console.error('  - Диспетчер задач → завершить electron.exe / Launcher.exe');
  console.error('Потом снова: npm run dist');
  process.exit(1);
}

console.log('release/ готов к сборке');
