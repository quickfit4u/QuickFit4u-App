const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { todayIST } = require('../lib/date');
const { notify, notifyBroadcast, NOTIFICATION_TYPES } = require('../lib/notify');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));


function pendingPayoutFor(gymId, lastPayoutAt) {
  const row = lastPayoutAt
    ? db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM bookings
           WHERE gym_id = ? AND payment_status = 'paid' AND created_at > ?`
        )
        .get(gymId, lastPayoutAt)
    : db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM bookings WHERE gym_id = ? AND payment_status = 'paid'`)
        .get(gymId);
  return row.total || 0;
}

//dashboard stats
router.get('/stats', (req, res) => {
  const totalUsers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role != 'admin'`).get().c;
  const totalMembers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'member'`).get().c;
  const totalOwners = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'owner'`).get().c;
  const totalGyms = db.prepare(`SELECT COUNT(*) AS c FROM gyms`).get().c;
  const liveGyms = db.prepare(`SELECT COUNT(*) AS c FROM gyms WHERE agreement_signed_at IS NOT NULL AND suspended = 0`).get().c;
  const suspendedGyms = db.prepare(`SELECT COUNT(*) AS c FROM gyms WHERE suspended = 1`).get().c;
  const totalReviews = db.prepare(`SELECT COUNT(*) AS c FROM reviews`).get().c;

  const today = todayIST();
  const todaysBookings = db
    .prepare(
      `SELECT COUNT(*) AS c FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       WHERE s.date = ? AND b.status != 'cancelled'`
    )
    .get(today).c;

  res.json({
    totalUsers,
    totalMembers,
    totalOwners,
    totalGyms,
    liveGyms,
    pendingGyms: totalGyms - liveGyms - suspendedGyms,
    suspendedGyms,
    totalReviews,
    todaysBookings,
  });
});


router.get('/users', (req, res) => {
  const { role, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 30;

  let sql = `SELECT u.*, g.name AS gym_name, g.id AS gym_id FROM users u LEFT JOIN gyms g ON g.owner_id = u.id WHERE u.role != 'admin'`;
  const params = [];

  if (role && ['member', 'owner'].includes(role)) {
    sql += ` AND u.role = ?`;
    params.push(role);
  }
  if (search && search.trim()) {
    sql += ` AND (u.name LIKE ? COLLATE NOCASE OR u.email LIKE ? COLLATE NOCASE OR u.phone LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS c FROM (${sql})`).get(...params);
  sql += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, pageSize, (page - 1) * pageSize);

  res.json({
    total: countRow.c,
    page,
    pageSize,
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      gender: u.gender,
      address: u.address,
      gymId: u.gym_id,
      gymName: u.gym_name,
      createdAt: u.created_at,
    })),
  });
});


router.get('/gyms', (req, res) => {
  const { search, status } = req.query;
  let sql = `SELECT g.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone, u.referred_by AS owner_referred_by
             FROM gyms g JOIN users u ON u.id = g.owner_id WHERE 1=1`;
  const params = [];

  if (search && search.trim()) {
    sql += ` AND (g.name LIKE ? COLLATE NOCASE OR g.city LIKE ? COLLATE NOCASE OR u.name LIKE ? COLLATE NOCASE)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  if (status === 'live') sql += ` AND g.agreement_signed_at IS NOT NULL AND g.suspended = 0`;
  else if (status === 'pending') sql += ` AND g.agreement_signed_at IS NULL AND g.suspended = 0`;
  else if (status === 'suspended') sql += ` AND g.suspended = 1`;

  sql += ` ORDER BY g.created_at DESC`;
  const rows = db.prepare(sql).all(...params);

  const gyms = rows.map((row) => {
    const stats = db
      .prepare(`SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE gym_id = ?`)
      .get(row.id);
    const pendingPayout = pendingPayoutFor(row.id, row.last_payout_at);
    return {
      id: row.id,
      name: row.name,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      phone: row.phone || row.owner_phone,
      referredBy: row.owner_referred_by,
      area: row.area,
      city: row.city,
      address: [row.area, row.city].filter(Boolean).join(', '),
      openingHours: row.opening_hours,
      peakHours: row.peak_hours,
      hourlyRate: row.hourly_rate,
      facilities: JSON.parse(row.tags || '[]'),
      photos: JSON.parse(row.photos || '[]'),
      rating: stats.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null,
      reviewCount: stats.review_count,
      suspended: !!row.suspended,
      status: row.suspended ? 'suspended' : row.agreement_signed_at ? 'live' : 'pending',
      bankDetailsOnFile: !!row.bank_details_submitted_at,
      pendingPayoutRupees: Math.round(pendingPayout),
      createdAt: row.created_at,
    };
  });

  res.json({ gyms });
});


