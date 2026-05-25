require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");
const { initDb, db } = require("./db");
const authRoutes = require("./routes/auth");
const publicUsersRoutes = require("./routes/public.users");
const adminUsersRoutes = require("./routes/admin.users");
const adminKeysRoutes = require("./routes/admin.keys");
const adminThemeRoutes = require("./routes/admin.theme");
const adminStatsRoutes = require("./routes/admin.stats");
const launcherRoutes = require("./routes/launcher");
const { authRequired, adminRequired } = require("./middleware/auth");

initDb();

const app = express();
const port = parseInt(process.env.PORT || process.env.API_PORT, 10) || 3000;
const siteRoot = path.resolve(__dirname, "..", "..");

const corsRaw = String(process.env.CORS_ORIGIN || "").trim();
const corsList = corsRaw
  ? corsRaw.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
app.use(
  cors(
    corsList && corsList.length
      ? {
          origin: corsList,
          credentials: true,
        }
      : {}
  )
);
app.use(express.json());
app.use(express.static(siteRoot));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", publicUsersRoutes);
app.get("/api/site/theme", (_req, res) => {
  const theme = db.prepare("SELECT accent_dark, accent_light FROM site_theme WHERE id = 1").get();
  return res.json(theme || { accent_dark: "#6b7bff", accent_light: "#4d5cff" });
});

app.use("/api/admin/users", authRequired, adminRequired, adminUsersRoutes);
app.use("/api/admin/keys", authRequired, adminRequired, adminKeysRoutes);
app.use("/api/admin", authRequired, adminRequired, adminThemeRoutes);
app.use("/api/admin/stats", authRequired, adminRequired, adminStatsRoutes);
app.use("/api/launcher", authRequired, launcherRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(siteRoot, "index.html"));
});

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Backend started on http://localhost:${port}`);
});

// IRC-like chat (global channel) over WebSocket.
// Client must connect with: ws://HOST/ws/chat?token=<JWT>
const wss = new WebSocketServer({ server, path: "/ws/chat" });
const clients = new Set();
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const MIN_MS_BETWEEN_MESSAGES = 350;
const MAX_MESSAGE_LEN = 400;
const HISTORY_LIMIT = 30;
const WS_OPEN = 1;

function avatarUrl(avatarFilename, avatarUpdatedAt) {
  if (!avatarFilename) return null;
  const fn = String(avatarFilename);
  const v = avatarUpdatedAt != null ? String(avatarUpdatedAt) : "";
  return `/uploads/avatars/${encodeURIComponent(fn)}?v=${encodeURIComponent(v)}`;
}

function getWsUser(uid) {
  const row = db
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
  if (!row || row.banned) return null;
  return {
    uid: row.uid,
    displayName: row.display_name,
    role: row.role,
    avatar_url: avatarUrl(row.avatar_filename, row.avatar_updated_at),
  };
}

function messageRowToPayload(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    user: {
      uid: row.uid,
      displayName: row.display_name,
      role: row.role,
      avatar_url: avatarUrl(row.avatar_filename, row.avatar_updated_at),
    },
    text: row.text,
  };
}

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === WS_OPEN) {
      ws.send(payload);
    }
  }
}

wss.on("connection", (ws, req) => {
  let token = null;
  try {
    const base = `http://${req.headers.host || "localhost"}`;
    const u = new URL(req.url, base);
    token = u.searchParams.get("token");
  } catch (_e) {}

  if (!token) {
    try {
      ws.close(4401, "missing_token");
    } catch (_e2) {}
    return;
  }

  let decoded = null;
  try {
    decoded = jwt.verify(String(token), SECRET);
  } catch (_e) {}

  const wsUser = decoded && decoded.uid != null ? getWsUser(Number(decoded.uid)) : null;
  if (!wsUser) {
    try {
      ws.close(4403, "unauthorized");
    } catch (_e2) {}
    return;
  }

  ws.user = wsUser;
  ws.lastMsgAt = 0;
  clients.add(ws);

  // Send recent history to the client.
  try {
    const rows = db
      .prepare(
        `
        SELECT
          cm.id,
          cm.uid,
          cm.text,
          cm.created_at,
          u.display_name,
          u.role,
          ua.avatar_filename,
          ua.updated_at AS avatar_updated_at
        FROM chat_messages cm
        JOIN users u ON u.uid = cm.uid
        LEFT JOIN user_avatars ua ON ua.uid = u.uid
        ORDER BY cm.id DESC
        LIMIT ?
      `
      )
      .all(HISTORY_LIMIT);
    const messages = rows.reverse().map(messageRowToPayload);
    ws.send(JSON.stringify({ type: "history", messages }));
  } catch (_e) {}

  ws.on("message", (buf) => {
    let data = null;
    try {
      data = JSON.parse(buf.toString("utf8"));
    } catch (_eJson) {
      return;
    }

    if (!data || data.type !== "message") return;

    const now = Date.now();
    if (ws.lastMsgAt && now - ws.lastMsgAt < MIN_MS_BETWEEN_MESSAGES) {
      return;
    }
    ws.lastMsgAt = now;

    const rawText = typeof data.text === "string" ? data.text : "";
    const text = rawText.trim().slice(0, MAX_MESSAGE_LEN);
    if (!text) return;

    try {
      const createdAt = new Date().toISOString();
      const info = db.prepare("INSERT INTO chat_messages (uid, text, created_at) VALUES (?, ?, ?)").run(ws.user.uid, text, createdAt);
      const id = info && info.lastInsertRowid != null ? info.lastInsertRowid : null;

      const freshUser = getWsUser(ws.user.uid);
      if (freshUser) ws.user = freshUser;

      const payload = {
        type: "message",
        id,
        createdAt,
        user: ws.user,
        text,
      };
      broadcast(payload);
    } catch (_eIns) {
      // ignore
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});
