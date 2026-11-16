// Creates (or promotes) a staff account. Staff can access the dedication panel.
//
// Usage:
//   npm run create-staff -- "Full Name" email@school.edu password
//
// If the email already exists, that account is promoted to staff and its password is reset.
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const [fullName, emailArg, password] = process.argv.slice(2);

if (!fullName || !emailArg || !password) {
  console.error('Usage: npm run create-staff -- "Full Name" email@school.edu password');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const hash = bcrypt.hashSync(password, 12);
const existing = db.prepare('SELECT id FROM users WHERE school_email = ?').get(email);

if (existing) {
  db.prepare(`UPDATE users SET role = 'staff', password_hash = ?, full_name = ? WHERE id = ?`).run(
    hash,
    fullName,
    existing.id
  );
  console.log(`Promoted existing account to staff: ${email}`);
} else {
  db.prepare(
    `INSERT INTO users (full_name, school_email, password_hash, role) VALUES (?, ?, ?, 'staff')`
  ).run(fullName, email, hash);
  console.log(`Created staff account: ${email}`);
}