router.patch('/gyms/:id/suspend', (req, res) => {
  const gym = db.prepare('SELECT id FROM gyms WHERE id = ?').get(req.params.id);
  if (!gym) return res.status(404).json({ error: 'Gym not found.' });

  const suspended = req.body?.suspended ? 1 : 0;
  db.prepare('UPDATE gyms SET suspended = ? WHERE id = ?').run(suspended, gym.id);
  res.json({ ok: true, suspended: !!suspended });
});


router.get('/bookings', (req, res) => {
  const { date, status, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 30;

  let sql = `SELECT b.id, b.booking_code, b.status, b.created_at, s.date, s.hour_label,
                    g.name AS gym_name, u.name AS member_name, u.email AS member_email
             FROM bookings b
             JOIN gym_slots s ON s.id = b.slot_id
             JOIN gyms g ON g.id = b.gym_id
             JOIN users u ON u.id = b.user_id
             WHERE 1=1`;
  const params = [];

  if (date) {
    sql += ` AND s.date = ?`;
    params.push(date);
  }
  if (status && ['pending', 'confirmed', 'rejected', 'checked_in', 'cancelled'].includes(status)) {
    sql += ` AND b.status = ?`;
    params.push(status);
  }
  if (search && search.trim()) {
    sql += ` AND (g.name LIKE ? COLLATE NOCASE OR u.name LIKE ? COLLATE NOCASE OR b.booking_code LIKE ? COLLATE NOCASE)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS c FROM (${sql})`).get(...params);
  sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, pageSize, (page - 1) * pageSize);

  res.json({
    total: countRow.c,
    page,
    pageSize,
    bookings: rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      status: r.status,
      date: r.date,
      hourLabel: r.hour_label,
      gymName: r.gym_name,
      memberName: r.member_name,
      memberEmail: r.member_email,
      createdAt: r.created_at,
    })),
  });
});


