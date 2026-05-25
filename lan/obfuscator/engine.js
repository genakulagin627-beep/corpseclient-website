'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const DEFAULT_TEMPLATE = path.join(__dirname, 'proguard-1.16.5.template.pro');
const DEFAULT_PROGUARD_JAR = path.join(__dirname, 'tools', 'proguard.jar');
const PROGUARD_MAX_BUFFER_BYTES = 1024 * 1024 * 256;

function resolveJavaBin() {
  return process.env.JAVA_BIN || 'java';
}

function resolveProguardJar(inputPath) {
  const custom = String(inputPath || '').trim();
  if (custom) return path.resolve(custom);
  return DEFAULT_PROGUARD_JAR;
}

function ensureFileExists(filePath, fieldName) {
  if (!filePath) {
    throw new Error(`${fieldName} is required`);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${fieldName} not found: ${resolved}`);
  }
  const st = fs.statSync(resolved);
  if (!st.isFile()) {
    throw new Error(`${fieldName} is not a file: ${resolved}`);
  }
  return resolved;
}

function toProguardPath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function q(p) {
  return `"${toProguardPath(p)}"`;
}

function getJavaRuntimeLibraryJarLines() {
  const javaHome = String(process.env.JAVA_HOME || '').trim();
  if (!javaHome) return [];
  const jmodsDir = path.join(javaHome, 'jmods');
  if (fs.existsSync(jmodsDir)) {
    const jmodFiles = fs.readdirSync(jmodsDir).filter((x) => x.toLowerCase().endsWith('.jmod'));
    return jmodFiles.map((name) => `-libraryjars ${q(path.join(jmodsDir, name))}(!**.jar;!module-info.class)`);
  }
  const rtJar = path.join(javaHome, 'lib', 'rt.jar');
  if (fs.existsSync(rtJar)) {
    return [`-libraryjars ${q(rtJar)}`];
  }
  return [];
}

function parseLibraryJars(input) {
  if (Array.isArray(input)) {
    return input.map((x) => String(x || '').trim()).filter(Boolean);
  }
  const raw = String(input || '').trim();
  if (!raw) return [];
  return raw
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
}

function collectJarFilesRecursive(rootDir) {
  const out = [];
  const stack = [path.resolve(rootDir)];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    const st = fs.statSync(current);
    if (st.isFile()) {
      if (current.toLowerCase().endsWith('.jar')) out.push(current);
      continue;
    }
    if (!st.isDirectory()) continue;
    const items = fs.readdirSync(current);
    for (const name of items) {
      stack.push(path.join(current, name));
    }
  }
  return out;
}

function buildLibraryJarsBlock(extraLibraryJars, libraryDir) {
  const autoRuntime = getJavaRuntimeLibraryJarLines();
  const extra = parseLibraryJars(extraLibraryJars).map((libPath) => {
    const full = ensureFileExists(libPath, 'Library JAR');
    return `-libraryjars ${q(full)}`;
  });
  const fromDir = [];
  const libDirRaw = String(libraryDir || '').trim();
  if (libDirRaw) {
    const libDirFull = path.resolve(libDirRaw);
    if (!fs.existsSync(libDirFull) || !fs.statSync(libDirFull).isDirectory()) {
      return [...autoRuntime, ...extra, `# Library directory not found, skipped: ${toProguardPath(libDirFull)}`].join('\n');
    }
    const jars = collectJarFilesRecursive(libDirFull);
    for (const jarPath of jars) {
      fromDir.push(`-libraryjars ${q(jarPath)}`);
    }
  }
  const lines = [...autoRuntime, ...extra, ...fromDir];
  if (!lines.length) {
    return '# No -libraryjars provided.';
  }
  return lines.join('\n');
}

function buildConfig(templateRaw, inJar, outJar, libraryJarsBlock) {
  return templateRaw
    .replace(/\{\{IN_JAR\}\}/g, toProguardPath(inJar))
    .replace(/\{\{OUT_JAR\}\}/g, toProguardPath(outJar))
    .replace(/\{\{LIBRARY_JARS_BLOCK\}\}/g, libraryJarsBlock);
}

function runObfuscate(options) {
  const inJar = String(options?.inJar || '').trim();
  const outJar = String(options?.outJar || '').trim();
  const proguardJarInput = String(options?.proguardJar || '').trim();
  const libraryJars = options?.libraryJars;
  const libraryDir = options?.libraryDir;

  try {
    if (!inJar || !outJar) {
      return { ok: false, log: '', error: 'Укажи входной и выходной JAR.' };
    }

    const inJarFull = ensureFileExists(inJar, 'Input JAR');
    const outJarFull = path.resolve(outJar);
    const outDir = path.dirname(outJarFull);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const proguardJar = ensureFileExists(resolveProguardJar(proguardJarInput), 'proguard.jar');
    const template = ensureFileExists(DEFAULT_TEMPLATE, 'ProGuard template');
    const templateRaw = fs.readFileSync(template, 'utf8');
    const libraryJarsBlock = buildLibraryJarsBlock(libraryJars, libraryDir);
    const configRaw = buildConfig(templateRaw, inJarFull, outJarFull, libraryJarsBlock);

    const tempConfigPath = path.join(
      os.tmpdir(),
      `inprotect-proguard-1165-${Date.now()}-${Math.random().toString(16).slice(2)}.pro`
    );
    fs.writeFileSync(tempConfigPath, configRaw, 'utf8');

    const javaBin = resolveJavaBin();
    const result = spawnSync(javaBin, ['-jar', proguardJar, '@' + tempConfigPath], {
      encoding: 'utf8',
      windowsHide: true,
      cwd: process.cwd(),
      maxBuffer: PROGUARD_MAX_BUFFER_BYTES,
    });

    try {
      fs.unlinkSync(tempConfigPath);
    } catch (_) {}

    const stdOut = String(result.stdout || '');
    const stdErr = String(result.stderr || '');
    const log = [stdOut.trim(), stdErr.trim()].filter(Boolean).join('\n\n');

    if (result.error) {
      return { ok: false, log, error: 'Не удалось запустить java/proguard: ' + result.error.message };
    }

    if (result.status !== 0) {
      return { ok: false, log, error: `ProGuard завершился с кодом ${result.status}` };
    }

    if (!fs.existsSync(outJarFull)) {
      return { ok: false, log, error: 'ProGuard завершился без выходного JAR.' };
    }

    return { ok: true, log: log || 'OK: обфускация завершена.' };
  } catch (e) {
    return { ok: false, log: '', error: String(e.message || e) };
  }
}

module.exports = { runObfuscate };
