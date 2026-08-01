const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');



function signQrToken({ bookingId, gymId, expiresAt }) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${bookingId}|${gymId}|${expiresAt}`)
    .digest('hex');
}


function verifyQrToken({ bookingId, gymId, expiresAt, token }) {
  if (!bookingId || !gymId || !expiresAt || !token) return false;

  const expected = signQrToken({ bookingId, gymId, expiresAt });

  const expectedBuf = Buffer.from(expected, 'hex');
  const givenBuf = Buffer.from(String(token), 'hex');
  if (expectedBuf.length !== givenBuf.length) return false;
  if (!crypto.timingSafeEqual(expectedBuf, givenBuf)) return false;

  return new Date(expiresAt).getTime() > Date.now();
}

module.exports = { signQrToken, verifyQrToken };