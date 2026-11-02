require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');

// Route imports
const authRoutes = require('./routes/authRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB & Initialize Default Admin if needed
connectDB().then(async () => {
  try {
    const adminCount = await User.countDocuments();
    if (adminCount === 0) {
      await User.create({
        username: 'admin',
        email: 'admin@noticeboard.iot',
        password: 'adminpassword123',
        fullName: 'System Administrator',
        role: 'admin',
      });
      console.log('[Auth] Default admin account initialized: admin / adminpassword123');
    }
  } catch (err) {
    console.warn('[Auth Init]:', err.message);
  }

  // ── Background Scheduling Engine ─────────────────────────────────────────
  // Runs every 30 seconds to automatically transition notice statuses:
  //   scheduled → active  (when scheduledFor <= now)
  //   active    → expired (when expiresAt    <= now)
  // This fires independently of any HTTP request, so scheduling/expiry
  // always works — even when no browser is open.
  const Notice = require('./models/Notice');

  const runScheduler = async () => {
    try {
      const now = new Date();

      // 1. Activate scheduled notices whose time has arrived (not yet expired)
      const activated = await Notice.updateMany(
        { status: 'scheduled', scheduledFor: { $lte: now }, expiresAt: { $gt: now } },
        { $set: { status: 'active' } }
      );

      // 2. Expire any active/scheduled notices that are past their expiresAt
      const expired = await Notice.updateMany(
        { status: { $in: ['active', 'scheduled'] }, expiresAt: { $lte: now } },
        { $set: { status: 'expired' } }
      );

      if (activated.modifiedCount > 0 || expired.modifiedCount > 0) {
        console.log(
          `[Scheduler] ${activated.modifiedCount} notice(s) activated, ` +
          `${expired.modifiedCount} notice(s) expired at ${now.toISOString()}`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error during status refresh:', err.message);
    }
  };

  // Run once immediately on startup, then every 30 seconds
  runScheduler();
  setInterval(runScheduler, 30 * 1000);
  console.log('[Scheduler] Notice status engine started (30s interval).');
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    service: 'BLE Smart Notice Board API (Single ESP32 + OLED)',
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`BLE Smart Notice Board Server running on port ${PORT}`);
  console.log(`API Endpoints available at http://localhost:${PORT}/api`);
  console.log(`===============================================`);
});

module.exports = app;
