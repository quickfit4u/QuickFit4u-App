const express = require('express');
const { v4: uuid } = require('uuid');
const QRCode = require('qrcode');
const db = require('../lib/db');
const { notify } = require('../lib/notify');
const { sendBookingQrEmail } = require('../lib/mailer');
const { requireAuth, requireRole } = require('../middleware/auth');
const razorpay = require('../lib/razorpay');
const { todayIST, endOfDayIST } = require('../lib/date');
const { signQrToken, verifyQrToken } = require('../lib/qrToken');

const router = express.Router();

const PENDING_PAYMENT_TTL_MINUTES = 15;

function generateBookingCode() {
  return 'FI-' + String(Math.floor(100000 + Math.random() * 900000));
}


function releaseStalePendingPayments() {
  const stale = db
    .prepare(
      `SELECT id, slot_id FROM bookings
       WHERE status = 'pending_payment' AND created_at < datetime('now', '-${PENDING_PAYMENT_TTL_MINUTES} minutes')`
    )
    .all();

  for (const b of stale) {
    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(b.id);
    db.prepare('UPDATE gym_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?').run(b.slot_id);
  }
}

async function generateAndSendBookingQr(booking, gym, slot) {

  const expiresAt = endOfDayIST(slot.date).toISOString();
  const token = signQrToken({ bookingId: booking.id, gymId: gym.id, expiresAt });
  const qrPayload = JSON.stringify({
    app: 'QuickFit4u',
    type: 'booking',
    bookingId: booking.id,
    gymId: gym.id,
    expiresAt,
    token,
  });
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 400, margin: 1 });
  } catch (e) {
    console.error('Failed to generate booking QR:', e.message);
  }

  db.prepare(`UPDATE bookings SET qr_data_url = ? WHERE id = ?`).run(qrDataUrl, booking.id);

  if (qrDataUrl) {
    const member = db.prepare('SELECT email FROM users WHERE id = ?').get(booking.user_id);
    try {
      await sendBookingQrEmail(member.email, gym.name, slot.date, slot.hour_label, qrDataUrl);
    } catch (e) {
      console.error('Failed to email booking QR:', e.message);
    }
  }

  return qrDataUrl;
}


router.post('/create-order', requireAuth, requireRole('member'), async (req, res) => {
  const { slotId, note } = req.body || {};
  if (!slotId) return res.status(400).json({ error: 'slotId is required.' });

  releaseStalePendingPayments();

  const reserve = db.transaction((slotId, userId) => {
    const slot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(slotId);
    if (!slot) {
      const err = new Error('That slot no longer exists.');
      err.status = 404;
      throw err;
    }
    if (slot.booked_count >= slot.capacity) {
      const err = new Error('This slot is full. Try another time.');
      err.status = 409;
      throw err;
    }
    const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(slot.gym_id);
    if (!gym) {
      const err = new Error('Gym not found.');
      err.status = 404;
      throw err;
    }

    const bookingId = uuid();
    const bookingCode = generateBookingCode();
    const amount = gym.hourly_rate;

    db.prepare('UPDATE gym_slots SET booked_count = booked_count + 1 WHERE id = ?').run(slotId);
    db.prepare(
      `INSERT INTO bookings (id, user_id, gym_id, slot_id, booking_code, note, status, amount, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, 'unpaid')`
    ).run(bookingId, userId, slot.gym_id, slotId, bookingCode, note || null, amount);

    return { bookingId, bookingCode, slot, gym, amount };
  });

  let held;
  try {
    held = reserve(slotId, req.user.id);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Could not reserve this slot.' });
  }

  const { bookingId, bookingCode, slot, gym, amount } = held;

  try {
    const order = await razorpay.createOrder({
      amountRupees: amount,
      receipt: bookingId,
      notes: { bookingCode, gymName: gym.name, slot: `${slot.date} ${slot.hour_label}` },
    });

    db.prepare(`UPDATE bookings SET razorpay_order_id = ? WHERE id = ?`).run(order.id, bookingId);
    db.prepare(
      `INSERT INTO payments (id, booking_id, razorpay_order_id, amount, status) VALUES (?, ?, ?, ?, 'created')`
    ).run(uuid(), bookingId, order.id, amount);

    res.json({
      ok: true,
      bookingId,
      bookingCode,
      orderId: order.id,
      amount,
      currency: order.currency || 'INR',
      keyId: razorpay.KEY_ID,
      gymName: gym.name,
      gymArea: gym.area,
      gymCity: gym.city,
      date: slot.date,
      hour: slot.hour_label,
    });
  } catch (e) {
  
    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(bookingId);
    db.prepare('UPDATE gym_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?').run(slotId);
    res.status(e.status || 500).json({ error: e.message || 'Could not start payment. Try again.' });
  }
});


