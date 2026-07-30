const { v4: uuid } = require('uuid');
const db = require('./db');

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS_PER_HOUR = 5; // basic rate limit against email-bombing

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function createOtp({ email, purpose, name, role, referredBy }) {
  const recentCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM otp_codes
       WHERE email = ? AND created_at > datetime('now', '-1 hour')`
    )
    .get(email).c;

  if (recentCount >= MAX_ATTEMPTS_PER_HOUR) {
    const err = new Error('Too many code requests. Please try again later.');
    err.status = 429;
    throw err;
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO otp_codes (id, email, code, purpose, pending_name, pending_role, pending_referred_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), email, code, purpose, name || null, role || null, referredBy || null, expiresAt);

  return code;
}

function verifyOtp({ email, code }) {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE email = ? AND code = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(email, code);

  if (!row) {
    const err = new Error('Incorrect code.');
    err.status = 400;
    throw err;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    const err = new Error('This code has expired. Request a new one.');
    err.status = 400;
    throw err;
  }

  db.prepare(`UPDATE otp_codes SET consumed = 1 WHERE id = ?`).run(row.id);

  return row; // caller uses row.purpose / pending_name / pending_role / pending_referred_by
}

module.exports = { createOtp, verifyOtp };
