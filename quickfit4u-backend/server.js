require('dotenv').config();
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

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


app.get('/', (req, res) => res.redirect('/admin/login.html'));

app.use('/api/auth', authRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));


app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`QuickFit4u backend running at http://localhost:${PORT}`);
  startScheduler();
});