router.post('/verify-payment', requireAuth, requireRole('member'), async (req, res) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details.' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking || booking.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Booking not found.' });
  }
  if (booking.status !== 'pending_payment') {
    return res.status(409).json({ error: `This booking is already ${booking.status}.` });
  }
  if (booking.razorpay_order_id !== razorpay_order_id) {
    return res.status(400).json({ error: 'Order mismatch. Please try booking again.' });
  }

  const valid = razorpay.verifySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    db.prepare(
      `UPDATE payments SET status = 'failed', razorpay_payment_id = ?, razorpay_signature = ?, updated_at = datetime('now') WHERE booking_id = ?`
    ).run(razorpay_payment_id, razorpay_signature, bookingId);
    return res
      .status(400)
      .json({ error: 'Payment could not be verified. If money was deducted, it will be auto-refunded by Razorpay.' });
  }

  const slot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(booking.slot_id);
  const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(booking.gym_id);
  const member = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);

  db.prepare(
    `UPDATE bookings SET status = 'confirmed', payment_status = 'paid', razorpay_payment_id = ? WHERE id = ?`
  ).run(razorpay_payment_id, bookingId);
  db.prepare(
    `UPDATE payments SET status = 'paid', razorpay_payment_id = ?, razorpay_signature = ?, updated_at = datetime('now') WHERE booking_id = ?`
  ).run(razorpay_payment_id, razorpay_signature, bookingId);

  const qrDataUrl = await generateAndSendBookingQr(booking, gym, slot);

  notify({
    userId: gym.owner_id,
    type: 'booking_confirmed',
    title: 'New paid booking',
    body: `${member.name} booked and paid for ${slot.hour_label} on ${slot.date}${booking.note ? ` — “${booking.note}”` : ''}.`,
    bookingId,
  });

  res.json({
    ok: true,
    booking: {
      id: bookingId,
      bookingCode: booking.booking_code,
      gymName: gym.name,
      gymArea: gym.area,
      gymCity: gym.city,
      date: slot.date,
      hour: slot.hour_label,
      amount: booking.amount,
      status: 'confirmed',
      qrDataUrl,
    },
  });
});


router.post('/:id/cancel-pending-payment', requireAuth, requireRole('member'), (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking || booking.user_id !== req.user.id) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.status !== 'pending_payment') {
    return res.json({ ok: true }); 
  }

  db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(booking.id);
  db.prepare('UPDATE gym_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?').run(booking.slot_id);

  res.json({ ok: true });
});


