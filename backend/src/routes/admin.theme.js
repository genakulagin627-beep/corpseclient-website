const express = require("express");
const { db } = require("../db");

const router = express.Router();

router.patch("/site-theme", (req, res) => {
  const { accent_dark, accent_light } = req.body || {};
  if (
    !/^#[0-9a-fA-F]{6}$/.test(String(accent_dark || "")) ||
    !/^#[0-9a-fA-F]{6}$/.test(String(accent_light || ""))
  ) {
    return res.status(400).json({ error: "bad_theme", hint: "Expected #RRGGBB colors." });
  }
  db.prepare("UPDATE site_theme SET accent_dark = ?, accent_light = ?, updated_at = ? WHERE id = 1").run(
    accent_dark,
    accent_light,
    new Date().toISOString()
  );
  return res.json({ ok: true });
});

module.exports = router;
