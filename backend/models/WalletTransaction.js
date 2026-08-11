// models/WalletTransaction.js
const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'CREDIT_PURCHASE',
        'FREE_CREDIT',
        'ADMIN_CREDIT',
        'USAGE_DEBIT',
        'REFUND',
        'ADJUSTMENT',
      ],
    },
    // Signed credits: positive for a credit, negative for a debit.
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true },
    // Preserved so purchased vs free/promotional credits stay distinguishable
    // later (expiry rules, revoking promo credits) even though V1 shows one balance.
    source: {
      type: String,
      enum: ['FREE', 'PURCHASE', 'ADMIN', 'USAGE'],
      required: true,
    },
    referenceType: { type: String },
    referenceId: { type: String },
    razorpayPaymentId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
  },
  { timestamps: true }
);

// DB-level backstop against double-crediting the same Razorpay order when two
// duplicate /wallet/verify calls race past the service's pre-check.
walletTransactionSchema.index(
  { referenceType: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: 'string' } },
  }
);

walletTransactionSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
