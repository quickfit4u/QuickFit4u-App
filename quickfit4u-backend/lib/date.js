
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST() {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  return istNow.toISOString().slice(0, 10); 
}


function slotStartUTC(dateStr, parsedHour) {
  if (!dateStr || !parsedHour) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;

  const asIfUTC = Date.UTC(y, m - 1, d, parsedHour.hour, parsedHour.minute, 0);
  return new Date(asIfUTC - IST_OFFSET_MS);
}


function endOfDayIST(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const asIfUTC = Date.UTC(y, m - 1, d, 23, 59, 59);
  return new Date(asIfUTC - IST_OFFSET_MS);
}

module.exports = { todayIST, slotStartUTC, endOfDayIST };