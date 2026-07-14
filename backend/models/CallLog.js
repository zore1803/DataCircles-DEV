// models/CallLog.js
const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema(
  {
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    organization: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Organization', 
      required: true 
    },
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

module.exports = mongoose.model("CallLog", callLogSchema);
