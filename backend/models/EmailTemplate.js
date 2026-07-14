const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["task", "meeting", "deal"], // type of trigger
    required: true
  },
  dealTransition: {
    from: { type: String },
    to: { type: String }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

// For faster lookups by organization
emailTemplateSchema.index({ organization: 1, type: 1 });

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
