const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const siteRoot = path.resolve(__dirname, "..", "..", "..");
const launcherBuildDirs = [
  path.join(siteRoot, "lan", "release"),
  path.join(siteRoot, "lan", "dist"),
];
const launcherUploadDir = path.join(siteRoot, "uploads", "launcher");

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

function hasActiveSubscription(user) {
  if (!user || !user.subscription_until) return false;
  const d = new Date(String(user.subscription_until));
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
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
    minecraftPackUrl:
      String(process.env.MC_PACK_URL || "").trim() ||
      "https://workupload.com/file/DfDbfTtSUsz",
    modJarUrl:
      String(process.env.MOD_JAR_URL || "").trim() ||
      "https://workupload.com/file/BLmQgMPqCXW",
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

