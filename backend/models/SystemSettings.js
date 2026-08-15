const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    taskStatuses: {
      type: [String],
      default: ['Pending', 'In Progress', 'Completed'],
    },
    noteTypes: {
      type: [String],
      default: ['General Note', 'Meeting Note', 'Call Note', 'Follow-up Note'],
    },
    meetingTypes: {
      type: [String],
      default: ['General Meeting', 'Client Call', 'Demo', 'Follow-up'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
