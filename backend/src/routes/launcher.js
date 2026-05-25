const express = require("express");
const fs = require("fs");
const path = require("path");
const workupload = require("../../../lib/workupload");

const router = express.Router();
const siteRoot = path.resolve(__dirname, "..", "..", "..");
const launcherBuildDirs = [
  path.join(siteRoot, "lan", "release"),
  path.join(siteRoot, "lan", "dist"),
];
const launcherUploadDir = path.join(siteRoot, "uploads", "launcher");
const gameUploadDir = path.join(siteRoot, "uploads", "game");

const DEFAULT_PACK_WU = "https://workupload.com/file/DfDbfTtSUsz";
const DEFAULT_MOD_WU = "https://workupload.com/file/BLmQgMPqCXW";

function findLauncherExe() {
  const fromDist = findLocalLauncherExe();
  if (fromDist) return fromDist;
  if (!fs.existsSync(launcherUploadDir)) return null;
  const files = fs
    .readdirSync(launcherUploadDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.exe$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(launcherUploadDir, entry.name);
      const st = fs.statSync(fullPath);
      return { name: entry.name, fullPath, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.length ? files[0] : null;
}

function findLocalLauncherExe() {
  const all = [];
  for (const dir of launcherBuildDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.exe$/i.test(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const st = fs.statSync(fullPath);
      all.push({ name: entry.name, fullPath, mtimeMs: st.mtimeMs });
    }
  }
  all.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return all.length ? all[0] : null;
}

function findGameFile(candidates, extRe) {
  for (const name of candidates) {
    const fullPath = path.join(gameUploadDir, name);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return { name, fullPath };
    }
  }
  if (!fs.existsSync(gameUploadDir)) return null;
  const files = fs
    .readdirSync(gameUploadDir, { withFileTypes: true })
    .filter((e) => e.isFile() && extRe.test(e.name))
    .map((e) => {
      const fullPath = path.join(gameUploadDir, e.name);
      return { name: e.name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] || null;
}

function hasActiveSubscription(user) {
  if (!user || !user.subscription_until) return false;
  const d = new Date(String(user.subscription_until));
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function apiBase(req) {
  return `${req.protocol}://${req.get("host")}/api/launcher`;
}

function manifestUrl(req, envKey, defaultWu, apiPath, extRe, localNames) {
  const env = String(process.env[envKey] || "").trim();
  if (env && workupload.isDirectDownloadUrl(env)) return env;
  if (findGameFile(localNames, extRe)) return `${apiBase(req)}${apiPath}`;
  if (env) return `${apiBase(req)}${apiPath}`;
  return `${apiBase(req)}${apiPath}`;
}

async function serveGameDownload(req, res, opts) {
  const local = findGameFile(opts.localNames, opts.extRe);
  if (local) {
    return res.download(local.fullPath, local.name);
  }

  const envUrl = String(process.env[opts.envKey] || "").trim();
  const source = envUrl || opts.defaultWu;

  if (workupload.isDirectDownloadUrl(source)) {
    return res.redirect(302, source);
  }

  try {
    const { downloadUrl } = await workupload.resolveWorkuploadDownloadUrl(source);
    return res.redirect(302, downloadUrl);
  } catch (e) {
    return res.status(502).json({
      error: "download_failed",
      message: String(e.message || e),
      hint:
        "Залей " +
        opts.hintName +
        " в uploads/game/ на сервере (имя: " +
        opts.localNames.join(" или ") +
        ") или задай " +
        opts.envKey +
        " на Render — прямая ссылка на .zip/.jar (не страница workupload).",
    });
  }
}

router.get("/me", (req, res) => {
  const active = hasActiveSubscription(req.user);
  return res.json({
    user: {
      uid: req.user.uid,
      email: req.user.email,
      displayName: req.user.display_name,
      role: req.user.role,
    },
    has_subscription: active,
    subscription_until: req.user.subscription_until || null,
  });
});

router.get("/manifest", (req, res) => {
  if (!hasActiveSubscription(req.user)) {
    return res.status(403).json({ error: "no_subscription" });
  }
  return res.json({
    minecraftPackUrl: manifestUrl(
      req,
      "MC_PACK_URL",
      DEFAULT_PACK_WU,
      "/download-pack",
      /\.(zip|rar|7z)$/i,
      ["minecraft-pack.zip", "pack.zip", "client.zip"]
    ),
    modJarUrl: manifestUrl(
      req,
      "MOD_JAR_URL",
      DEFAULT_MOD_WU,
      "/download-mod",
      /\.jar$/i,
      ["mod.jar", "corpseclient-mod.jar", "client-mod.jar"]
    ),
  });
});

router.get("/download-pack", (req, res) => {
  if (!hasActiveSubscription(req.user)) {
    return res.status(403).json({ error: "no_subscription" });
  }
  return serveGameDownload(req, res, {
    envKey: "MC_PACK_URL",
    defaultWu: DEFAULT_PACK_WU,
    localNames: ["minecraft-pack.zip", "pack.zip", "client.zip"],
    extRe: /\.(zip|rar|7z)$/i,
    hintName: "сборку Minecraft (zip)",
  });
});

router.get("/download-mod", (req, res) => {
  if (!hasActiveSubscription(req.user)) {
    return res.status(403).json({ error: "no_subscription" });
  }
  return serveGameDownload(req, res, {
    envKey: "MOD_JAR_URL",
    defaultWu: DEFAULT_MOD_WU,
    localNames: ["mod.jar", "corpseclient-mod.jar", "client-mod.jar"],
    extRe: /\.jar$/i,
    hintName: "мод (.jar)",
  });
});

router.get("/download-link", (req, res) => {
  if (!hasActiveSubscription(req.user)) {
    return res.status(403).json({ error: "no_subscription" });
  }
  const url = String(process.env.LAUNCHER_DOWNLOAD_URL || "").trim();
  if (url) {
    return res.json({ url });
  }

  const localExe = findLauncherExe();
  if (localExe) {
    const base = `${req.protocol}://${req.get("host")}`;
    return res.json({ url: `${base}/api/launcher/download-binary` });
  }

  return res.status(500).json({ error: "download_unconfigured" });
});

router.get("/download-binary", (req, res) => {
  if (!hasActiveSubscription(req.user)) {
    return res.status(403).json({ error: "no_subscription" });
  }
  const localExe = findLauncherExe();
  if (!localExe) {
    return res.status(404).json({ error: "launcher_file_missing" });
  }
  return res.download(localExe.fullPath, localExe.name);
});

module.exports = router;
