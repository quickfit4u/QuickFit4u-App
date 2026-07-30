const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');

// The member's booking QR encodes { bookingId, gymId, expiresAt, token }.
// `token` is an HMAC-SHA256 signature over the other three fields, keyed
// with the same server secret used for auth tokens. This lets a scanner
// (or our own /owner-checkin route) detect a QR that has been edited or
// copied to a different booking/gym, and reject it before ever hitting the
// database — without needing its own separate secret to manage.

function signQrToken({ bookingId, gymId, expiresAt }) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${bookingId}|${gymId}|${expiresAt}`)
    .digest('hex');
}

// Returns true only if the token matches AND the QR hasn't expired yet.
function verifyQrToken({ bookingId, gymId, expiresAt, token }) {
  if (!bookingId || !gymId || !expiresAt || !token) return false;

  const expected = signQrToken({ bookingId, gymId, expiresAt });
  // Constant-time comparison — avoids leaking the correct token a byte at a
  // time via response-timing differences.
  const expectedBuf = Buffer.from(expected, 'hex');
  const givenBuf = Buffer.from(String(token), 'hex');
  if (expectedBuf.length !== givenBuf.length) return false;
  if (!crypto.timingSafeEqual(expectedBuf, givenBuf)) return false;

  return new Date(expiresAt).getTime() > Date.now();
}

module.exports = { signQrToken, verifyQrToken };