const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

// Helper to auto-update scheduled and expired notices based on current time
const refreshNoticeStatuses = async () => {
  try {
    const now = new Date();
    // 1. Activate scheduled notices whose time has arrived (not yet expired)
    await Notice.updateMany(
      { scheduledFor: { $lte: now }, expiresAt: { $gt: now }, status: 'scheduled' },
      { $set: { status: 'active' } }
    );
    // 2. Mark past notices as expired
    await Notice.updateMany(
      { expiresAt: { $lte: now }, status: { $in: ['active', 'scheduled'] } },
      { $set: { status: 'expired' } }
    );
  } catch (err) {
    console.error('[Notice Status Refresh Error]:', err.message);
  }
};

// @route   GET /api/notices
// @desc    Get all notices with query filtering (priority, status, search)
router.get('/', async (req, res) => {
  try {
    const { priority, status, search, limit = 50 } = req.query;
    await refreshNoticeStatuses();

    let query = {};

    if (priority && priority !== 'All') {
      query.priority = priority;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    let notices = await Notice.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Dynamic verification fallback: ensure returned status always matches current time
    const now = new Date();
    const processedNotices = notices.map((n) => {
      const doc = n.toObject();
      if (doc.expiresAt && new Date(doc.expiresAt) <= now && doc.status !== 'archived') {
        doc.status = 'expired';
      } else if (doc.scheduledFor && new Date(doc.scheduledFor) > now && doc.status !== 'archived') {
        doc.status = 'scheduled';
      } else if (doc.status !== 'archived' && doc.status !== 'expired') {
        doc.status = 'active';
      }
      return doc;
    });

    res.json({
      success: true,
      count: processedNotices.length,
      data: processedNotices,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/notices/active
// @desc    Get currently active notices for ESP32 OLED display
router.get('/active', async (req, res) => {
  try {
    await refreshNoticeStatuses();
    const now = new Date();

    // Find active notices that are neither scheduled-in-future nor expired
    const notices = await Notice.find({
      status: 'active',
      scheduledFor: { $lte: now },
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    // Priority sort: Urgent (1) > Important (2) > Normal (3)
    const priorityWeight = { Urgent: 1, Important: 2, Normal: 3 };
    notices.sort((a, b) => (priorityWeight[a.priority] || 99) - (priorityWeight[b.priority] || 99));

    res.json({
      success: true,
      count: notices.length,
      data: notices,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/notices/:id
// @desc    Get single notice by ID
router.get('/:id', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/notices
// @desc    Create / Schedule a new notice (Admin Only)
router.post('/', protect, async (req, res) => {
  try {
    const {
      title,
      content,
      priority = 'Normal',
      category = 'General',
      scrollSpeed = 'Medium',
      displayDuration = 15,
      scheduledFor,
      expiresAt,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Notice title and content are required' });
    }

    const now = new Date();
    const scheduleDate = scheduledFor ? new Date(scheduledFor) : now;
    const expiryDate = expiresAt ? new Date(expiresAt) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Initial status determined by scheduleDate and expiryDate
    let initialStatus = 'active';
    if (expiryDate <= now) {
      initialStatus = 'expired';
    } else if (scheduleDate > now) {
      initialStatus = 'scheduled';
    }

    const notice = await Notice.create({
      title,
      content,
      priority,
      category,
      scrollSpeed,
      displayDuration,
      scheduledFor: scheduleDate,
      expiresAt: expiryDate,
      status: initialStatus,
      createdBy: req.user._id,
      authorName: req.user.fullName || req.user.username,
      syncedDeviceName: 'ESP32 OLED Board',
    });

    // Audit Log
    await AuditLog.create({
      action: 'NOTICE_CREATED',
      noticeId: notice._id,
      noticeTitle: notice.title,
      priority: notice.priority,
      user: req.user.username,
      details: initialStatus === 'scheduled'
        ? `Notice "${notice.title}" scheduled for future display at ${scheduleDate.toLocaleString()}`
        : `Notice "${notice.title}" posted immediately for ESP32 OLED display`,
    });

    res.status(201).json({
      success: true,
      message: initialStatus === 'scheduled' ? 'Notice scheduled successfully' : 'Notice posted successfully',
      data: notice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/notices/:id
// @desc    Update an existing notice (Admin Only)
router.put('/:id', protect, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    const {
      title,
      content,
      priority,
      category,
      scrollSpeed,
      displayDuration,
      scheduledFor,
      expiresAt,
      status,
    } = req.body;

    if (title) notice.title = title;
    if (content) notice.content = content;
    if (priority) notice.priority = priority;
    if (category) notice.category = category;
    if (scrollSpeed) notice.scrollSpeed = scrollSpeed;
    if (displayDuration) notice.displayDuration = displayDuration;
    if (scheduledFor) notice.scheduledFor = new Date(scheduledFor);
    if (expiresAt) notice.expiresAt = new Date(expiresAt);
    if (status) notice.status = status;

    const updatedNotice = await notice.save();

    await AuditLog.create({
      action: 'NOTICE_UPDATED',
      noticeId: updatedNotice._id,
      noticeTitle: updatedNotice.title,
      priority: updatedNotice.priority,
      user: req.user.username,
      details: `Admin ${req.user.username} updated notice "${updatedNotice.title}"`,
    });

    res.json({
      success: true,
      message: 'Notice updated successfully',
      data: updatedNotice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/notices/:id
// @desc    Delete a notice (Admin Only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    const noticeTitle = notice.title;
    const noticePriority = notice.priority;

    await Notice.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'NOTICE_DELETED',
      noticeTitle,
      priority: noticePriority,
      user: req.user.username,
      details: `Admin ${req.user.username} deleted notice "${noticeTitle}"`,
    });

    res.json({
      success: true,
      message: 'Notice deleted successfully',
      data: { id: req.params.id },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/notices/:id/sync-ble
// @desc    Mark notice as transmitted to ESP32 OLED via BLE (Admin Only)
router.post('/:id/sync-ble', protect, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }

    notice.isSyncedToDevice = true;
    notice.lastSyncedAt = new Date();
    notice.syncedDeviceName = 'ESP32 OLED Board';
    await notice.save();

    await AuditLog.create({
      action: 'NOTICE_SYNCED_BLE',
      noticeId: notice._id,
      noticeTitle: notice.title,
      priority: notice.priority,
      user: req.user.username,
      deviceName: 'ESP32 OLED Board',
      details: `Notice "${notice.title}" transmitted via BLE to ESP32 OLED Display`,
    });

    res.json({
      success: true,
      message: `Notice successfully synced to ESP32 OLED Board over Bluetooth!`,
      data: notice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
