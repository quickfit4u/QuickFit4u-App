const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications/me — newest first, plus an unread count for the bell badge
router.get('/me', requireAuth, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`)
    .all(req.user.id);

  const unreadCount = db
    .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0`)
    .get(req.user.id).c;

  res.json({
    unreadCount,
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      bookingId: n.booking_id,
      read: !!n.read,
      createdAt: n.created_at,
    })),
  });
});

// POST /api/notifications/read-all — mark everything as read (e.g. when the bell is opened)
router.post('/read-all', requireAuth, (req, res) => {
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(req.user.id);
  res.json({ ok: true });
});

// POST /api/notifications/:id/read — mark a single notification as read
router.post('/:id/read', requireAuth, (req, res) => {
  const n = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!n || n.user_id !== req.user.id) return res.status(404).json({ error: 'Notification not found.' });
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
