require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const gymRoutes = require('./routes/gyms');
const bookingRoutes = require('./routes/bookings');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const { startScheduler } = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Catch-all error handler: without this, an uncaught throw inside an async
// route (e.g. a bad SQL column, like the push_token issue that used to
// crash /api/bookings/verify-payment after the QR was already generated)
// just hangs the request forever instead of ever reaching the client — the
// app has no way to distinguish that from a dropped connection. This turns
// any such bug into a visible 500 instead of a silent timeout.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`FitPass India backend running at http://localhost:${PORT}`);
  startScheduler();
});
