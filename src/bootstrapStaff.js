// Creates staff accounts from environment variables when the server starts. This lets you set up
// staff on a host where you can't run commands (for example Railway's website).
//
//   STAFF_1_NAME, STAFF_1_EMAIL, STAFF_1_PASSWORD
//   STAFF_2_NAME, STAFF_2_EMAIL, STAFF_2_PASSWORD   (optional, for the social prefect)
//
// Safe to leave in place: an account that already exists is never overwritten, and a regular
// student account with that email is promoted to staff. Once the accounts exist you can delete the
// PASSWORD variables.
const bcrypt = require('bcryptjs');
const db = require('./db');

function bootstrapStaff() {
  for (const n of [1, 2]) {
    const name = (process.env[`STAFF_${n}_NAME`] || '').trim();
    const email = (process.env[`STAFF_${n}_EMAIL`] || '').trim().toLowerCase();
    const password = process.env[`STAFF_${n}_PASSWORD`] || '';
    if (!email) continue;

    const existing = db.prepare('SELECT id, role FROM users WHERE school_email = ?').get(email);
    if (existing) {
      if (existing.role !== 'staff') {
        db.prepare(`UPDATE users SET role = 'staff' WHERE id = ?`).run(existing.id);
        console.log(`Staff setup: promoted existing account ${email} to staff.`);
      }
      continue;
    }

    if (!name || password.length < 8) {
      console.error(`Staff setup: STAFF_${n} needs a NAME and a PASSWORD of at least 8 characters. Skipped.`);
      continue;
    }
    db.prepare(
      `INSERT INTO users (full_name, school_email, password_hash, role) VALUES (?, ?, ?, 'staff')`
    ).run(name, email, bcrypt.hashSync(password, 12));
    console.log(`Staff setup: created staff account ${email}.`);
  }
}

module.exports = bootstrapStaff;
