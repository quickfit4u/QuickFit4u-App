const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'fitpassindia.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // safe for concurrent reads/writes, unlike a plain JSON file

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('member', 'owner')),
    referred_by TEXT,               -- referral code entered at signup (owners only, optional)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login')),
    pending_name TEXT,               -- name given at signup, applied once OTP is verified
    pending_role TEXT,                -- role given at signup
    pending_referred_by TEXT,          -- referral code given at signup
    expires_at TEXT NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gyms (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    area TEXT,
    city TEXT,
    description TEXT,
    tags TEXT NOT NULL DEFAULT '[]',     -- JSON array, e.g. ["Free Weights","AC"]
    photos TEXT NOT NULL DEFAULT '[]',    -- JSON array of photo URLs
    hourly_rate INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gym_slots (
    id TEXT PRIMARY KEY,
    gym_id TEXT NOT NULL REFERENCES gyms(id),
    date TEXT NOT NULL,        -- 'YYYY-MM-DD'
    hour_label TEXT NOT NULL,   -- e.g. '6 AM'
    capacity INTEGER NOT NULL DEFAULT 1,
    booked_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(gym_id, date, hour_label)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    gym_id TEXT NOT NULL REFERENCES gyms(id),
    slot_id TEXT NOT NULL REFERENCES gym_slots(id),
    booking_code TEXT NOT NULL UNIQUE,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'checked_in', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    gym_id TEXT NOT NULL REFERENCES gyms(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),  -- who receives this notification
    type TEXT NOT NULL,                           -- 'booking_requested' | 'booking_confirmed' | 'booking_rejected'
    title TEXT NOT NULL,
    body TEXT,
    booking_id TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    checkin_time TEXT NOT NULL DEFAULT (datetime('now')),
    checkin_status TEXT NOT NULL DEFAULT 'success' CHECK (checkin_status IN ('success', 'failed')),
    method TEXT NOT NULL CHECK (method IN ('member_scanned_gym', 'owner_scanned_member')),
    staff_id TEXT REFERENCES users(id)   -- who performed the scan (owner, or the member themself)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount INTEGER NOT NULL,               -- rupees
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );
`);

module.exports = db;

// ---- Migration: bookings.qr_data_url — the per-booking QR (generated once
// the owner confirms), emailed to the member as proof of booking. ----
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN qr_data_url TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN checked_in_at TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: bookings.status needs to allow 'pending' and 'rejected' too,
// and a `note` column for the member's time preference. SQLite can't alter a
// CHECK constraint or add a column mid-table easily, so we rename + recreate
// + copy rows across — this preserves all existing bookings. ----
const bookingsInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'`).get();
if (bookingsInfo && !bookingsInfo.sql.includes("'pending'")) {
  // IMPORTANT: build the replacement as bookings_new, copy data, DROP the
  // original, THEN rename bookings_new -> bookings. Renaming the ORIGINAL
  // table (bookings -> bookings_old) instead would make SQLite (>=3.25)
  // silently rewrite every other table's "REFERENCES bookings(id)" clause
  // to "REFERENCES bookings_old(id)" — which then breaks the moment
  // bookings_old is dropped ("no such table: bookings_old"). Building the
  // replacement under a new name and renaming IT into place at the end
  // sidesteps this entirely, since nothing ever references "bookings_new".
  // Also drop FK enforcement for this migration: DROP TABLE bookings would
  // otherwise fail outright ("FOREIGN KEY constraint failed") the moment any
  // other row (checkins, payments, etc.) points at it while foreign_keys=ON.
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE bookings_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      gym_id TEXT NOT NULL REFERENCES gyms(id),
      slot_id TEXT NOT NULL REFERENCES gym_slots(id),
      booking_code TEXT NOT NULL UNIQUE,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'checked_in', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO bookings_new (id, user_id, gym_id, slot_id, booking_code, status, created_at)
      SELECT id, user_id, gym_id, slot_id, booking_code, status, created_at FROM bookings;

    DROP TABLE bookings;
    ALTER TABLE bookings_new RENAME TO bookings;
  `);
  db.pragma('foreign_keys = ON');
}

// ---- Migration: add lat/lng to gyms if this is an existing database from before ----
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN latitude REAL`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN longitude REAL`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN agreement_signed_at TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN agreement_signed_name TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN agreement_signature_url TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN qr_data_url TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: add password_hash to users (added when login switched from
// OTP-every-time to password + OTP-only-at-signup/reset) ----
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: add personal profile fields to users (phone, gender,
// address, avatar_url) — filled in from the app's Profile screen. ----
try {
  db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN gender TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN address TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: users.push_token — Expo push token for the member/owner's
// device, set from routes/auth.js and read by lib/notify.js on every
// notify() call. Was referenced in both places but never had a column,
// which crashed notify() with "no such column: push_token" and, since
// notify() runs before res.json() in routes/bookings.js /verify-payment,
// silently killed the response before the booking QR reached the app. ----
try {
  db.exec(`ALTER TABLE users ADD COLUMN push_token TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: otp_codes.purpose needs to allow 'reset' in addition to
// 'signup'/'login'. SQLite can't alter a CHECK constraint in place, but OTP
// rows are short-lived (10 minute expiry) so it's safe to drop and recreate
// this table on existing dev databases. ----
const otpTableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='otp_codes'`).get();
if (otpTableInfo && !otpTableInfo.sql.includes("'reset'")) {
  db.exec(`DROP TABLE otp_codes`);
  db.exec(`
    CREATE TABLE otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login', 'reset')),
      pending_name TEXT,
      pending_role TEXT,
      pending_referred_by TEXT,
      expires_at TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ---- Migration: gyms.phone — the gym's own contact number, collected on
// the owner's gym profile screen but never had a column to land in. ----
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN phone TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: users.role needs to allow 'admin' in addition to
// 'member'/'owner'. SQLite can't alter a CHECK constraint in place, so we
// rename + recreate + copy rows across, same approach as the bookings
// migration above. This must run after every other users.* column migration
// so there's something to copy. ----
const usersInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
if (usersInfo && !usersInfo.sql.includes("'admin'")) {
  // Same FK-rewrite hazard as the bookings migration above — build the
  // replacement as users_new and rename it into place at the end, instead
  // of renaming the original users table away.
  // Same reasoning as the bookings migration — DROP TABLE users would fail
  // under FK enforcement while gyms.owner_id / bookings.user_id rows exist.
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member', 'owner', 'admin')),
      referred_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      password_hash TEXT,
      phone TEXT,
      gender TEXT,
      address TEXT,
      avatar_url TEXT
    );

    INSERT INTO users_new (id, email, name, role, referred_by, created_at, password_hash, phone, gender, address, avatar_url)
      SELECT id, email, name, role, referred_by, created_at, password_hash, phone, gender, address, avatar_url FROM users;

    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
  db.pragma('foreign_keys = ON');
}

