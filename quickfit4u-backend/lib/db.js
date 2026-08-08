const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'quickfit4u.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); 

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

  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,             -- entered by member at checkout, case-insensitive
    type TEXT NOT NULL CHECK (type IN ('percent', 'flat')),
    value REAL NOT NULL,                   -- percent (0-100) or flat rupees off, depending on type
    max_uses INTEGER,                      -- NULL = unlimited
    used_count INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,                       -- NULL = never expires
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
  );
`);

module.exports = db;


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


const bookingsInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'`).get();
if (bookingsInfo && !bookingsInfo.sql.includes("'pending'")) {

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

try {
  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}


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


try {
  db.exec(`ALTER TABLE users ADD COLUMN push_token TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}


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


try {
  db.exec(`ALTER TABLE gyms ADD COLUMN phone TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}


const usersInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
if (usersInfo && !usersInfo.sql.includes("'admin'")) {
  
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


for (const [col, def] of [
  ['reminder_2h_sent', 'INTEGER NOT NULL DEFAULT 0'],
  ['reminder_30m_sent', 'INTEGER NOT NULL DEFAULT 0'],
  ['rate_prompt_sent', 'INTEGER NOT NULL DEFAULT 0'],
  ['coupon_code', 'TEXT'],
  ['discount_rupees', 'INTEGER NOT NULL DEFAULT 0'],
]) {
  try {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
}


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


try {
  db.exec(`ALTER TABLE gyms ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}


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


db.exec(`
  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('member', 'owner')),
    category TEXT NOT NULL DEFAULT 'other',   -- 'booking' | 'payment' | 'gym' | 'app' | 'other'
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    gym_id TEXT REFERENCES gyms(id),
    booking_id TEXT REFERENCES bookings(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    email_sent INTEGER NOT NULL DEFAULT 0,
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );
`);

try {
  db.exec(`ALTER TABLE complaints ADD COLUMN attachments TEXT`);
} catch (e) {
  if (!String(e.message).includes('duplicate column')) throw e;
}