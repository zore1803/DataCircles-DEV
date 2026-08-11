// models/RazorpayWebhookEvent.js
// Phase 3A (Charge-at-Will webhook plumbing) — pure persistence, no business
// meaning. One row per received webhook (deduped by Razorpay's own event id,
// per Invariant 12 in CAW_BILLING_DESIGN.md). `subscription` is set only when
// a DIRECT correlation was found at persistence time (see handlers) — a null
// value just means no direct correlation existed yet, not an error.
const mongoose = require('mongoose');

const razorpayWebhookEventSchema = new mongoose.Schema({
  razorpayEventId: { type: String, required: true, unique: true }, // x-razorpay-event-id header
  event: { type: String, required: true }, // e.g. "token.confirmed", "payment.captured"
  payload: { type: mongoose.Schema.Types.Mixed, required: true }, // raw payload.* from the webhook body
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  receivedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('RazorpayWebhookEvent', razorpayWebhookEventSchema);
