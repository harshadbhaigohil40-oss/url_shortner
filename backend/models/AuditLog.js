const mongoose = require("mongoose");

// Audit log retention: 90 days for security/compliance (extendable via env)
const AUDIT_LOG_RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 90;

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  userEmail: {
    type: String
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  targetResource: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  ipAddress: {
    type: String
  },
  details: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index for automatic audit log expiration (PII protection)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 });

// Compound index for common queries
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
