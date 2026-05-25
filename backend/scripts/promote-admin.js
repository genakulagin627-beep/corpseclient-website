require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { db, initDb } = require("../src/db");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/promote-admin.js <email>");
  process.exit(2);
}

initDb();
const res = db.prepare("UPDATE users SET role = 'admin', banned = 0 WHERE lower(email) = lower(?)").run(email);
if (!res.changes) {
  console.error("User not found:", email);
  process.exit(1);
}

const row = db.prepare("SELECT uid,email,role,banned FROM users WHERE lower(email)=lower(?)").get(email);
console.log("Promoted:", row);
