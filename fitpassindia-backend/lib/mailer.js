

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.SMTP_FROM || 'FitPass India <onboarding@resend.dev>';

async function sendEmail({ to, subject, text, html, attachments }) {
  if (!RESEND_API_KEY) {
    const err = new Error('Email is not configured yet. Add RESEND_API_KEY to your environment variables.');
    err.status = 500;
    throw err;
  }

  const payload = {
    from: FROM_ADDRESS,
    to: [to],
    subject,
    text,
    html,
  };

  if (attachments && attachments.length) {
    // Resend wants base64 content as a plain string (no data: prefix) per attachment.
    payload.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.message || 'Could not send the email. Try again.');
    err.status = res.status;
    throw err;
  }
}

async function sendOtpEmail(toEmail, code, purpose) {
  const subject =
    purpose === 'signup' ? 'Your FitPass India signup code' :
    purpose === 'reset' ? 'Reset your FitPass India password' :
    'Your FitPass India login code';

  const introLine =
    purpose === 'signup' ? 'Use this code to finish creating your account:' :
    purpose === 'reset' ? 'Use this code to reset your password:' :
    'Your verification code is:';

  await sendEmail({
    to: toEmail,
    subject,
    text: `${introLine} ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #2B3328;">
        <h2 style="margin-bottom: 8px;">FitPass India</h2>
        <p>${introLine}</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p style="color:#6B7566; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

async function sendGymQrEmail(toEmail, gymName, qrDataUrl) {
  // qrDataUrl looks like 'data:image/png;base64,AAAA...' — Resend wants just the base64 part.
  const base64 = qrDataUrl.split(',')[1];

  await sendEmail({
    to: toEmail,
    subject: `${gymName} is live on FitPass India — here's your QR code`,
    text: `Congratulations! ${gymName} is now live on FitPass India. Your gym's QR code is attached — it's also saved in your gym profile in the app under Gym Profile.`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #2B3328;">
        <h2 style="margin-bottom: 8px;">FitPass India</h2>
        <p><strong>${gymName}</strong> is now live on FitPass India and ready to accept bookings.</p>
        <p>Your gym's QR code is attached to this email, and is also saved in the app under <strong>Gym Profile</strong>.</p>
        <p style="color:#6B7566; font-size: 13px; margin-top:16px;">Keep this QR code handy at your front desk for quick reference.</p>
      </div>
    `,
    attachments: [{ filename: 'gym-qr-code.png', content: base64 }],
  });
}

async function sendBookingQrEmail(toEmail, gymName, dateStr, hourLabel, qrDataUrl) {
  const base64 = qrDataUrl.split(',')[1];

  await sendEmail({
    to: toEmail,
    subject: `Your booking at ${gymName} is confirmed ✅`,
    text: `Your slot at ${gymName} for ${hourLabel} on ${dateStr} is confirmed. Your booking QR is attached — show it at the front desk, or scan the gym's QR yourself if there's no staff around. It's also saved in the app under Your Bookings.`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #2B3328;">
        <h2 style="margin-bottom: 8px;">FitPass India</h2>
        <p>Your slot at <strong>${gymName}</strong> for <strong>${hourLabel} on ${dateStr}</strong> is confirmed.</p>
        <p>Show this QR code at the front desk to check in — or scan the gym's own QR yourself if there's no staff around.</p>
        <p style="color:#6B7566; font-size: 13px; margin-top:16px;">This is also saved in the app under Your Bookings.</p>
      </div>
    `,
    attachments: [{ filename: 'booking-qr-code.png', content: base64 }],
  });
}

module.exports = { sendOtpEmail, sendGymQrEmail, sendBookingQrEmail };