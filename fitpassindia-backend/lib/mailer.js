const nodemailer = require('nodemailer');
const dns = require('dns');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  
  family: 4,
  lookup: (hostname, options, callback) => {
    dns.lookup(hostname, { family: 4 }, callback);
  },
  connectionTimeout: 10000, // 10s to establish the connection
  greetingTimeout: 10000,   // 10s to get the server's initial greeting
  socketTimeout: 15000,     // 15s of inactivity on the socket
});

async function sendOtpEmail(toEmail, code, purpose) {
  const subject =
    purpose === 'signup' ? 'Your FitPass India signup code' :
    purpose === 'reset' ? 'Reset your FitPass India password' :
    'Your FitPass India login code';

  const introLine =
    purpose === 'signup' ? 'Use this code to finish creating your account:' :
    purpose === 'reset' ? 'Use this code to reset your password:' :
    'Your verification code is:';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
  // qrDataUrl looks like 'data:image/png;base64,AAAA...' — split out the raw bytes for the attachment.
  const base64 = qrDataUrl.split(',')[1];

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: `${gymName} is live on FitPass India — here's your QR code`,
    text: `Congratulations! ${gymName} is now live on FitPass India. Your gym's QR code is attached — it's also saved in your gym profile in the app under Gym Profile.`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #2B3328;">
        <h2 style="margin-bottom: 8px;">FitPass India</h2>
        <p><strong>${gymName}</strong> is now live on FitPass India and ready to accept bookings.</p>
        <p>Your gym's QR code is attached to this email, and is also saved in the app under <strong>Gym Profile</strong>.</p>
        <img src="cid:gym-qr" style="width:200px;height:200px;margin-top:12px;" />
        <p style="color:#6B7566; font-size: 13px; margin-top:16px;">Keep this QR code handy at your front desk for quick reference.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'gym-qr-code.png',
        content: Buffer.from(base64, 'base64'),
        cid: 'gym-qr',
      },
    ],
  });
}

async function sendBookingQrEmail(toEmail, gymName, dateStr, hourLabel, qrDataUrl) {
  const base64 = qrDataUrl.split(',')[1];

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: `Your booking at ${gymName} is confirmed ✅`,
    text: `Your slot at ${gymName} for ${hourLabel} on ${dateStr} is confirmed. Your booking QR is attached — show it at the front desk, or scan the gym's QR yourself if there's no staff around. It's also saved in the app under Your Bookings.`,
    html: `
      <div style="font-family: sans-serif; padding: 24px; color: #2B3328;">
        <h2 style="margin-bottom: 8px;">FitPass India</h2>
        <p>Your slot at <strong>${gymName}</strong> for <strong>${hourLabel} on ${dateStr}</strong> is confirmed.</p>
        <p>Show this QR code at the front desk to check in — or scan the gym's own QR yourself if there's no staff around.</p>
        <img src="cid:booking-qr" style="width:200px;height:200px;margin-top:12px;" />
        <p style="color:#6B7566; font-size: 13px; margin-top:16px;">This is also saved in the app under Your Bookings.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'booking-qr-code.png',
        content: Buffer.from(base64, 'base64'),
        cid: 'booking-qr',
      },
    ],
  });
}

module.exports = { sendOtpEmail, sendGymQrEmail, sendBookingQrEmail };