// ---- Migration: bookings — payment fields, added when Razorpay was wired
// into the booking flow (pay-first, then auto-confirm). ----
for (const [col, def] of [
  ['amount', 'INTEGER'],
  ['payment_status', "TEXT NOT NULL DEFAULT 'unpaid'"],
  ['razorpay_order_id', 'TEXT'],
  ['razorpay_payment_id', 'TEXT'],
]) {
  try {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
}

// ---- Migration: bookings.status needs to allow 'pending_payment' — the
// hold state between "slot reserved, order created" and "payment verified".
// Same rename+recreate approach as the earlier bookings/users migrations
// above, since SQLite can't alter a CHECK constraint in place. ----
const bookingsInfo2 = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'`).get();
if (bookingsInfo2 && !bookingsInfo2.sql.includes("'pending_payment'")) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    CREATE TABLE bookings_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      gym_id TEXT NOT NULL REFERENCES gyms(id),
      slot_id TEXT NOT NULL REFERENCES gym_slots(id),
      booking_code TEXT NOT NULL UNIQUE,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'pending', 'confirmed', 'rejected', 'checked_in', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      qr_data_url TEXT,
      checked_in_at TEXT,
      amount INTEGER,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT
    );

    INSERT INTO bookings_new (id, user_id, gym_id, slot_id, booking_code, note, status, created_at, qr_data_url, checked_in_at, amount, payment_status, razorpay_order_id, razorpay_payment_id)
      SELECT id, user_id, gym_id, slot_id, booking_code, note, status, created_at, qr_data_url, checked_in_at, amount, payment_status, razorpay_order_id, razorpay_payment_id FROM bookings;

    DROP TABLE bookings;
    ALTER TABLE bookings_new RENAME TO bookings;
  `);
  db.pragma('foreign_keys = ON');
}

// ---- Migration: bookings — reschedule request fields. A confirmed booking
// keeps its ORIGINAL slot_id reserved the whole time; requesting a
// reschedule just holds a second slot (reschedule_slot_id) until the owner
// accepts (slot_id swaps to it) or rejects (the held slot is freed, nothing
// else changes — no refund needed since the original booking never moved). ----
for (const [col, def] of [
  ['reschedule_slot_id', 'TEXT'],
  ['reschedule_note', 'TEXT'],
]) {
  try {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
}

// ---- Migration: additional member profile fields — date of birth, an
// emergency contact, a fitness goal, and an (optional) blood group. These
// are useful context for gyms (e.g. in a medical situation) and are filled
// in from the app's Profile screen alongside the existing fields. ----
try {
  db.exec(`ALTER TABLE users ADD COLUMN date_of_birth TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN emergency_contact TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN fitness_goal TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN blood_group TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: gyms.opening_hours / gyms.peak_hours — free-text fields
