'use strict';

const path = require('path');
const { runObfuscate } = require('./engine');

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  node obfuscator/obfuscate.js --in "<input.jar>" --out "<output.jar>" [--pg "<proguard.jar>"] [--lib "<a.jar;b.jar>"] [--lib-dir "<folder>"]',
      '',
      'Examples:',
      '  node obfuscator/obfuscate.js --in "C:\\client-1.16.5.jar" --out "C:\\client-1.16.5-obf.jar"',
      '  node obfuscator/obfuscate.js --in "./client.jar" --out "./client-obf.jar" --pg "./obfuscator/tools/proguard.jar"',
      '  node obfuscator/obfuscate.js --in "./client.jar" --out "./client-obf.jar" --lib "C:\\libs\\minecraft.jar;C:\\libs\\guava.jar"',
      '  node obfuscator/obfuscate.js --in "./client.jar" --out "./client-obf.jar" --lib-dir "C:\\.minecraft\\libraries"',
    ].join('\n')
  );
}

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return String(process.argv[idx + 1] || '').trim();
}

function main() {
  const inJar = parseArg('--in');
  const outJar = parseArg('--out');
  const proguardJar = parseArg('--pg');
  const libraryJars = parseArg('--lib');
  const libraryDir = parseArg('--lib-dir');

  if (!inJar || !outJar) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const res = runObfuscate({
    inJar: path.resolve(inJar),
    outJar: path.resolve(outJar),
    proguardJar: proguardJar ? path.resolve(proguardJar) : '',
    libraryJars,
    libraryDir,
  });

  // eslint-disable-next-line no-console
  console.log(res.log || '');
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(res.error || 'Obfuscation failed');
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log('Done:', outJar);
  }
}

main();
