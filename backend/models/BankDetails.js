// models/BankDetails.js (updated with organization field)
const mongoose = require("mongoose");

const bankDetailsSchema = new mongoose.Schema({
  contact: {
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  bank: { type: String, required: true },
  accountHolder: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  branch: { type: String, required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }, // Added organization field
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Added user field for tracking
}, { timestamps: true });

module.exports = mongoose.model("BankDetails", bankDetailsSchema);
