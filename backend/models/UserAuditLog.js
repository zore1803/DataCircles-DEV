// models/UserAuditLog.js
const mongoose = require('mongoose');

const userAuditLogSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['invite_sent', 'invite_revoked', 'user_deleted'],
    required: true,
  },
  targetEmail: { type: String, required: true },
  targetPermissions: [String], // Simplified for logging
  details: { type: mongoose.Schema.Types.Mixed }, // e.g., payment, seats, reason
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

userAuditLogSchema.index({ organization: 1, createdAt: -1 });
userAuditLogSchema.index({ performedBy: 1 });

module.exports = mongoose.model('UserAuditLog', userAuditLogSchema);