router.post('/checkin', requireAuth, requireRole('member'), (req, res) => {
  const { gymId } = req.body || {};
  if (!gymId) return res.status(400).json({ error: 'gymId is required.' });

  const today = todayIST();
  const booking = db
    .prepare(
      `SELECT b.*, s.date, s.hour_label FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       WHERE b.user_id = ? AND b.gym_id = ? AND b.status = 'confirmed' AND s.date = ?
       ORDER BY s.hour_label LIMIT 1`
    )
    .get(req.user.id, gymId, today);

  if (!booking) {
    return res.status(404).json({ error: "No confirmed booking for today at this gym was found. If you already checked in, no need to scan again." });
  }

  db.prepare(`UPDATE bookings SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?`).run(booking.id);
  db.prepare(
    `INSERT INTO checkins (id, booking_id, checkin_status, method, staff_id) VALUES (?, ?, 'success', 'member_scanned_gym', ?)`
  ).run(uuid(), booking.id, req.user.id);

  res.json({ ok: true, message: `Checked in for ${booking.hour_label} today. Have a great workout!` });
});


router.post('/checkin-by-code', requireAuth, requireRole('member'), (req, res) => {
  const raw = (req.body && req.body.bookingCode) || '';
  const bookingCode = raw.trim().toUpperCase();
  if (!bookingCode) return res.status(400).json({ error: 'Enter your booking code.' });

  const today = todayIST();
  const booking = db
    .prepare(
      `SELECT b.*, s.date, s.hour_label FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       WHERE b.user_id = ? AND b.booking_code = ? AND b.status = 'confirmed'`
    )
    .get(req.user.id, bookingCode);

  if (!booking) {
    return res.status(404).json({ error: "No confirmed booking with that code. If you already checked in, no need to do it again." });
  }
  if (booking.date !== today) {
    return res.status(409).json({ error: `This booking is for ${booking.date}, not today.` });
  }

  db.prepare(`UPDATE bookings SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?`).run(booking.id);
  db.prepare(
    `INSERT INTO checkins (id, booking_id, checkin_status, method, staff_id) VALUES (?, ?, 'success', 'member_manual_code', ?)`
  ).run(uuid(), booking.id, req.user.id);

  res.json({ ok: true, message: `Checked in for ${booking.hour_label} today. Have a great workout!` });
});


router.post('/owner-checkin', requireAuth, requireRole('owner'), (req, res) => {
  const { bookingId, gymId, expiresAt, token } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' });

 
  if (token && !verifyQrToken({ bookingId, gymId, expiresAt, token })) {
    return res.status(400).json({ error: 'This QR code is invalid or has expired. Ask the member to show a fresh booking QR.' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) return res.status(404).json({ error: 'That booking QR was not recognized.' });
  if (token && gymId && booking.gym_id !== gymId) {
    return res.status(400).json({ error: 'This QR code does not match this gym.' });
  }

  const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(booking.gym_id);
  if (!gym || gym.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'This booking is not for your gym.' });
  }
  if (booking.status === 'checked_in') {
    return res.status(409).json({ error: 'This member is already checked in.' });
  }
  if (booking.status !== 'confirmed') {
    return res.status(409).json({ error: `This booking is ${booking.status}, not confirmed — can't check in.` });
  }

  const slot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(booking.slot_id);
  const member = db.prepare('SELECT name FROM users WHERE id = ?').get(booking.user_id);

  db.prepare(`UPDATE bookings SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?`).run(booking.id);
  db.prepare(
    `INSERT INTO checkins (id, booking_id, checkin_status, method, staff_id) VALUES (?, ?, 'success', 'owner_scanned_member', ?)`
  ).run(uuid(), booking.id, req.user.id);

  res.json({
    ok: true,
    member: { name: member.name, date: slot.date, hour: slot.hour_label },
  });
});


