const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    content: {
      type: String,
      required: [true, 'Notice message/content is required'],
      trim: true,
      maxlength: [500, 'Content cannot exceed 500 characters for OLED display'],
    },
    priority: {
      type: String,
      enum: ['Normal', 'Important', 'Urgent'],
      default: 'Normal',
    },
    category: {
      type: String,
      enum: ['General', 'Academic', 'Exam', 'Emergency', 'Event', 'Maintenance'],
      default: 'General',
    },
    scrollSpeed: {
      type: String,
      enum: ['Slow', 'Medium', 'Fast'],
      default: 'Medium',
    },
    displayDuration: {
      type: Number, // duration in seconds before next notice rotates on OLED
      default: 15,
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
    },
    status: {
      type: String,
      enum: ['active', 'scheduled', 'expired', 'archived'],
      default: 'active',
    },
    isSyncedToDevice: {
      type: Boolean,
      default: false,
    },
    lastSyncedAt: {
      type: Date,
    },
    syncedDeviceName: {
      type: String,
      default: 'ESP32 OLED Board',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notice must be created by an authenticated administrator'],
    },
    authorName: {
      type: String,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual check for whether notice has expired
noticeSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Pre-save middleware to automatically calculate status (scheduled vs active vs expired)
noticeSchema.pre('save', function (next) {
  const now = new Date();
  if (this.expiresAt && now > this.expiresAt) {
    this.status = 'expired';
  } else if (this.scheduledFor && this.scheduledFor > now) {
    this.status = 'scheduled';
  } else if (this.status !== 'archived') {
    this.status = 'active';
  }
  next();
});

module.exports = mongoose.model('Notice', noticeSchema);
