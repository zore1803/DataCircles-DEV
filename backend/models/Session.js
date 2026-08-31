// models/Session.js
//
// DataCircles application session — the authoritative record of a logged-in
// browser/device. Auth0 (Google) and phone OTP both authenticate identity;
// this model is what DataCircles itself uses to authorize requests and to
// enforce the max-2-concurrent-sessions-per-user policy.
//
// Concurrency: `slot` (0 or 1) plus the compound unique index below is what
// makes "at most 2 live sessions per user" hold even under concurrent
// establish requests — see backend/services/sessionService.js.
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
  },
  slot: {
    type: Number,
    required: true,
    enum: [0, 1],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  ip: String,
  userAgent: String,
  deviceLabel: String,
  // Server-only HMAC key used to derive this session's CSRF token
  // (HMAC(csrfSecret, sessionId)). Never sent to the client raw.
  csrfSecret: {
    type: String,
    required: true,
  },
});

sessionSchema.index({ userId: 1, slot: 1 }, { unique: true });
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

module.exports = mongoose.model("Session", sessionSchema);
