require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { db, initDb } = require("../src/db");

initDb();
db.prepare("UPDATE users SET banned = 0").run();
db.prepare("UPDATE users SET role = ? WHERE lower(email) = lower(?)").run(
  "admin",
  "admin@inprotect.local"
);

const rows = db.prepare("SELECT uid, email, role, banned FROM users ORDER BY uid").all();
console.log(JSON.stringify(rows, null, 2));
