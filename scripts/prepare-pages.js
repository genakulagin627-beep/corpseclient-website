/**
 * Собирает статику для GitHub Pages в папку _site/
 * Запуск: PUBLIC_API_URL=https://... node scripts/prepare-pages.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "_site");
const repo = process.env.GITHUB_REPOSITORY || "genakulagin627-beep/corpseclient-website";
const pagesBase = process.env.PAGES_BASE || `/${repo.split("/")[1]}/`;
const apiUrl = String(process.env.PUBLIC_API_URL || "").trim().replace(/\/$/, "");

const skipDirs = new Set([
  "backend",
  "frontend-admin",
  "lan",
  "node_modules",
  "_site",
  ".git",
  ".github",
  "scripts",
  "uploads",
]);

const skipFiles = new Set(["prepare-pages.js", "site-config.example.js", ".gitignore"]);

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    const name = path.basename(src);
    if (skipDirs.has(name)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  const base = path.basename(src);
  if (skipFiles.has(base)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (fs.existsSync(out)) {
  fs.rmSync(out, { recursive: true, force: true });
}
fs.mkdirSync(out, { recursive: true });

for (const entry of fs.readdirSync(root)) {
  const src = path.join(root, entry);
  if (entry === "_site" || entry === ".git") continue;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    if (skipDirs.has(entry)) continue;
    copyRecursive(src, path.join(out, entry));
  } else {
    if (skipFiles.has(entry)) continue;
    fs.copyFileSync(src, path.join(out, entry));
  }
}

const cfg =
  "// Generated for GitHub Pages\n" +
  `window.INPROTECT_API = ${JSON.stringify(apiUrl)};\n` +
  `window.INPROTECT_PAGES_BASE = ${JSON.stringify(pagesBase)};\n`;
fs.writeFileSync(path.join(out, "site-config.js"), cfg, "utf8");
fs.writeFileSync(path.join(out, ".nojekyll"), "", "utf8");

console.log("Pages build OK:", out);
console.log("  base:", pagesBase);
console.log("  API:", apiUrl || "(same origin — only for full Node host)");
