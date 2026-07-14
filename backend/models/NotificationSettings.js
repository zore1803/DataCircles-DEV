const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Organization", 
    required: true 
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  tasks: { type: Boolean, default: false },
  meetings: { type: Boolean, default: false },
  deals: { type: Boolean, default: false },
  dealTransitions: [{
    from: { type: String },
    to: { type: String }
  }]
}, { timestamps: true });

// Index for better query performance
notificationSettingsSchema.index({ organization: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("NotificationSettings", notificationSettingsSchema);
