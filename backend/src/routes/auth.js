const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { db } = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
const protectedAdminEmail = String(process.env.ADMIN_EMAIL || "admin@inprotect.local").toLowerCase();

function presentUser(user) {
  const uid = user && user.uid != null ? Number(user.uid) : null;
  const avatarRow =
    uid != null && user && user.avatar_filename !== undefined
      ? { avatar_filename: user.avatar_filename, avatar_updated_at: user.avatar_updated_at }
      : uid != null
        ? db
            .prepare("SELECT avatar_filename, updated_at AS avatar_updated_at FROM user_avatars WHERE uid = ?")
            .get(uid)
        : null;
  const avatarFilename = avatarRow && avatarRow.avatar_filename ? String(avatarRow.avatar_filename) : null;
  const avatarUpdatedAt = avatarRow && avatarRow.avatar_updated_at ? String(avatarRow.avatar_updated_at) : null;
  const avatarUrl = avatarFilename
    ? `/uploads/avatars/${encodeURIComponent(avatarFilename)}?v=${encodeURIComponent(avatarUpdatedAt || "")}`
    : null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    banned: !!user.banned,
    subscriptionTill: user.subscription_until,
    hwid: user.hwid || "—",
    registeredAt: user.registered_at,
    avatar_url: avatarUrl,
  };
}

function signToken(uid) {
  return jwt.sign({ uid }, process.env.JWT_SECRET || "dev_secret_change_me", {
    expiresIn: "7d",
  });
}

function normalizeIsoDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const siteRoot = path.resolve(__dirname, "..", "..", "..");
const avatarsDir = path.join(siteRoot, "uploads", "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const allowedAvatarMimes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const uid = req && req.user && req.user.uid != null ? Number(req.user.uid) : 0;
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext) ? ext : ".png";
    cb(null, `${uid}${safeExt}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (allowedAvatarMimes.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("invalid_file_type"));
  },
});

router.post("/register", (req, res) => {
  const { nickname, email, password } = req.body || {};
  const safeEmail = String(email || "").trim().toLowerCase();
  const safeNickname = String(nickname || "").trim();
  const safePassword = String(password || "");

  if (!safeEmail || !safeNickname || safePassword.length < 6) {
    return res.status(400).json({ error: "invalid" });
  }

  const exists = db.prepare("SELECT uid FROM users WHERE lower(email) = lower(?)").get(safeEmail);
  if (exists) {
    return res.status(409).json({ error: "exists" });
  }

  const hash = bcrypt.hashSync(safePassword, 10);
  const now = new Date().toISOString();
  const insert = db
    .prepare(
      "INSERT INTO users (email, password_hash, display_name, role, registered_at) VALUES (?, ?, ?, 'user', ?)"
    )
    .run(safeEmail, hash, safeNickname, now);
  const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(insert.lastInsertRowid);
  return res.status(201).json({ token: signToken(user.uid), user: presentUser(user) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(String(email).trim());
  if (!user) {
    return res.status(401).json({ error: "credentials" });
  }
  if (user.banned) {
    return res.status(403).json({ error: "banned" });
  }
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "credentials" });
  }
  return res.json({ token: signToken(user.uid), user: presentUser(user) });
});

router.get("/me", authRequired, (req, res) => {
  return res.json({ user: presentUser(req.user) });
});

router.patch("/profile", authRequired, (req, res) => {
  const email = String((req.body && req.body.email) || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "email_invalid" });
  }
  const currentEmail = String(req.user.email || "").toLowerCase();
  if (currentEmail === protectedAdminEmail && email !== currentEmail) {
    return res.status(403).json({ error: "protected_admin_email_locked" });
  }
  const taken = db
    .prepare("SELECT uid FROM users WHERE lower(email) = lower(?) AND uid != ?")
    .get(email, req.user.uid);
  if (taken) {
    return res.status(409).json({ error: "exists" });
  }
  db.prepare("UPDATE users SET email = ? WHERE uid = ?").run(email, req.user.uid);
  const updated = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.user.uid);
  return res.json({ user: presentUser(updated) });
});

router.post("/avatar", authRequired, avatarUpload.single("avatar"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no_file" });

    const uid = req.user.uid;
    const prev = db.prepare("SELECT avatar_filename FROM user_avatars WHERE uid = ?").get(uid);
    const prevFilename = prev && prev.avatar_filename ? String(prev.avatar_filename) : null;
    const nextFilename = String(req.file.filename || "");

    if (prevFilename && prevFilename !== nextFilename) {
      try {
        fs.unlinkSync(path.join(avatarsDir, prevFilename));
      } catch (_e) {}
    }

    const nowIso = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO user_avatars (uid, avatar_filename, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
        avatar_filename = excluded.avatar_filename,
        updated_at = excluded.updated_at
      `
    ).run(uid, nextFilename, nowIso);

    const updatedUser = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid);
    return res.json({ user: presentUser(updatedUser) });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "unknown";
    if (msg === "invalid_file_type") return res.status(400).json({ error: "invalid_file_type" });
    return res.status(500).json({ error: "server" });
  }
});

router.delete("/avatar", authRequired, (req, res) => {
  const uid = req.user.uid;
  const prev = db.prepare("SELECT avatar_filename FROM user_avatars WHERE uid = ?").get(uid);
  const prevFilename = prev && prev.avatar_filename ? String(prev.avatar_filename) : null;
  if (prevFilename) {
    try {
      fs.unlinkSync(path.join(avatarsDir, prevFilename));
    } catch (_e) {}
  }
  db.prepare("DELETE FROM user_avatars WHERE uid = ?").run(uid);
  const updatedUser = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid);
  return res.json({ user: presentUser(updatedUser) });
});

router.post("/redeem", authRequired, (req, res) => {
  const code = String((req.body && req.body.code) || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ error: "no_code" });
  }
  const key = db.prepare("SELECT * FROM license_keys WHERE code = ?").get(code);
  if (!key) {
    return res.status(404).json({ error: "key_invalid" });
  }
  if (key.used_at) {
    return res.status(409).json({ error: "key_used" });
  }
  if (!key.duration_minutes || key.duration_minutes < 1) {
    return res.status(400).json({ error: "bad_duration" });
  }

  const now = new Date();
  const current = normalizeIsoDate(req.user.subscription_until);
  const start = current && current > now ? current : now;
  const next = new Date(start.getTime() + key.duration_minutes * 60 * 1000);
  const nextIso = next.toISOString();
  const usedAt = now.toISOString();

  db.prepare("UPDATE users SET subscription_until = ? WHERE uid = ?").run(nextIso, req.user.uid);
  db.prepare("UPDATE license_keys SET used_at = ?, used_by_uid = ? WHERE id = ?").run(usedAt, req.user.uid, key.id);

  const updated = db.prepare("SELECT * FROM users WHERE uid = ?").get(req.user.uid);
  return res.json({
    user: presentUser(updated),
    extended_minutes: key.duration_minutes,
    extended_label: `${key.duration_minutes} мин.`,
  });
});

router.use((err, _req, res, _next) => {
  const msg = err && err.message ? String(err.message) : "";
  if (msg === "invalid_file_type") return res.status(400).json({ error: "invalid_file_type" });
  return res.status(500).json({ error: "server" });
});

module.exports = router;
