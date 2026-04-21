const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: { 
    type: String, 
    required: true,
    enum: ['login', 'logout', 'user_create', 'user_update', 'user_delete', 'user_suspend', 'user_activate', 'pg_create', 'pg_update', 'pg_delete', 'pg_verify', 'booking_create', 'booking_cancel', 'offer_sent', 'reminder_sent', 'export_data', 'settings_change']
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  userName: { 
    type: String 
  },
  userRole: { 
    type: String,
    enum: ['admin', 'owner', 'user', 'moderator']
  },
  ipAddress: { 
    type: String 
  },
  userAgent: { 
    type: String 
  },
  details: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

// Indexes for faster queries
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ userRole: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);