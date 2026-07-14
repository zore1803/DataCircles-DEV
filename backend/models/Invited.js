// models/Invited.js
const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  permission: { type: String, enum: ['readonly', 'read-write'], required: true },
}, { _id: false });

const invitedSchema = new mongoose.Schema({
  email: { type: String, required: true },
  permissions: [permissionSchema],
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  pendingPayment: { type: Boolean },
  // Set when this invite requires an extra-seat purchase to complete. The
  // matching Razorpay order id — settlement (payment.captured webhook)
  // looks up this field to finalize the invite once the seat add-on clears.
  pendingSeatOrderId: { type: String },
  invitedByName: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Invited', invitedSchema);