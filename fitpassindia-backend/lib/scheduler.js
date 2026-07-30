// A simple periodic job (no external queue/cron needed) that scans for
// bookings needing a time-based notification:
//   - "2 hours before" / "30 minutes before" reminders for confirmed,
//     not-yet-checked-in bookings today or tomorrow.
//   - "Rate the gym" nudge ~2 hours after a check-in.
//
// Each of these is marked sent on the booking row so a re-run of the scan
// (every SCAN_INTERVAL_MS) never double-sends it.
//
// Caveat: the reminder times depend on parsing the gym owner's free-text
// slot label (e.g. "6 AM") into an actual hour/minute — see lib/hourParser.js.
// Labels that don't match a recognizable format are silently skipped rather
// than guessed at.

const db = require('./db');
const { notify, NOTIFICATION_TYPES } = require('./notify');
const { todayIST, slotStartUTC } = require('./date');
const { parseHourLabel } = require('./hourParser');

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const RATE_PROMPT_DELAY_MS = 2 * 60 * 60 * 1000; // nudge 2h after check-in

function tomorrowIST() {
  const [y, m, d] = todayIST().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function sendVisitReminders() {
  const dates = [todayIST(), tomorrowIST()];
  const placeholders = dates.map(() => '?').join(',');

  const rows = db
    .prepare(
      `SELECT b.id, b.user_id, b.reminder_2h_sent, b.reminder_30m_sent,
              s.date, s.hour_label, g.name AS gym_name
       FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       JOIN gyms g ON g.id = b.gym_id
       WHERE b.status = 'confirmed' AND s.date IN (${placeholders})
         AND (b.reminder_2h_sent = 0 OR b.reminder_30m_sent = 0)`
    )
    .all(...dates);

  const now = Date.now();

  for (const r of rows) {
    const parsed = parseHourLabel(r.hour_label);
    const startsAt = slotStartUTC(r.date, parsed);
    if (!startsAt) continue; // couldn't parse this label — skip, don't guess

    const msUntil = startsAt.getTime() - now;

    if (!r.reminder_2h_sent && msUntil <= 2 * 60 * 60 * 1000 && msUntil > 90 * 60 * 1000) {
      notify({
        userId: r.user_id,
        type: NOTIFICATION_TYPES.REMINDER_2H,
        title: 'Gym in 2 hours',
        body: `Your slot at ${r.gym_name} is at ${r.hour_label} today. See you there!`,
        bookingId: r.id,
      });
      db.prepare('UPDATE bookings SET reminder_2h_sent = 1 WHERE id = ?').run(r.id);
    }

    if (!r.reminder_30m_sent && msUntil <= 30 * 60 * 1000 && msUntil > -5 * 60 * 1000) {
      notify({
        userId: r.user_id,
        type: NOTIFICATION_TYPES.REMINDER_30M,
        title: 'Gym in 30 minutes',
        body: `Your slot at ${r.gym_name} is at ${r.hour_label} — time to head over.`,
        bookingId: r.id,
      });
      db.prepare('UPDATE bookings SET reminder_30m_sent = 1 WHERE id = ?').run(r.id);
    }
  }
}

function sendRatePrompts() {
  const cutoff = new Date(Date.now() - RATE_PROMPT_DELAY_MS).toISOString().replace('T', ' ').slice(0, 19);
  const olderCutoff = new Date(Date.now() - RATE_PROMPT_DELAY_MS - 30 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const rows = db
    .prepare(
      `SELECT b.id, b.user_id, g.name AS gym_name
       FROM bookings b
       JOIN gyms g ON g.id = b.gym_id
       WHERE b.status = 'checked_in' AND b.rate_prompt_sent = 0
         AND b.checked_in_at <= ? AND b.checked_in_at > ?`
    )
    .all(cutoff, olderCutoff);

  for (const r of rows) {
    notify({
      userId: r.user_id,
      type: NOTIFICATION_TYPES.RATE_GYM,
      title: 'How was your workout?',
      body: `Rate your visit to ${r.gym_name} — it helps other members find the right gym.`,
      bookingId: r.id,
    });
    db.prepare('UPDATE bookings SET rate_prompt_sent = 1 WHERE id = ?').run(r.id);
  }
}

function runScan() {
  try {
    sendVisitReminders();
    sendRatePrompts();
  } catch (e) {
    console.error('Notification scheduler scan failed:', e.message || e);
  }
}

function startScheduler() {
  runScan(); // once on boot, then every interval
  setInterval(runScan, SCAN_INTERVAL_MS);
}

module.exports = { startScheduler };
