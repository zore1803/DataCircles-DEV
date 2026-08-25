// models/CallLog.js
const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema(
  {
    // Not required: a call log created from the Company Profile page has no
    // associated contact, only a company. One logged from the Contact page
    // sets contact instead, and createCallLog derives company from it.
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    // Short title/reason for the call (e.g. "Discovery Call") — set from the
    // Company Profile page's "Purpose / Title" field. Contact-page call logs
    // don't collect this, so it stays optional.
    purpose: { type: String },
    callType: { type: String, enum: ["Inbound", "Outbound"], default: "Outbound" },
    status: { type: String, enum: ["Connected", "Missed", "Voicemail", "No Answer"], default: "Connected" },
    duration: { type: Number }, // in seconds
    notes: { type: String }, // manual notes about call
  },
  { timestamps: true }
);

// Index for better query performance
callLogSchema.index({ organization: 1, updatedAt: -1 });
callLogSchema.index({ contact: 1, organization: 1 });
callLogSchema.index({ company: 1, organization: 1 });

module.exports = mongoose.model("CallLog", callLogSchema);
