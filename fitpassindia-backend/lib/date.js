// India is UTC+5:30, and doesn't observe daylight saving, so this offset is
// fixed year-round. The server itself might run in UTC (or any other
// timezone) depending on where it's hosted — using `new Date()` directly
// would compute the wrong calendar day for roughly the first 5.5 hours of
// every IST day. Every place that needs "today" for date-matching (check-in,
// today's bookings, etc.) should go through this instead.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST() {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// Builds the actual UTC instant a slot starts at, given its 'YYYY-MM-DD' date
// and a parsed { hour, minute } (24h, IST). Returns null if parsing failed.
function slotStartUTC(dateStr, parsedHour) {
  if (!dateStr || !parsedHour) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  // Treat y/m/d + hour/minute as IST wall-clock time, then convert to the
  // equivalent UTC instant by subtracting the IST offset.
  const asIfUTC = Date.UTC(y, m - 1, d, parsedHour.hour, parsedHour.minute, 0);
  return new Date(asIfUTC - IST_OFFSET_MS);
}

// The UTC instant corresponding to 23:59:59 IST on the given 'YYYY-MM-DD'
// date — used as a booking QR's expiry so it stops working the day after
// the slot it was issued for.
function endOfDayIST(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const asIfUTC = Date.UTC(y, m - 1, d, 23, 59, 59);
  return new Date(asIfUTC - IST_OFFSET_MS);
}

module.exports = { todayIST, slotStartUTC, endOfDayIST };