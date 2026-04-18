const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "users.json");

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function findUserByEmail(email) {
  const db = readDb();
  return db.users.find((user) => user.email === email.toLowerCase()) || null;
}

function createUser(user) {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

module.exports = {
  findUserByEmail,
  createUser,
};
