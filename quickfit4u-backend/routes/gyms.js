const express = require('express');
const { v4: uuid } = require('uuid');
const QRCode = require('qrcode');
const db = require('../lib/db');
const { sendGymQrEmail } = require('../lib/mailer');
const { requireAuth, requireRole } = require('../middleware/auth');
const { todayIST, slotStartUTC } = require('../lib/date');
const { parseHourLabel } = require('../lib/hourParser');

const router = express.Router();

function todayStr() {
  return todayIST();
}

function serializeGym(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    area: row.area,
    city: row.city,
    description: row.description,
    tags: JSON.parse(row.tags || '[]'),
    photos: JSON.parse(row.photos || '[]'),
    hourlyRate: row.hourly_rate,
    latitude: row.latitude,
    longitude: row.longitude,
    openingHours: row.opening_hours,
    peakHours: row.peak_hours,
    agreementSignedAt: row.agreement_signed_at,
    agreementSignedName: row.agreement_signed_name,
    agreementSignatureUrl: row.agreement_signature_url,
    qrDataUrl: row.qr_data_url,
    createdAt: row.created_at,
  };
}

function getOwnersGym(ownerId) {
  return db.prepare('SELECT * FROM gyms WHERE owner_id = ?').get(ownerId);
}

// ---------- Gym profile ----------


router.get('/mine', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  res.json({ gym: gym ? withRatings(gym) : null });
});


