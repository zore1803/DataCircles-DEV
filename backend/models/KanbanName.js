const mongoose = require('mongoose');

const kanbanNameSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
  },
  name: { type: String, default: "Deal" }
}, { timestamps: true });

module.exports = mongoose.model('KanbanName', kanbanNameSchema);
