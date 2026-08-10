// One Google account's OAuth refresh token per organization — the "shared
// account" model: whichever Google account completes the one-time consent
// flow is the account every Google Meet link gets created under.
const mongoose = require("mongoose");

const googleIntegrationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    connectedEmail: { type: String },
    refreshToken: { type: String, required: true },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GoogleIntegration", googleIntegrationSchema);
