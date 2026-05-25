const express = require("express");
const { db } = require("../db");

const router = express.Router();
const roles = new Set(["user", "admin", "youtube", "beta"]);
const protectedAdminEmail = String(process.env.ADMIN_EMAIL || "admin@inprotect.local").toLowerCase();

function isProtectedAdmin(user) {
  if (!user) return false;
  const email = String(user.email || "").toLowerCase();
  const name = String(user.display_name || "");
  return email === protectedAdminEmail || name === "Admin";
}

router.get("/", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const q = String(req.query.q || "").trim();
  const where = q ? "WHERE email LIKE @q OR display_name LIKE @q OR CAST(uid AS TEXT) LIKE @q" : "";
  const params = q ? { q: `%${q}%` } : {};
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users ${where}`).get(params).c;
  const users = db
    .prepare(
      `SELECT uid, email, display_name, role, banned, subscription_until, hwid AS hwid_linked, registered_at
       FROM users ${where} ORDER BY uid DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset })
    .map((u) => ({
      uid: u.uid,
      email: u.email,
      nickname: u.display_name,
      role: u.role,
      banned: !!u.banned,
      subscription_until: u.subscription_until,
      hwid_linked: !!u.hwid_linked,
      registered_at: u.registered_at,
    }));
  return res.json({ total, users });
});

router.patch("/:uid", (req, res) => {
  const uid = parseInt(req.params.uid, 10);
  if (!uid) return res.status(400).json({ error: "bad_uid" });
  const current = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid);
  if (!current) return res.status(404).json({ error: "not_found" });
  const body = req.body || {};
  const lockedAdmin = isProtectedAdmin(current);

  let role = current.role;
  let banned = current.banned ? 1 : 0;
  let subscription = current.subscription_until;
  let hwid = current.hwid;

  if (body.role != null) {
    const nextRole = String(body.role).toLowerCase();
    if (!roles.has(nextRole)) return res.status(400).json({ error: "bad_role" });
    if (lockedAdmin && nextRole !== "admin") {
      return res.status(403).json({ error: "protected_admin_role_locked" });
    }
    role = nextRole;
  }
  if (body.banned != null) {
    if (lockedAdmin && body.banned) {
      return res.status(403).json({ error: "protected_admin_ban_locked" });
    }
    banned = body.banned ? 1 : 0;
  }
  if (body.subscription_until !== undefined) subscription = body.subscription_until || null;
  if (body.reset_hwid && !lockedAdmin) hwid = null;

  db.prepare(
    "UPDATE users SET role = ?, banned = ?, subscription_until = ?, hwid = ? WHERE uid = ?"
  ).run(role, banned, subscription, hwid, uid);

  if (body.new_uid != null) {
    if (lockedAdmin) {
      return res.status(403).json({ error: "protected_admin_uid_locked" });
    }
    const newUid = parseInt(body.new_uid, 10);
    if (!newUid || newUid < 1 || newUid > 100000) return res.status(400).json({ error: "bad_new_uid" });
    const exists = db.prepare("SELECT uid FROM users WHERE uid = ?").get(newUid);
    if (exists) return res.status(400).json({ error: "uid_taken" });
    db.prepare("UPDATE users SET uid = ? WHERE uid = ?").run(newUid, uid);
  }

  return res.json({ ok: true });
});

router.delete("/:uid", (req, res) => {
  const uid = parseInt(req.params.uid, 10);
  if (!uid) return res.status(400).json({ error: "bad_uid" });
  const current = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid);
  if (!current) return res.status(404).json({ error: "not_found" });
  if (isProtectedAdmin(current)) {
    return res.status(403).json({ error: "protected_admin_delete_locked" });
  }
  const deleted = db.prepare("DELETE FROM users WHERE uid = ?").run(uid);
  if (!deleted.changes) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

module.exports = router;