router.post('/mine', requireAuth, requireRole('owner'), (req, res) => {
  const existing = getOwnersGym(req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You already have a gym profile. Use PUT to edit it.' });
  }

  const { name, phone, area, city, description, tags, photos, hourlyRate, latitude, longitude, openingHours, peakHours } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Gym name is required.' });
  if (!hourlyRate || hourlyRate <= 0) return res.status(400).json({ error: 'Hourly rate must be greater than 0.' });

  const id = uuid();
  db.prepare(
    `INSERT INTO gyms (id, owner_id, name, phone, area, city, description, tags, photos, hourly_rate, latitude, longitude, opening_hours, peak_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.id,
    name.trim(),
    phone || null,
    area || null,
    city || null,
    description || null,
    JSON.stringify(tags || []),
    JSON.stringify(photos || []),
    hourlyRate,
    latitude ?? null,
    longitude ?? null,
    openingHours || null,
    peakHours || null
  );

  res.json({ gym: serializeGym(getOwnersGym(req.user.id)) });
});


router.put('/mine', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first (POST /api/gyms/mine).' });

  const { name, phone, area, city, description, tags, photos, hourlyRate, latitude, longitude, openingHours, peakHours } = req.body || {};

  db.prepare(
    `UPDATE gyms SET
       name = COALESCE(?, name),
       phone = COALESCE(?, phone),
       area = COALESCE(?, area),
       city = COALESCE(?, city),
       description = COALESCE(?, description),
       tags = COALESCE(?, tags),
       photos = COALESCE(?, photos),
       hourly_rate = COALESCE(?, hourly_rate),
       latitude = COALESCE(?, latitude),
       longitude = COALESCE(?, longitude),
       opening_hours = COALESCE(?, opening_hours),
       peak_hours = COALESCE(?, peak_hours)
     WHERE id = ?`
  ).run(
    name ? name.trim() : null,
    phone || null,
    area ?? null,
    city ?? null,
    description ?? null,
    tags ? JSON.stringify(tags) : null,
    photos ? JSON.stringify(photos) : null,
    hourlyRate ?? null,
    latitude ?? null,
    longitude ?? null,
    openingHours ?? null,
    peakHours ?? null,
    gym.id
  );

  res.json({ gym: serializeGym(getOwnersGym(req.user.id)) });
});

// ---------- Bank / payout details ----------


router.get('/mine/bank-details', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  res.json({
    bankDetails: {
      accountHolder: gym.bank_account_holder || null,
      accountNumber: gym.bank_account_number || null,
      ifsc: gym.bank_ifsc || null,
      upiId: gym.bank_upi_id || null,
      submittedAt: gym.bank_details_submitted_at || null,
    },
  });
});


router.put('/mine/bank-details', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const { accountHolder, accountNumber, ifsc, upiId } = req.body || {};

  const hasBankAccount = accountHolder && accountNumber && ifsc;
  const hasUpi = !!upiId;
  if (!hasBankAccount && !hasUpi) {
    return res.status(400).json({ error: 'Add either a bank account (holder name, account number, IFSC) or a UPI ID.' });
  }
  if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
    return res.status(400).json({ error: 'Enter a valid bank account number.' });
  }
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
    return res.status(400).json({ error: 'Enter a valid 11-character IFSC code (e.g. HDFC0001234).' });
  }
  if (upiId && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
    return res.status(400).json({ error: 'Enter a valid UPI ID (e.g. yourname@okhdfcbank).' });
  }

  db.prepare(
    `UPDATE gyms SET
       bank_account_holder = ?,
       bank_account_number = ?,
       bank_ifsc = ?,
       bank_upi_id = ?,
       bank_details_submitted_at = datetime('now')
     WHERE id = ?`
  ).run(
    accountHolder || null,
    accountNumber || null,
    ifsc ? ifsc.toUpperCase() : null,
    upiId || null,
    gym.id
  );

  res.json({ gym: serializeGym(getOwnersGym(req.user.id)) });
});


router.post('/mine/slots', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const { date, hourLabel, capacity } = req.body || {};
  if (!date || !hourLabel) return res.status(400).json({ error: 'date and hourLabel are required.' });

  try {
    const id = uuid();
    db.prepare(
      `INSERT INTO gym_slots (id, gym_id, date, hour_label, capacity) VALUES (?, ?, ?, ?, ?)`
    ).run(id, gym.id, date, hourLabel, capacity && capacity > 0 ? capacity : 1);
    res.json({ ok: true, slotId: id });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'That slot already exists for this date.' });
    }
    res.status(500).json({ error: 'Could not create the slot.' });
  }
});


router.get('/mine/slots', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const date = req.query.date || todayStr();
  const slots = db
    .prepare(`SELECT * FROM gym_slots WHERE gym_id = ? AND date = ? ORDER BY hour_label`)
    .all(gym.id, date);

  res.json({
    date,
    slots: slots.map((s) => ({
      id: s.id,
      hourLabel: s.hour_label,
      capacity: s.capacity,
      booked: s.booked_count,
      spotsLeft: s.capacity - s.booked_count,
    })),
  });
});

// ---------- Today's bookings ----------

router.get('/mine/bookings/today', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const date = req.query.date || todayStr();

  const bookings = db
    .prepare(
      `SELECT b.id, b.booking_code, b.status, b.created_at, b.checked_in_at,
              s.hour_label, u.name AS customer_name, u.email AS customer_email
       FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       JOIN users u ON u.id = b.user_id
       WHERE s.gym_id = ? AND s.date = ? AND b.status IN ('confirmed', 'checked_in')
       ORDER BY s.hour_label`
    )
    .all(gym.id, date);

  res.json({
    date,
    bookings: bookings.map((b) => ({
      id: b.id,
      bookingCode: b.booking_code,
      status: b.status,
      hourLabel: b.hour_label,
      customerName: b.customer_name,
      customerEmail: b.customer_email,
      checkedInAt: b.checked_in_at,
      createdAt: b.created_at,
    })),
    
  });
});

// ---------- Previous customers ----------

router.get('/mine/customers', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const customers = db
    .prepare(
      `SELECT u.id, u.name, u.email, COUNT(b.id) AS visit_count, MAX(b.created_at) AS last_visit
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       WHERE b.gym_id = ? AND b.status IN ('confirmed', 'checked_in')
       GROUP BY u.id
       ORDER BY last_visit DESC`
    )
    .all(gym.id);

  res.json({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      visitCount: c.visit_count,
      lastVisit: c.last_visit,
    })),
  });
});

// ---------- Dashboard (revenue, customers, rating, upcoming, no-shows) ----------

router.get('/mine/dashboard', requireAuth, requireRole('owner'), (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const today = todayIST();
  const [y, m, d] = today.split('-').map(Number);


  const todayDate = new Date(Date.UTC(y, m - 1, d));
  const dayIndex = (todayDate.getUTCDay() + 6) % 7; 
  const monday = new Date(todayDate);
  monday.setUTCDate(todayDate.getUTCDate() - dayIndex);
  const weekStart = monday.toISOString().slice(0, 10);

  const monthStart = `${today.slice(0, 7)}-01`;

 
  function revenueSince(sinceDate) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(b.amount), 0) AS total
         FROM bookings b JOIN gym_slots s ON s.id = b.slot_id
         WHERE s.gym_id = ? AND s.date >= ? AND s.date <= ? AND b.payment_status = 'paid'`
      )
      .get(gym.id, sinceDate, today);
    // bookings.amount is already stored in rupees (see gym.hourly_rate),
    // so it must NOT be divided by 100 here — that was making revenue
    // show up as ~0 for any normal rupee amount.
    return Math.round(row.total || 0);
  }

  const todayRevenue = revenueSince(today);
  const weekRevenue = revenueSince(weekStart);
  const monthRevenue = revenueSince(monthStart);

  // Pending payout = money collected from members that admin hasn't
  // settled to the owner yet. Mirrors pendingPayoutFor() in routes/admin.js
  // so the owner's dashboard stays in sync with what admin sees/settles.
  const pendingPayoutRow = gym.last_payout_at
    ? db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM bookings
           WHERE gym_id = ? AND payment_status = 'paid' AND created_at > ?`
        )
        .get(gym.id, gym.last_payout_at)
    : db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM bookings WHERE gym_id = ? AND payment_status = 'paid'`)
        .get(gym.id);
  const pendingPayoutRupees = pendingPayoutRow.total || 0;

  const lastPayoutRow = db
    .prepare(`SELECT amount, created_at FROM payouts WHERE gym_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(gym.id);

  const totalCustomers = db
    .prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM bookings WHERE gym_id = ? AND status = 'checked_in'`)
    .get(gym.id).n;

  const ratingStats = db
    .prepare(`SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE gym_id = ?`)
    .get(gym.id);

  const upcomingRows = db
    .prepare(
      `SELECT b.id, b.booking_code, s.date, s.hour_label, u.name AS customer_name
       FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       JOIN users u ON u.id = b.user_id
       WHERE b.gym_id = ? AND b.status = 'confirmed' AND s.date >= ?
       ORDER BY s.date, s.hour_label
       LIMIT 10`
    )
    .all(gym.id, today);


  const confirmedTodayAndPast = db
    .prepare(
      `SELECT b.id, b.booking_code, s.date, s.hour_label, u.name AS customer_name
       FROM bookings b
       JOIN gym_slots s ON s.id = b.slot_id
       JOIN users u ON u.id = b.user_id
       WHERE b.gym_id = ? AND b.status = 'confirmed' AND s.date <= ?
       ORDER BY s.date DESC, s.hour_label DESC
       LIMIT 100`
    )
    .all(gym.id, today);

  const now = Date.now();
  const noShows = confirmedTodayAndPast.filter((b) => {
    const parsed = parseHourLabel(b.hour_label);
    if (!parsed) return false;
    const start = slotStartUTC(b.date, parsed).getTime();
    return now >= start + 60 * 60 * 1000; // slot fully elapsed
  });

  res.json({
    todayRevenue,
    weekRevenue,
    monthRevenue,
    pendingPayoutRupees,
    lastPayoutAmountRupees: lastPayoutRow ? lastPayoutRow.amount : null,
    lastPayoutAt: lastPayoutRow ? lastPayoutRow.created_at : null,
    totalCustomers,
    averageRating: ratingStats.avg_rating ? Math.round(ratingStats.avg_rating * 10) / 10 : null,
    reviewCount: ratingStats.review_count,
    upcomingBookings: upcomingRows.map((b) => ({
      id: b.id,
      bookingCode: b.booking_code,
      date: b.date,
      hourLabel: b.hour_label,
      customerName: b.customer_name,
    })),
    noShows: noShows.slice(0, 10).map((b) => ({
      id: b.id,
      bookingCode: b.booking_code,
      date: b.date,
      hourLabel: b.hour_label,
      customerName: b.customer_name,
    })),
    noShowCount: noShows.length,
  });
});

