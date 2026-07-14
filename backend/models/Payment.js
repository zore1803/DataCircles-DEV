const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    bank: String,
    paymentType: {
      type: String,
      enum: ["Card", "Cash", "Cheque", "EMI", "Net Banking", "UPI"],
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    notes: String,
    direction: { type: String, enum: ["IN", "OUT"], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
