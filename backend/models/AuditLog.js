const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'NOTICE_CREATED',
        'NOTICE_UPDATED',
        'NOTICE_DELETED',
        'NOTICE_SYNCED_BLE',
        'NOTICE_EXPIRED',
        'ADMIN_LOGIN',
        'DEVICE_CONNECTED',
      ],
    },
    noticeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notice',
    },
    noticeTitle: {
      type: String,
    },
    priority: {
      type: String,
    },
    user: {
      type: String,
      default: 'Admin',
    },
    details: {
      type: String,
    },
    deviceName: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
