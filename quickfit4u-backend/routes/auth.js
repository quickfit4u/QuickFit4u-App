const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');
const { createOtp, verifyOtp } = require('../lib/otp');
const { sendOtpEmail } = require('../lib/mailer');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

const FITNESS_GOALS = ['weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'general_fitness'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone || null,
    gender: user.gender || null,
    address: user.address || null,
    avatarUrl: user.avatar_url || null,
    dateOfBirth: user.date_of_birth || null,
    emergencyContact: user.emergency_contact || null,
    fitnessGoal: user.fitness_goal || null,
    bloodGroup: user.blood_group || null,
  };
}

function isValidPhone(phone) {
  return /^[0-9]{10}$/.test(phone || '');
}

function isValidGender(gender) {
  return ['male', 'female', 'other'].includes(gender);
}


function isValidDateOfBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function isValidFitnessGoal(value) {
  return FITNESS_GOALS.includes(value);
}

function isValidBloodGroup(value) {
  return BLOOD_GROUPS.includes(value);
}


router.post('/signup', async (req, res) => {
  const { email, name, role, referredBy } = req.body || {};

  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!['member', 'owner'].includes(role)) {
    return res.status(400).json({ error: "Role must be 'member' or 'owner'." });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
  }

  try {
    const code = createOtp({ email, purpose: 'signup', name: name.trim(), role, referredBy: referredBy || null });
    await sendOtpEmail(email, code, 'signup');
    res.json({ ok: true, message: `A 6-digit code was sent to ${email}.` });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Could not send the code. Try again.' });
  }
});


router.post('/verify-signup', async (req, res) => {
  const { email, code, password, confirmPassword } = req.body || {};

  if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });

  let otpRow;
  try {
    otpRow = verifyOtp({ email, code });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  if (otpRow.purpose !== 'signup') {
    return res.status(400).json({ error: 'This code was not requested for signup.' });
  }

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const passwordHash = await bcrypt.hash(password, 10);

  if (!user) {
    const id = uuid();
    db.prepare(
      `INSERT INTO users (id, email, name, role, referred_by, password_hash) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, email, otpRow.pending_name, otpRow.pending_role, otpRow.pending_referred_by, passwordHash);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  } else if (!user.password_hash) {
    // Account existed without a password (e.g. created before this feature) — set it now.
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    user.password_hash = passwordHash;
  }

  const token = signToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!password) return res.status(400).json({ error: 'Enter your password.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: 'No account with this email. Please sign up first.' });
  }

  if (!user.password_hash) {
    
    return res.status(409).json({
      error: 'Your account needs a password. Tap "Forgot password?" to set one — it only takes a moment.',
      needsPasswordSetup: true,
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Incorrect email or password.' });

  const token = signToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});


router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: 'No account with this email.' });
  }

  try {
    const code = createOtp({ email, purpose: 'reset' });
    await sendOtpEmail(email, code, 'reset');
    res.json({ ok: true, message: `A 6-digit reset code was sent to ${email}.` });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Could not send the code. Try again.' });
  }
});


router.post('/reset-password', async (req, res) => {
  const { email, code, password, confirmPassword } = req.body || {};

  if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });

  let otpRow;
  try {
    otpRow = verifyOtp({ email, code });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  if (otpRow.purpose !== 'reset') {
    return res.status(400).json({ error: 'This code was not requested for a password reset.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'No account with this email.' });

  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

 
  const token = signToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});


router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    `SELECT id, email, name, role, referred_by, created_at, phone, gender, address, avatar_url,
            date_of_birth, emergency_contact, fitness_goal, blood_group
     FROM users WHERE id = ?`
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});


router.put('/me', requireAuth, (req, res) => {
  const {
    name, phone, gender, address, avatarUrl,
    dateOfBirth, emergencyContact, fitnessGoal, bloodGroup,
  } = req.body || {};

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'Name cannot be empty.' });
  }
  if (phone !== undefined && phone !== null && phone !== '' && !isValidPhone(phone)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  }
  if (gender !== undefined && gender !== null && gender !== '' && !isValidGender(gender)) {
    return res.status(400).json({ error: "Gender must be 'male', 'female', or 'other'." });
  }
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '' && !isValidDateOfBirth(dateOfBirth)) {
    return res.status(400).json({ error: 'Enter a valid date of birth.' });
  }
  if (emergencyContact !== undefined && emergencyContact !== null && emergencyContact !== '' && !isValidPhone(emergencyContact)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit emergency contact number.' });
  }
  if (fitnessGoal !== undefined && fitnessGoal !== null && fitnessGoal !== '' && !isValidFitnessGoal(fitnessGoal)) {
    return res.status(400).json({ error: 'Pick a valid fitness goal.' });
  }
  if (bloodGroup !== undefined && bloodGroup !== null && bloodGroup !== '' && !isValidBloodGroup(bloodGroup)) {
    return res.status(400).json({ error: 'Pick a valid blood group.' });
  }

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!current) return res.status(404).json({ error: 'User not found.' });

  db.prepare(
    `UPDATE users SET
      name = ?,
      phone = ?,
      gender = ?,
      address = ?,
      avatar_url = ?,
      date_of_birth = ?,
      emergency_contact = ?,
      fitness_goal = ?,
      blood_group = ?
    WHERE id = ?`
  ).run(
    name !== undefined ? name.trim() : current.name,
    phone !== undefined ? (phone || null) : current.phone,
    gender !== undefined ? (gender || null) : current.gender,
    address !== undefined ? (address || null) : current.address,
    avatarUrl !== undefined ? (avatarUrl || null) : current.avatar_url,
    dateOfBirth !== undefined ? (dateOfBirth || null) : current.date_of_birth,
    emergencyContact !== undefined ? (emergencyContact || null) : current.emergency_contact,
    fitnessGoal !== undefined ? (fitnessGoal || null) : current.fitness_goal,
    bloodGroup !== undefined ? (bloodGroup || null) : current.blood_group,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, user: publicUser(updated) });
});


router.delete('/me', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const deleteAll = db.transaction(() => {
    if (user.role === 'owner') {
      const gym = db.prepare('SELECT id FROM gyms WHERE owner_id = ?').get(userId);
      if (gym) {
        db.prepare('DELETE FROM reviews WHERE gym_id = ?').run(gym.id);
        db.prepare('DELETE FROM bookings WHERE gym_id = ?').run(gym.id);
        db.prepare('DELETE FROM gym_slots WHERE gym_id = ?').run(gym.id);
        db.prepare('DELETE FROM gyms WHERE id = ?').run(gym.id);
      }
    } else {
      db.prepare('DELETE FROM reviews WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM bookings WHERE user_id = ?').run(userId);
    }
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(user.email);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  try {
    deleteAll();
    res.json({ ok: true, message: 'Your account and all associated data have been deleted.' });
  } catch (e) {
    res.status(500).json({ error: 'Could not delete your account. Please try again.' });
  }
});


router.put('/push-token', requireAuth, (req, res) => {
  const { pushToken } = req.body || {};
  db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(pushToken || null, req.user.id);
  res.json({ ok: true });
});

module.exports = router;