// ---- Payments: platform-wide transaction log (every Razorpay attempt, not just settled payouts) ----
router.get('/payments', (req, res) => {
  const { date, status, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 30;

  let sql = `SELECT p.id, p.razorpay_order_id, p.razorpay_payment_id, p.amount, p.currency,
                    p.status, p.created_at, p.updated_at,
                    b.booking_code, g.name AS gym_name, u.name AS member_name, u.email AS member_email
             FROM payments p
             JOIN bookings b ON b.id = p.booking_id
             JOIN gyms g ON g.id = b.gym_id
             JOIN users u ON u.id = b.user_id
             WHERE 1=1`;
  const params = [];

  if (date) {
    sql += ` AND date(p.created_at) = ?`;
    params.push(date);
  }
  if (status && ['created', 'paid', 'failed'].includes(status)) {
    sql += ` AND p.status = ?`;
    params.push(status);
  }
  if (search && search.trim()) {
    sql += ` AND (g.name LIKE ? COLLATE NOCASE OR u.name LIKE ? COLLATE NOCASE OR b.booking_code LIKE ? COLLATE NOCASE OR p.razorpay_payment_id LIKE ? COLLATE NOCASE)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS c FROM (${sql})`).get(...params);

  sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, pageSize, (page - 1) * pageSize);

  // Separate, unfiltered totals so the summary cards stay stable while paging/searching.
  const paidTotal = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid'`).get().total;
  const paidCount = db.prepare(`SELECT COUNT(*) AS c FROM payments WHERE status = 'paid'`).get().c;
  const failedCount = db.prepare(`SELECT COUNT(*) AS c FROM payments WHERE status = 'failed'`).get().c;

  res.json({
    total: countRow.c,
    page,
    pageSize,
    summary: {
      totalCollectedRupees: Math.round(paidTotal),
      paidCount,
      failedCount,
    },
    payments: rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      gymName: r.gym_name,
      memberName: r.member_name,
      memberEmail: r.member_email,
      amountRupees: Math.round(r.amount),
      currency: r.currency,
      status: r.status,
      razorpayOrderId: r.razorpay_order_id,
      razorpayPaymentId: r.razorpay_payment_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});


// ---- Coupons: discount codes members can apply at checkout ----
router.get('/coupons', (req, res) => {
  const { search, status } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 30;

  let sql = `SELECT id, code, type, value, max_uses, used_count, active, expires_at, created_at FROM coupons WHERE 1=1`;
  const params = [];

  if (search && search.trim()) {
    sql += ` AND code LIKE ? COLLATE NOCASE`;
    params.push(`%${search.trim()}%`);
  }
  if (status === 'active') sql += ` AND active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  if (status === 'inactive') sql += ` AND active = 0`;
  if (status === 'expired') sql += ` AND expires_at IS NOT NULL AND expires_at <= datetime('now')`;

  const countRow = db.prepare(`SELECT COUNT(*) AS c FROM (${sql})`).get(...params);
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, pageSize, (page - 1) * pageSize);

  res.json({
    total: countRow.c,
    page,
    pageSize,
    coupons: rows.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      value: r.value,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      active: !!r.active,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    })),
  });
});

router.post('/coupons', (req, res) => {
  const { code, type, value, maxUses, expiresAt } = req.body || {};

  if (!code || !code.trim()) return res.status(400).json({ error: 'Code is required.' });
  if (!['percent', 'flat'].includes(type)) return res.status(400).json({ error: 'Type must be percent or flat.' });
  const numValue = Number(value);
  if (!Number.isFinite(numValue) || numValue <= 0) return res.status(400).json({ error: 'Value must be a positive number.' });
  if (type === 'percent' && numValue > 100) return res.status(400).json({ error: 'Percent value cannot exceed 100.' });

  const normalizedCode = code.trim().toUpperCase();
  const existing = db.prepare(`SELECT id FROM coupons WHERE code = ? COLLATE NOCASE`).get(normalizedCode);
  if (existing) return res.status(409).json({ error: 'A coupon with this code already exists.' });

  const id = uuid();
  db.prepare(
    `INSERT INTO coupons (id, code, type, value, max_uses, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, normalizedCode, type, numValue, maxUses ? Number(maxUses) : null, expiresAt || null, req.user.id);

  res.json({ ok: true, id });
});

router.patch('/coupons/:id', (req, res) => {
  const coupon = db.prepare(`SELECT id FROM coupons WHERE id = ?`).get(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });

  if (typeof req.body?.active === 'boolean') {
    db.prepare(`UPDATE coupons SET active = ? WHERE id = ?`).run(req.body.active ? 1 : 0, req.params.id);
  }
  res.json({ ok: true });
});

router.delete('/coupons/:id', (req, res) => {
  const coupon = db.prepare(`SELECT id FROM coupons WHERE id = ?`).get(req.params.id);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });

  db.prepare(`DELETE FROM coupons WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});


router.get('/bookings/today', (req, res) => {
  const date = req.query.date || todayIST();
  const rows = db
    .prepare(
      `SELECT b.id, b.booking_code, b.status, b.created_at, b.checked_in_at,
              s.hour_label, g.name AS gym_name, u.name AS member_name
       FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       JOIN gyms g ON g.id = b.gym_id
       JOIN users u ON u.id = b.user_id
       WHERE s.date = ?
       ORDER BY s.hour_label`
    )
    .all(date);

  res.json({
    date,
    bookings: rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      status: r.status,
      hourLabel: r.hour_label,
      gymName: r.gym_name,
      memberName: r.member_name,
      checkedInAt: r.checked_in_at,
    })),
  });
});


router.get('/reviews', (req, res) => {
  const { search } = req.query;
  let sql = `SELECT r.*, g.name AS gym_name, u.name AS member_name
             FROM reviews r JOIN gyms g ON g.id = r.gym_id JOIN users u ON u.id = r.user_id WHERE 1=1`;
  const params = [];
  if (search && search.trim()) {
    sql += ` AND (g.name LIKE ? COLLATE NOCASE OR u.name LIKE ? COLLATE NOCASE OR r.text LIKE ? COLLATE NOCASE)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  sql += ` ORDER BY r.created_at DESC LIMIT 200`;
  const rows = db.prepare(sql).all(...params);

  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      gymName: r.gym_name,
      memberName: r.member_name,
      createdAt: r.created_at,
    })),
  });
});

router.delete('/reviews/:id', (req, res) => {
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found.' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(review.id);
  res.json({ ok: true });
});


