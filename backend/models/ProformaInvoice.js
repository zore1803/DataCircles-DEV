const mongoose = require('mongoose');

const postalAddressSchema = new mongoose.Schema({
  addressLine1: { type: String, default: '' },
  addressLine2: { type: String, default: '' },
  pincode: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: '' },
}, { _id: false });

const proformaInvoiceSchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
  performaInvoiceNumber: { type: String, required: true },
  date: { type: Date, required: true },
  dueDate: { type: Date },
  amount: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  status: { type: String, required: true },
  billingAddress: { type: postalAddressSchema, default: () => ({}) },
  shippingAddress: { type: postalAddressSchema, default: () => ({}) },
  discount: {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  style: { type: String, enum: ['Classic', 'Modern', 'Minimal', 'Elegant', 'Compact', 'Corporate', 'Vibrant', 'Mono', ''], default: '' },
  // Free-text footer blocks, printed on the document when present.
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  isTaxInvoice: { type: Boolean, default: false },
  transactionType: { type: String, enum: ['intra', 'inter'], default: 'intra' },
  signature: { type: String },
  signatureType: { type: String, enum: ['text', 'upload'], default: 'text' },
  receiverGSTIN: { type: String }, // Added receiverGSTIN field
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    name: { type: String, required: true },
    description: { type: String },
    rate: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    hsn: { type: String },
    isVariant: { type: Boolean, default: false },
    parentItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    discountType: { type: String, enum: ['amount', 'percentage'], default: 'amount' },
    discount: { type: Number, default: 0, min: 0 },
  }],
}, { timestamps: true });

module.exports = mongoose.model('ProformaInvoice', proformaInvoiceSchema);