const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { sendComplaintEmail, sendComplaintReceivedEmail } = require('../lib/mailer');

const router = express.Router();

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.SMTP_USER;
const CATEGORIES = ['booking', 'payment', 'gym', 'app', 'other'];

// ---------- Member / owner: submit a complaint or feedback ----------
router.post('/', requireAuth, async (req, res) => {
  const { subject, message, category, gymId, bookingId } = req.body || {};

  if (!subject || !subject.trim()) return res.status(400).json({ error: 'Please add a subject.' });
  if (!message || !message.trim()) return res.status(400).json({ error: 'Please describe the issue.' });
  if (!['member', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only members and gym owners can submit feedback here.' });
  }

  const cat = CATEGORIES.includes(category) ? category : 'other';
  const id = uuid();

  const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);
  let gymName = null;
  if (gymId) {
    const gym = db.prepare('SELECT name FROM gyms WHERE id = ?').get(gymId);
    gymName = gym?.name || null;
  }
  let bookingCode = null;
  if (bookingId) {
    const booking = db.prepare('SELECT booking_code FROM bookings WHERE id = ?').get(bookingId);
    bookingCode = booking?.booking_code || null;
  }

  db.prepare(
    `INSERT INTO complaints (id, user_id, role, category, subject, message, gym_id, booking_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, req.user.role, cat, subject.trim(), message.trim(), gymId || null, bookingId || null);

  let emailSent = false;
  try {
    if (SUPPORT_EMAIL) {
      await sendComplaintEmail({
        toEmail: SUPPORT_EMAIL,
        name: user.name,
        email: user.email,
        role: req.user.role,
        category: cat,
        subject: subject.trim(),
        message: message.trim(),
        gymName,
        bookingCode,
      });
      emailSent = true;
    }
    // Best-effort confirmation to the sender — never blocks/fails the request.
    sendComplaintReceivedEmail(user.email, user.name, subject.trim()).catch(() => {});
  } catch (e) {
    console.error('Failed to send complaint email (non-fatal):', e.message);
  }

  if (emailSent) db.prepare('UPDATE complaints SET email_sent = 1 WHERE id = ?').run(id);

  res.json({ ok: true, id, emailSent });
});

// ---------- Member / owner: view their own submitted complaints ----------
router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user.id);

  res.json({
    complaints: rows.map((c) => ({
      id: c.id,
      category: c.category,
      subject: c.subject,
      message: c.message,
      status: c.status,
      adminNote: c.admin_note,
      createdAt: c.created_at,
    })),
  });
});

module.exports = router;