router.get('/analytics', (req, res) => {
  const bookingsByDay = db
    .prepare(
      `SELECT s.date AS day, COUNT(*) AS count
       FROM bookings b JOIN gym_slots s ON s.id = b.slot_id
       WHERE s.date >= date('now', '-13 days') AND b.status != 'cancelled'
       GROUP BY s.date ORDER BY s.date`
    )
    .all();

  const signupsByDay = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count
       FROM users WHERE role != 'admin' AND created_at >= datetime('now', '-13 days')
       GROUP BY date(created_at) ORDER BY day`
    )
    .all();

  const topGyms = db
    .prepare(
      `SELECT g.name, COUNT(*) AS bookingCount
       FROM bookings b JOIN gyms g ON g.id = b.gym_id
       WHERE b.status != 'cancelled'
       GROUP BY g.id ORDER BY bookingCount DESC LIMIT 5`
    )
    .all();

  res.json({ bookingsByDay, signupsByDay, topGyms });
});

//notifications
router.get('/notifications/sent', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM admin_broadcasts ORDER BY created_at DESC LIMIT 50`)
    .all();
  res.json({
    broadcasts: rows.map((b) => ({
      id: b.id,
      audience: b.audience,
      title: b.title,
      body: b.body,
      recipientCount: b.recipient_count,
      createdAt: b.created_at,
    })),
  });
});


router.post('/notifications/broadcast', (req, res) => {
  const { audience, title, body } = req.body || {};
  if (!['all', 'member', 'owner'].includes(audience)) {
    return res.status(400).json({ error: "audience must be 'all', 'member', or 'owner'." });
  }
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required.' });

  const recipients =
    audience === 'all'
      ? db.prepare(`SELECT id FROM users WHERE role IN ('member', 'owner')`).all()
      : db.prepare(`SELECT id FROM users WHERE role = ?`).all(audience);


  notifyBroadcast(
    recipients.map((r) => r.id),
    { title: title.trim(), body: body || null }
  );

  db.prepare(
    `INSERT INTO admin_broadcasts (id, admin_id, audience, title, body, recipient_count) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuid(), req.user.id, audience, title.trim(), body || null, recipients.length);

  res.json({ ok: true, recipientCount: recipients.length });
});

router.get('/payouts', (req, res) => {
  const gyms = db
    .prepare(
      `SELECT g.*, u.name AS owner_name, u.email AS owner_email
       FROM gyms g JOIN users u ON u.id = g.owner_id
       WHERE g.agreement_signed_at IS NOT NULL`
    )
    .all();

  const rows = gyms
    .map((g) => ({
      gymId: g.id,
      gymName: g.name,
      ownerName: g.owner_name,
      ownerEmail: g.owner_email,
      pendingRupees: Math.round(pendingPayoutFor(g.id, g.last_payout_at)),
      lastPayoutAt: g.last_payout_at,
      bankDetails: g.bank_details_submitted_at
        ? {
            accountHolder: g.bank_account_holder,
            accountNumber: g.bank_account_number,
            ifsc: g.bank_ifsc,
            upiId: g.bank_upi_id,
          }
        : null,
    }))
    .filter((g) => g.pendingRupees > 0)
    .sort((a, b) => b.pendingRupees - a.pendingRupees);

  res.json({ payouts: rows });
});


router.get('/payouts/history', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, g.name AS gym_name FROM payouts p JOIN gyms g ON g.id = p.gym_id
       ORDER BY p.created_at DESC LIMIT 100`
    )
    .all();
  res.json({
    payouts: rows.map((p) => ({
      id: p.id,
      gymName: p.gym_name,
      amountRupees: Math.round(p.amount),
      periodStart: p.period_start,
      periodEnd: p.period_end,
      note: p.note,
      createdAt: p.created_at,
    })),
  });
});


router.post('/payouts/:gymId/settle', (req, res) => {
  const gym = db.prepare('SELECT * FROM gyms WHERE id = ?').get(req.params.gymId);
  if (!gym) return res.status(404).json({ error: 'Gym not found.' });

  const pending = pendingPayoutFor(gym.id, gym.last_payout_at);
  if (pending <= 0) return res.status(400).json({ error: 'This gym has no pending payout.' });

  const now = new Date().toISOString();
  const settle = db.transaction(() => {
    db.prepare(
      `INSERT INTO payouts (id, gym_id, period_start, period_end, amount, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid(), gym.id, gym.last_payout_at, now, pending, req.body?.note || null, req.user.id);
    db.prepare('UPDATE gyms SET last_payout_at = ? WHERE id = ?').run(now, gym.id);
  });
  settle();

  notify({
    userId: gym.owner_id,
    type: NOTIFICATION_TYPES.PAYMENT_CREDITED,
    title: 'Payout settled',
    body: `₹${Math.round(pending)} has been sent for ${gym.name}.`,
  });

  res.json({ ok: true, amountRupees: Math.round(pending) });
});

module.exports = router;