// the owner fills in on the gym profile screen (e.g. "6 AM - 10 PM" and
// "7-9 AM, 6-8 PM"), shown to members on the gym detail screen. ----
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN opening_hours TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN peak_hours TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: bookings — visit-reminder / rate-prompt tracking columns
// used by lib/scheduler.js's periodic scan, so a reminder or rate-nudge is
// never sent twice. Plain flag columns, no CHECK constraint involved, so a
// simple ALTER (no rename+recreate) is enough. ----
for (const [col, def] of [
  ['reminder_2h_sent', 'INTEGER NOT NULL DEFAULT 0'],
  ['reminder_30m_sent', 'INTEGER NOT NULL DEFAULT 0'],
  ['rate_prompt_sent', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  try {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
}

// ---- Migration: checkins.method needs to allow manual booking-code entry
// (owner_manual_code, member_manual_code) alongside QR scans — the reliable
// fallback for when camera scanning misbehaves (a known Expo Go
// limitation). SQLite can't alter a CHECK constraint in place, so rename +
// recreate + copy rows across, same approach used for users.role above. ----
const checkinsInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='checkins'`).get();
if (checkinsInfo && !checkinsInfo.sql.includes('owner_manual_code')) {
  db.exec(`
    ALTER TABLE checkins RENAME TO checkins_old;

    CREATE TABLE checkins (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id),
      checkin_time TEXT NOT NULL DEFAULT (datetime('now')),
      checkin_status TEXT NOT NULL DEFAULT 'success' CHECK (checkin_status IN ('success', 'failed')),
      method TEXT NOT NULL CHECK (method IN (
        'member_scanned_gym', 'owner_scanned_member', 'owner_manual_code', 'member_manual_code'
      )),
      staff_id TEXT REFERENCES users(id)
    );

    INSERT INTO checkins (id, booking_id, checkin_time, checkin_status, method, staff_id)
      SELECT id, booking_id, checkin_time, checkin_status, method, staff_id FROM checkins_old;

    DROP TABLE checkins_old;
  `);
}

// ---- Migration: gyms.suspended — an admin kill-switch that hides a gym
// from member search immediately, without deleting it. Referenced all over
// routes/admin.js (dashboard stats, gym list filter, suspend toggle) but
// the column itself was never added here — that's what was throwing
// "no such column: suspended" on the admin dashboard. ----
try {
  db.exec(`ALTER TABLE gyms ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}

// ---- Migration: gyms — payout/bank fields (owner's payout method) and
// last_payout_at (used to calculate each gym's pending payout since their
// last settlement). Both used by routes/gyms.js (owner submits bank
// details) and routes/admin.js (Payouts page). ----
for (const [col, def] of [
  ['bank_account_holder', 'TEXT'],
  ['bank_account_number', 'TEXT'],
  ['bank_ifsc', 'TEXT'],
  ['bank_upi_id', 'TEXT'],
  ['bank_details_submitted_at', 'TEXT'],
  ['last_payout_at', 'TEXT'],
]) {
  try {
    db.exec(`ALTER TABLE gyms ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
}

// ---- Migration: payouts — one row per settled payout (admin manually
// marks a gym's pending amount as paid after actually transferring it).
// Referenced by routes/admin.js (GET /payouts/history, POST /:gymId/settle)
// but the table itself didn't exist yet. ----
db.exec(`
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    gym_id TEXT NOT NULL REFERENCES gyms(id),
    period_start TEXT,             -- last_payout_at at the time of this settlement (null = all-time)
    period_end TEXT NOT NULL,
    amount INTEGER NOT NULL,       -- paise, same unit as bookings.amount
    note TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---- Migration: admin_broadcasts — a log of notification blasts the admin
// has sent (to all users, members only, or owners only), shown on the
// Notifications admin page. Referenced by routes/admin.js but the table
// itself didn't exist yet. ----
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_broadcasts (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES users(id),
    audience TEXT NOT NULL CHECK (audience IN ('all', 'member', 'owner')),
    title TEXT NOT NULL,
    body TEXT,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);