// ---------- Partnership agreement (owner e-signature) ----------

router.post('/mine/agreement', requireAuth, requireRole('owner'), async (req, res) => {
  const gym = getOwnersGym(req.user.id);
  if (!gym) return res.status(404).json({ error: 'Create your gym profile first.' });

  const { signedName, signatureUrl, accepted } = req.body || {};
  if (!signedName || !signedName.trim()) return res.status(400).json({ error: 'Type your full name to sign.' });
  if (!signatureUrl) return res.status(400).json({ error: 'A drawn signature is required.' });
  if (accepted !== true) {
    return res.status(400).json({ error: 'You must check the box to accept the agreement before signing.' });
  }


  const qrPayload = JSON.stringify({ app: 'QuickFit4u', type: 'gym', gymId: gym.id });
  let qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 400, margin: 1 });
  } catch (e) {
    return res.status(500).json({ error: 'Could not generate your gym QR code. Please try again.' });
  }

  db.prepare(
    `UPDATE gyms SET agreement_signed_at = datetime('now'), agreement_signed_name = ?, agreement_signature_url = ?, qr_data_url = ? WHERE id = ?`
  ).run(signedName.trim(), signatureUrl, qrDataUrl, gym.id);

  const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
  try {
    await sendGymQrEmail(owner.email, gym.name, qrDataUrl);
  } catch (e) {
  
    console.error('Failed to email gym QR code:', e.message);
  }

  res.json({ gym: serializeGym(getOwnersGym(req.user.id)) });
});


