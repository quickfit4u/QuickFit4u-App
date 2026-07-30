const { v4: uuid } = require('uuid');
const db = require('./db');
const { sendExpoPush } = require('./push');

// The full notification taxonomy for the app. `type` isn't DB-enforced (see
// notifications table), but every notify() call should use one of these so
// the app's icon/label mapping and any future filtering stays consistent.
const NOTIFICATION_TYPES = {
  // ---- Member: before booking ----
  SLOT_AVAILABLE: 'slot_available',           // a full slot they were watching opened up

  // ---- Member: after booking ----
  PAYMENT_SUCCESS: 'payment_success',         // their payment went through
  QR_GENERATED: 'qr_generated',               // owner accepted — booking confirmed, QR ready

  // ---- Member: before visit ----
  REMINDER_2H: 'reminder_2h',
  REMINDER_30M: 'reminder_30m',

  // ---- Member: during visit ----
  CHECKIN_SUCCESSFUL: 'checkin_successful',

  // ---- Member: after visit ----
  RATE_GYM: 'rate_gym',

  // ---- Owner: partner side ----
  NEW_BOOKING: 'new_booking',                 // member requested a slot
  BOOKING_CANCELLED: 'booking_cancelled',      // member cancelled a pending/confirmed booking
  SLOT_CHANGE_REQUEST: 'slot_change_request',  // member asked to reschedule
  PAYMENT_RECEIVED: 'payment_received',        // bonus: owner sees the platform received payment (separate from PAYMENT_CREDITED, which is the payout to their bank)
  PAYMENT_CREDITED: 'payment_credited',        // payout settled to the owner — see routes/admin.js /payouts (manual settlement, no live bank-transfer API wired up)

  // ---- Shared / existing ----
  BOOKING_REJECTED: 'booking_rejected',
};

// Creates a notification row for a given user (the bell icon polls for
// these), AND — if that user has a registered device — sends a real push
// notification through Expo, so it still reaches them when the app isn't
// open. The push send is fire-and-forget: it never blocks or throws back
// into the caller, so a push-service hiccup can't break booking/checkin/etc.
function notify({ userId, type, title, body, bookingId = null }) {
  // notify() is called from the middle of request handlers (e.g. right after
  // a payment is verified, before the QR response is sent back) — it must
  // never throw, or it kills the response the caller was about to send.
  try {
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, booking_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), userId, type, title, body || null, bookingId);

    const user = db.prepare('SELECT push_token FROM users WHERE id = ?').get(userId);
    if (user?.push_token) {
      sendExpoPush([user.push_token], { title, body, data: { type, bookingId } }).catch(() => {});
    }
  } catch (e) {
    console.error('notify() failed (non-fatal):', e.message);
  }
}

// For admin broadcasts, which fan out to many users at once — batches the
// push sends instead of one notify() call (and thus one push request) per
// recipient.
function notifyBroadcast(userIds, { title, body }) {
  if (!userIds.length) return;

  try {
    const insertNotif = db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, 'admin_broadcast', ?, ?)`
    );
    const insertAll = db.transaction((ids) => {
      for (const id of ids) insertNotif.run(uuid(), id, title, body || null);
    });
    insertAll(userIds);

    const placeholders = userIds.map(() => '?').join(',');
    const tokens = db
      .prepare(`SELECT push_token FROM users WHERE id IN (${placeholders}) AND push_token IS NOT NULL`)
      .all(...userIds)
      .map((r) => r.push_token);
    sendExpoPush(tokens, { title, body, data: { type: 'admin_broadcast' } }).catch(() => {});
  } catch (e) {
    console.error('notifyBroadcast() failed (non-fatal):', e.message);
  }
}

module.exports = { notify, notifyBroadcast, NOTIFICATION_TYPES };
