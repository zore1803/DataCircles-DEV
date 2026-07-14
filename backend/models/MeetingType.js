const mongoose = require("mongoose");

const meetingTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("MeetingType", meetingTypeSchema);
