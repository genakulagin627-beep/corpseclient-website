const express = require("express");
const { db } = require("../db");

const router = express.Router();

router.get("/", (_req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const bannedUsers = db.prepare("SELECT COUNT(*) AS c FROM users WHERE banned = 1").get().c;
  const activeSubscriptions = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE subscription_until IS NOT NULL")
    .get().c;
  const keysTotal = db.prepare("SELECT COUNT(*) AS c FROM license_keys").get().c;
  const keysUsed = db.prepare("SELECT COUNT(*) AS c FROM license_keys WHERE used_at IS NOT NULL").get().c;
  const latestUsers = db
    .prepare(
      "SELECT uid, email, display_name, role, registered_at, subscription_until FROM users ORDER BY uid DESC LIMIT 5"
    )
    .all();
  const stats = db.prepare("SELECT launches, updates, last_update_at FROM app_stats WHERE id = 1").get();
  return res.json({
    users_total: users,
    banned_users: bannedUsers,
    active_subscriptions: activeSubscriptions,
    keys_total: keysTotal,
    keys_used: keysUsed,
    updates_total: stats ? stats.updates : 0,
    launches_total: stats ? stats.launches : 0,
    last_update_at: stats ? stats.last_update_at : null,
    launches_today: 0,
    latest_users: latestUsers,
  });
});

module.exports = router;
