
function parseHourLabel(label) {
  if (!label) return null;
  const text = String(label).trim().toLowerCase();


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


  m = text.match(/^(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const period = m[3];
    if (hour < 1 || hour > 12) return null;
    if (period === 'am') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return { hour, minute: 0 };
  }

 
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