router.post('/owner-checkin-by-code', requireAuth, requireRole('owner'), (req, res) => {
  const raw = (req.body && req.body.bookingCode) || '';
  const bookingCode = raw.trim().toUpperCase();
  if (!bookingCode) return res.status(400).json({ error: 'Enter a booking code.' });

  const booking = db.prepare('SELECT * FROM bookings WHERE booking_code = ?').get(bookingCode);
  if (!booking) return res.status(404).json({ error: 'No booking found with that code. Double-check it with the member.' });

  const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(booking.gym_id);
  if (!gym || gym.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'This booking is not for your gym.' });
  }
  if (booking.status === 'checked_in') {
    return res.status(409).json({ error: 'This member is already checked in.' });
  }
  if (booking.status !== 'confirmed') {
    return res.status(409).json({ error: `This booking is ${booking.status}, not confirmed — can't check in.` });
  }

  const slot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(booking.slot_id);
  const member = db.prepare('SELECT name FROM users WHERE id = ?').get(booking.user_id);

  db.prepare(`UPDATE bookings SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?`).run(booking.id);
  db.prepare(
    `INSERT INTO checkins (id, booking_id, checkin_status, method, staff_id) VALUES (?, ?, 'success', 'owner_manual_code', ?)`
  ).run(uuid(), booking.id, req.user.id);

  res.json({
    ok: true,
    member: { name: member.name, date: slot.date, hour: slot.hour_label },
  });
});


router.put('/:id/reschedule', requireAuth, requireRole('member'), (req, res) => {
  const { newSlotId, note } = req.body || {};
  if (!newSlotId) return res.status(400).json({ error: 'newSlotId is required.' });

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ error: 'This is not your booking.' });
  }
  if (booking.status !== 'confirmed') {
    return res.status(409).json({ error: `A ${booking.status} booking can't be rescheduled.` });
  }
  if (booking.reschedule_slot_id) {
    return res.status(409).json({ error: 'You already have a reschedule request pending for this booking.' });
  }
  if (newSlotId === booking.slot_id) {
    return res.status(400).json({ error: 'That is already your booked time.' });
  }

  const requestReschedule = db.transaction(() => {
    const newSlot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(newSlotId);
    if (!newSlot) {
      const err = new Error('That slot no longer exists.');
      err.status = 404;
      throw err;
    }
    if (newSlot.gym_id !== booking.gym_id) {
      const err = new Error('You can only reschedule within the same gym.');
      err.status = 400;
      throw err;
    }
    if (newSlot.booked_count >= newSlot.capacity) {
      const err = new Error('That slot is full. Try another time.');
      err.status = 409;
      throw err;
    }


    db.prepare('UPDATE gym_slots SET booked_count = booked_count + 1 WHERE id = ?').run(newSlotId);
    db.prepare(`UPDATE bookings SET reschedule_slot_id = ?, reschedule_note = ? WHERE id = ?`).run(
      newSlotId,
      note || null,
      booking.id
    );

    return newSlot;
  });

  try {
    const newSlot = requestReschedule();
    const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(booking.gym_id);
    const member = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);

    notify({
      userId: gym.owner_id,
      type: 'reschedule_requested',
      title: 'Reschedule request',
      body: `${member.name} asked to move their ${booking.booking_code} booking to ${newSlot.hour_label} on ${newSlot.date}${note ? ` — “${note}”` : ''}.`,
      bookingId: booking.id,
    });

    res.json({ ok: true, bookingId: booking.id, requestedDate: newSlot.date, requestedHour: newSlot.hour_label });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Could not request the reschedule.' });
  }
});

//owner accept request
router.post('/:id/accept-reschedule', requireAuth, requireRole('owner'), (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(booking.gym_id);
  if (!gym || gym.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'This booking is not for your gym.' });
  }
  if (!booking.reschedule_slot_id) {
    return res.status(409).json({ error: 'There is no pending reschedule request on this booking.' });
  }

  const accept = db.transaction(() => {
    db.prepare('UPDATE gym_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?').run(booking.slot_id);
    db.prepare(
      `UPDATE bookings SET slot_id = ?, reschedule_slot_id = NULL, reschedule_note = NULL WHERE id = ?`
    ).run(booking.reschedule_slot_id, booking.id);
  });
  accept();

  const newSlot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(booking.reschedule_slot_id);

  notify({
    userId: booking.user_id,
    type: 'reschedule_accepted',
    title: 'Reschedule confirmed ✅',
    body: `${gym.name} moved your booking to ${newSlot.hour_label} on ${newSlot.date}. Same QR still works.`,
    bookingId: booking.id,
  });

  res.json({ ok: true });
});