function isOpenNow(gymId) {
  const date = todayIST();
  const slots = db.prepare('SELECT * FROM gym_slots WHERE gym_id = ? AND date = ?').all(gymId, date);
  const now = Date.now();
  return slots.some((s) => {
    if (s.booked_count >= s.capacity) return false;
    const parsed = parseHourLabel(s.hour_label);
    if (!parsed) return false;
    const start = slotStartUTC(date, parsed).getTime();
    const end = start + 60 * 60 * 1000;
    return now >= start && now < end;
  });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const FACILITY_SHORTCUTS = {
  ac: 'AC',
  personalTrainer: 'Personal Training',
  parking: 'Parking',
  shower: 'Showers',
  femaleFriendly: 'Ladies-Only Hours',
};


function computeCrowdLevel(gymId) {
  const date = todayIST();
  const slots = db.prepare('SELECT * FROM gym_slots WHERE gym_id = ? AND date = ?').all(gymId, date);
  if (slots.length === 0) return null;

  const now = Date.now();
  const current = slots.find((s) => {
    const parsed = parseHourLabel(s.hour_label);
    if (!parsed) return false;
    const start = slotStartUTC(date, parsed).getTime();
    return now >= start && now < start + 60 * 60 * 1000;
  });

  const relevant = current ? [current] : slots;
  const totalCapacity = relevant.reduce((sum, s) => sum + s.capacity, 0);
  const totalBooked = relevant.reduce((sum, s) => sum + Math.min(s.booked_count, s.capacity), 0);
  if (totalCapacity === 0) return null;

  const ratio = totalBooked / totalCapacity;
  if (ratio >= 0.75) return 'High';
  if (ratio >= 0.4) return 'Moderate';
  return 'Low';
}

function withRatings(gymRow) {
  const stats = db
    .prepare(`SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE gym_id = ?`)
    .get(gymRow.id);
  return {
    ...serializeGym(gymRow),
    rating: stats.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : null,
    reviewCount: stats.review_count,
    crowdLevel: computeCrowdLevel(gymRow.id),
  };
}


router.get('/', (req, res) => {
  const {
    city, search, minPrice, maxPrice, minRating, facilities,
    ac, personalTrainer, parking, shower, femaleFriendly, openNow,
    lat, lng, maxDistanceKm, sortBy,
  } = req.query;

  let sql = `SELECT * FROM gyms WHERE agreement_signed_at IS NOT NULL AND suspended = 0`;
  const params = [];

  if (city) {
    sql += ` AND city LIKE ? COLLATE NOCASE`;
    params.push(`%${city}%`);
  }
  if (search && search.trim()) {
    sql += ` AND (name LIKE ? COLLATE NOCASE OR area LIKE ? COLLATE NOCASE OR city LIKE ? COLLATE NOCASE OR tags LIKE ? COLLATE NOCASE)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }
  if (minPrice !== undefined && minPrice !== '') {
    sql += ` AND hourly_rate >= ?`;
    params.push(Number(minPrice));
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    sql += ` AND hourly_rate <= ?`;
    params.push(Number(maxPrice));
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = db.prepare(sql).all(...params);
  let results = rows.map(withRatings);

  
  if (minRating !== undefined && minRating !== '') {
    const min = Number(minRating);
    results = results.filter((g) => g.rating != null && g.rating >= min);
  }


  const requestedFacilities = [];
  if (facilities) requestedFacilities.push(...facilities.split(',').map((s) => s.trim()).filter(Boolean));
  if (ac === 'true') requestedFacilities.push(FACILITY_SHORTCUTS.ac);
  if (personalTrainer === 'true') requestedFacilities.push(FACILITY_SHORTCUTS.personalTrainer);
  if (parking === 'true') requestedFacilities.push(FACILITY_SHORTCUTS.parking);
  if (shower === 'true') requestedFacilities.push(FACILITY_SHORTCUTS.shower);
  if (femaleFriendly === 'true') requestedFacilities.push(FACILITY_SHORTCUTS.femaleFriendly);
  if (requestedFacilities.length) {
    results = results.filter((g) =>
      requestedFacilities.every((f) => (g.tags || []).some((t) => t.toLowerCase() === f.toLowerCase()))
    );
  }

  if (openNow === 'true') {
    results = results.filter((g) => isOpenNow(g.id));
  }


  const userLat = lat !== undefined && lat !== '' ? Number(lat) : null;
  const userLng = lng !== undefined && lng !== '' ? Number(lng) : null;
  const hasUserLocation = userLat != null && userLng != null && !Number.isNaN(userLat) && !Number.isNaN(userLng);
  if (hasUserLocation) {
    results = results.map((g) => ({
      ...g,
      distanceKm:
        g.latitude != null && g.longitude != null
          ? Math.round(haversineKm(userLat, userLng, g.latitude, g.longitude) * 10) / 10
          : null,
    }));
    if (maxDistanceKm !== undefined && maxDistanceKm !== '') {
      const maxKm = Number(maxDistanceKm);
      results = results.filter((g) => g.distanceKm != null && g.distanceKm <= maxKm);
    }
  }

  if (sortBy === 'distance' && hasUserLocation) {
    results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (sortBy === 'price') {
    results.sort((a, b) => a.hourlyRate - b.hourlyRate);
  } else if (sortBy === 'rating') {
    results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  res.json({ gyms: results });
});


router.get('/:id', (req, res) => {
  const gymRow = db.prepare('SELECT * FROM gyms WHERE id = ?').get(req.params.id);
  if (!gymRow) return res.status(404).json({ error: 'Gym not found.' });
  if (!gymRow.agreement_signed_at || gymRow.suspended) {
    return res.status(404).json({ error: 'This gym is not visible to members yet.' });
  }

  const date = req.query.date || todayStr();
  const slotRows = db
    .prepare(`SELECT * FROM gym_slots WHERE gym_id = ? AND date = ? ORDER BY hour_label`)
    .all(gymRow.id, date);

  const reviewRows = db
    .prepare(
      `SELECT r.rating, r.text, r.created_at, u.name AS reviewer_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.gym_id = ? ORDER BY r.created_at DESC LIMIT 20`
    )
    .all(gymRow.id);

  res.json({
    gym: withRatings(gymRow),
    date,
    slots: slotRows.map((s) => ({
      id: s.id,
      date: s.date,
      hour: s.hour_label,
      capacity: s.capacity,
      booked: s.booked_count,
      spotsLeft: s.capacity - s.booked_count,
    })),
    reviews: reviewRows.map((r) => ({
      rating: r.rating,
      text: r.text,
      reviewerName: r.reviewer_name,
      createdAt: r.created_at,
    })),
  });
});


router.post('/:id/reviews', requireAuth, requireRole('member'), (req, res) => {
  const gymRow = db.prepare('SELECT id FROM gyms WHERE id = ?').get(req.params.id);
  if (!gymRow) return res.status(404).json({ error: 'Gym not found.' });

  const { rating, text } = req.body || {};
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  const hasCompletedVisit = db
    .prepare(`SELECT 1 FROM bookings WHERE gym_id = ? AND user_id = ? AND status = 'checked_in' LIMIT 1`)
    .get(gymRow.id, req.user.id);
  if (!hasCompletedVisit) {
    return res.status(403).json({ error: 'You can review a gym only after checking in for a completed visit.' });
  }

  const existing = db
    .prepare(`SELECT id FROM reviews WHERE gym_id = ? AND user_id = ?`)
    .get(gymRow.id, req.user.id);

  if (existing) {
    db.prepare(`UPDATE reviews SET rating = ?, text = ?, created_at = datetime('now') WHERE id = ?`)
      .run(rating, text || null, existing.id);
  } else {
    db.prepare(
      `INSERT INTO reviews (id, gym_id, user_id, rating, text) VALUES (?, ?, ?, ?, ?)`
    ).run(uuid(), gymRow.id, req.user.id, rating, text || null);
  }

  res.json({ ok: true });
});

module.exports = router;
