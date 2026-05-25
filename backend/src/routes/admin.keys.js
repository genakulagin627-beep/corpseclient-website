const express = require("express");
const crypto = require("crypto");
const { db } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const keys = db
    .prepare(
      `SELECT code, duration_minutes, created_at, used_at, used_by_uid
       FROM license_keys ORDER BY id DESC LIMIT ?`
    )
    .all(limit)
    .map((k) => ({ ...k, duration_label: `${k.duration_minutes} мин.` }));
  return res.json({ keys });
});

router.post("/", (req, res) => {
  const b = req.body || {};
  const days = Math.max(parseInt(b.duration_days, 10) || 0, 0);
  const hours = Math.max(parseInt(b.duration_hours, 10) || 0, 0);
  const mins = Math.max(parseInt(b.duration_minutes, 10) || 0, 0);
  const count = Math.min(Math.max(parseInt(b.count, 10) || 1, 1), 50);
  const totalMins = days * 1440 + hours * 60 + mins;
  if (totalMins < 1) return res.status(400).json({ error: "bad_duration" });

  const stmt = db.prepare(
    "INSERT INTO license_keys (code, duration_minutes, created_at) VALUES (?, ?, ?)"
  );
  const now = new Date().toISOString();
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const code = crypto.randomBytes(10).toString("hex").toUpperCase();
    stmt.run(code, totalMins, now);
    created.push({ code });
  }
  return res.status(201).json({ keys: created });
});

module.exports = router;