//owner decline request
router.post('/:id/reject-reschedule', requireAuth, requireRole('owner'), (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(booking.gym_id);
  if (!gym || gym.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'This booking is not for your gym.' });
  }
  if (!booking.reschedule_slot_id) {
    return res.status(409).json({ error: 'There is no pending reschedule request on this booking.' });
  }

  const reject = db.transaction(() => {
    db.prepare('UPDATE gym_slots SET booked_count = MAX(0, booked_count - 1) WHERE id = ?').run(
      booking.reschedule_slot_id
    );
    db.prepare(`UPDATE bookings SET reschedule_slot_id = NULL, reschedule_note = NULL WHERE id = ?`).run(booking.id);
  });
  reject();

  const originalSlot = db.prepare('SELECT * FROM gym_slots WHERE id = ?').get(booking.slot_id);

  notify({
    userId: booking.user_id,
    type: 'reschedule_rejected',
    title: 'Reschedule declined',
    body: `${gym.name} couldn't move your booking — your original slot on ${originalSlot.date} at ${originalSlot.hour_label} still stands.`,
    bookingId: booking.id,
  });

  res.json({ ok: true });
});


router.get('/requests', requireAuth, requireRole('owner'), (req, res) => {
  const gym = db.prepare('SELECT id FROM gyms WHERE owner_id = ?').get(req.user.id);
  if (!gym) return res.json({ requests: [] });

  const rows = db
    .prepare(
      `SELECT b.id, b.booking_code, b.reschedule_note, b.created_at,
              orig.date AS orig_date, orig.hour_label AS orig_hour,
              reqd.date AS req_date, reqd.hour_label AS req_hour,
              u.name AS customer_name, u.email AS customer_email
       FROM bookings b
       JOIN gym_slots orig ON orig.id = b.slot_id
       JOIN gym_slots reqd ON reqd.id = b.reschedule_slot_id
       JOIN users u ON u.id = b.user_id
       WHERE b.gym_id = ? AND b.reschedule_slot_id IS NOT NULL
       ORDER BY b.created_at DESC`
    )
    .all(gym.id);

  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      note: r.reschedule_note,
      originalDate: r.orig_date,
      originalHour: r.orig_hour,
      requestedDate: r.req_date,
      requestedHour: r.req_hour,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      createdAt: r.created_at,
    })),
  });
});


router.get('/me', requireAuth, requireRole('member'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.booking_code, b.status, b.note, b.created_at, b.qr_data_url, b.checked_in_at,
              b.amount, b.payment_status, b.reschedule_slot_id, b.reschedule_note,
              s.date, s.hour_label,
              rs.date AS resched_date, rs.hour_label AS resched_hour,
              g.id AS gym_id, g.name AS gym_name, g.area AS gym_area, g.city AS gym_city
       FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       LEFT JOIN gym_slots rs ON rs.id = b.reschedule_slot_id
       JOIN gyms g ON g.id = b.gym_id
       WHERE b.user_id = ? AND b.status != 'pending_payment'
       ORDER BY b.created_at DESC`
    )
    .all(req.user.id);

  res.json({
    bookings: rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      status: r.status,
      note: r.note,
      date: r.date,
      hour: r.hour_label,
      gymId: r.gym_id,
      gymName: r.gym_name,
      gymArea: r.gym_area,
      gymCity: r.gym_city,
      qrDataUrl: r.qr_data_url,
      checkedInAt: r.checked_in_at,
      createdAt: r.created_at,
      amount: r.amount,
      paymentStatus: r.payment_status,
      rescheduleRequested: !!r.reschedule_slot_id,
      rescheduleNote: r.reschedule_note,
      rescheduleDate: r.resched_date,
      rescheduleHour: r.resched_hour,
    })),
  });
});

module.exports = router;
