const mongoose = require("mongoose");

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolder: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    bank: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    upi: { type: String, trim: true, default: "" },
    upiNumber: { type: String, trim: true, default: "" },
    openingBalance: { type: Number, default: null },
    notes: { type: String, trim: true, default: "" },
    beneficiaryName: { type: String, trim: true, default: "" },
    swiftCode: { type: String, trim: true, default: "" },
    isDefault: { type: Boolean, default: false },
    contact: {
      email: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bankDetailsSchema.index({ organization: 1, isDefault: 1 });

module.exports = mongoose.model("BankDetails", bankDetailsSchema);
