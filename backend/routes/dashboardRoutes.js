const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const AuditLog = require('../models/AuditLog');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard metrics, priority distribution, and recent audit logs
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();

    // 1. Activate scheduled notices whose time has arrived
    await Notice.updateMany(
      { scheduledFor: { $lte: now }, expiresAt: { $gt: now }, status: 'scheduled' },
      { status: 'active' }
    );
    // 2. Mark past notices as expired
    await Notice.updateMany(
      { expiresAt: { $lt: now }, status: { $in: ['active', 'scheduled'] } },
      { status: 'expired' }
    );

    const [
      totalNotices,
      activeNotices,
      scheduledNotices,
      urgentNotices,
      importantNotices,
      normalNotices,
      expiredNotices,
      recentLogs,
    ] = await Promise.all([
      Notice.countDocuments(),
      Notice.countDocuments({ status: 'active', scheduledFor: { $lte: now }, expiresAt: { $gt: now } }),
      Notice.countDocuments({ status: 'scheduled', scheduledFor: { $gt: now } }),
      Notice.countDocuments({ status: 'active', priority: 'Urgent', expiresAt: { $gt: now } }),
      Notice.countDocuments({ status: 'active', priority: 'Important', expiresAt: { $gt: now } }),
      Notice.countDocuments({ status: 'active', priority: 'Normal', expiresAt: { $gt: now } }),
      Notice.countDocuments({ status: 'expired' }),
      AuditLog.find().sort({ timestamp: -1 }).limit(10),
    ]);

    res.json({
      success: true,
      data: {
        totalNotices,
        activeNotices,
        scheduledNotices,
        urgentNotices,
        importantNotices,
        normalNotices,
        expiredNotices,
        recentLogs,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/dashboard/logs
// @desc    Get complete audit log history with search
router.get('/logs', async (req, res) => {
  try {
    const { action, limit = 50 } = req.query;
    let query = {};
    if (action && action !== 'All') {
      query.action = action;
    }

    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(parseInt(limit));
    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
