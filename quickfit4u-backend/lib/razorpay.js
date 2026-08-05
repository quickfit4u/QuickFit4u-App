const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

function isConfigured() {
  return !!(KEY_ID && KEY_SECRET && !KEY_ID.startsWith('your-') && !KEY_SECRET.startsWith('your-'));
}

function authHeader() {
  return 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
}


async function createOrder({ amountRupees, receipt, notes }) {
  if (!isConfigured()) {
    const err = new Error(
      'Razorpay is not configured yet. Add your real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to quickfit4u-backend/.env.'
    );
    err.status = 500;
    throw err;
  }

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(amountRupees * 100), 
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),
      notes: notes || {},
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.description || 'Could not create the payment order. Try again.');
    err.status = res.status || 500;
    throw err;
  }
  return data; 
}


function verifySignature({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

module.exports = { createOrder, verifySignature, isConfigured, KEY_ID };
