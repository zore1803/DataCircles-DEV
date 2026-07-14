// models/KanbanBoard.js (updated with organization field)
const mongoose = require('mongoose');

const kanbanBoardSchema = new mongoose.Schema({
  statuses: {
    type: [String],
    default: ['Open', 'Won', 'Close'] // default statuses
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

// Create index for better query performance
kanbanBoardSchema.index({ organization: 1, updatedAt: -1 });

module.exports = mongoose.model('KanbanBoard', kanbanBoardSchema);
