const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const bcrypt = require("bcryptjs");

const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "app.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      banned INTEGER NOT NULL DEFAULT 0,
      subscription_until TEXT,
      hwid TEXT,
      registered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_avatars (
      uid INTEGER PRIMARY KEY,
      avatar_filename TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (uid) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS license_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      duration_minutes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      used_by_uid INTEGER,
      FOREIGN KEY (used_by_uid) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (uid) REFERENCES users(uid)
    );

    CREATE TABLE IF NOT EXISTS site_theme (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      accent_dark TEXT NOT NULL,
      accent_light TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      launches INTEGER NOT NULL DEFAULT 0,
      updates INTEGER NOT NULL DEFAULT 0,
      last_update_at TEXT
    );
  `);

  const now = new Date().toISOString();
  db.prepare(
    "INSERT OR IGNORE INTO site_theme (id, accent_dark, accent_light, updated_at) VALUES (1, ?, ?, ?)"
  ).run("#c084fc", "#9333ea", now);
  db.prepare(
    "INSERT OR IGNORE INTO app_stats (id, launches, updates, last_update_at) VALUES (1, 0, 0, ?)"
  ).run(now);

  const adminEmail = process.env.ADMIN_EMAIL || "admin@inprotect.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin12345";
  const adminName = process.env.ADMIN_NAME || "Admin";
  const adminExists = db.prepare("SELECT uid FROM users WHERE email = ?").get(adminEmail);
  if (!adminExists) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(
      "INSERT INTO users (email, password_hash, display_name, role, registered_at) VALUES (?, ?, ?, 'admin', ?)"
    ).run(adminEmail, hash, adminName, now);
  } else {
    db.prepare("UPDATE users SET role = 'admin', banned = 0 WHERE uid = ?").run(adminExists.uid);
  }
}

module.exports = { db, initDb };
