require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const bcrypt = require("bcryptjs");
const { db, initDb } = require("../src/db");

const email = process.argv[2] || "admin@corpseclient.local";
const password = process.argv[3] || "Corpse12345";
const name = process.argv[4] || "CorpseAdmin";

initDb();
const now = new Date().toISOString();
const exists = db.prepare("SELECT uid FROM users WHERE lower(email)=lower(?)").get(email);
if (exists) {
  db.prepare("UPDATE users SET role='admin', banned=0 WHERE uid=?").run(exists.uid);
  console.log("Admin already exists, ensured role=admin:", exists.uid, email);
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 10);
const r = db
  .prepare(
    "INSERT INTO users (email, password_hash, display_name, role, registered_at) VALUES (?, ?, ?, 'admin', ?)"
  )
  .run(email, hash, name, now);

console.log("Created admin:", { uid: r.lastInsertRowid, email, password });
