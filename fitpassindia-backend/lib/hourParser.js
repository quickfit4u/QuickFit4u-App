// Gym owners type the slot time as free text (e.g. "6 AM", "6:30 PM", "18:00")
// — there's no structured time field in the schema. To schedule "2 hours
// before" / "30 minutes before" reminders we need a real hour/minute, so this
// does a best-effort parse of the common formats. If a label doesn't match
// anything recognizable, it returns null and the scheduler just skips
// reminders for that slot rather than guessing wrong.
//
// Recognizes: "6 AM", "6AM", "6:30 PM", "6:30PM", "18:00", "6-7 AM" (takes
// the start time), "6 to 7 PM" (same).
function parseHourLabel(label) {
  if (!label) return null;
  const text = String(label).trim().toLowerCase();

  // "6:30 am", "6:30am", "6 am", "6am"
  let m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const period = m[3];
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (period === 'am') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return { hour, minute };
  }

  // "6-7 am", "6 to 7 pm" — range given, use the start; period applies to
  // whichever number it's attached to.
  m = text.match(/^(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const period = m[3];
    if (hour < 1 || hour > 12) return null;
    if (period === 'am') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return { hour, minute: 0 };
  }

  // 24-hour "18:00", "06:00", "6:00"
  m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
}

module.exports = { parseHourLabel };
