// models/Wallet.js
const mongoose = require('mongoose');

// Fast-access current balance only. The WalletTransaction ledger is the source
// of truth for what happened; this document is derived state kept in sync
// inside the same Mongo transaction as every ledger write (walletService).
const walletSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    // Denominated in credits, not rupees. Fractional credits are allowed
    // (usage pricing like 0.20 credits/message).
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);
