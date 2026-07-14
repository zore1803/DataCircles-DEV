const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Format: "organizationId_INV" or "organizationId_PI"
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);
