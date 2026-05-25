const express = require("express");
const { db } = require("../db");

const router = express.Router();

function avatarUrl(avatarFilename, avatarUpdatedAt) {
  if (!avatarFilename) return null;
  const fn = String(avatarFilename);
  const v = avatarUpdatedAt != null ? String(avatarUpdatedAt) : "";
  return `/uploads/avatars/${encodeURIComponent(fn)}?v=${encodeURIComponent(v)}`;
}

router.get("/public/users/:uid", (_req, res) => {
  const uidRaw = _req.params && _req.params.uid ? String(_req.params.uid) : "";
  const uid = Number(uidRaw);
  if (!Number.isFinite(uid) || uid <= 0) return res.status(400).json({ error: "invalid_uid" });

  const user = db
    .prepare(
      `
      SELECT
        u.uid,
        u.display_name,
        u.role,
        u.banned,
        ua.avatar_filename,
        ua.updated_at AS avatar_updated_at
      FROM users u
      LEFT JOIN user_avatars ua ON ua.uid = u.uid
      WHERE u.uid = ?
    `
    )
    .get(uid);

  if (!user || user.banned) return res.status(404).json({ error: "not_found" });

  return res.json({
    uid: user.uid,
    displayName: user.display_name,
    role: user.role,
    avatar_url: avatarUrl(user.avatar_filename, user.avatar_updated_at),
  });
});

module.exports = router;

