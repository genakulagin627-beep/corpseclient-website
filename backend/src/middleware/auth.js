const jwt = require("jsonwebtoken");
const { db } = require("../db");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
    const user = db
      .prepare(
        `
        SELECT
          u.uid,
          u.email,
          u.display_name,
          u.role,
          u.banned,
          u.subscription_until,
          u.hwid,
          u.registered_at,
          ua.avatar_filename,
          ua.updated_at AS avatar_updated_at
        FROM users u
        LEFT JOIN user_avatars ua ON ua.uid = u.uid
        WHERE u.uid = ?
      `
      )
      .get(payload.uid);
    if (!user || user.banned) {
      return res.status(403).json({ error: "banned" });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

function adminRequired(req, res, next) {
  const strictAdminOnly = process.env.STRICT_ADMIN_ONLY === "1";
  if (!strictAdminOnly) {
    return next();
  }
  if (!req.user || String(req.user.role).toLowerCase() !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

module.exports = { authRequired, adminRequired };
