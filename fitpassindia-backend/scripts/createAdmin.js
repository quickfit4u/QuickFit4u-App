

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');

const [, , email, password, name] = process.argv;

if (!email || !password) {
  console.log('Usage: node scripts/createAdmin.js <email> <password> [name]');
  process.exit(1);
}
if (password.length < 6) {
  console.log('Password must be at least 6 characters.');
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);

if (existing) {
  db.prepare('UPDATE users SET role = ?, password_hash = ? WHERE email = ?').run('admin', passwordHash, email);
  console.log(`Promoted existing account (${existing.role} -> admin): ${email}`);
} else {
  const id = uuid();
  db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, 'admin', ?)`
  ).run(id, email, name || 'Admin', passwordHash);
  console.log(`Created admin account: ${email}`);
}

console.log('Log in from the app with this email + password — the app will detect the admin role automatically.');
process.exit(0);
