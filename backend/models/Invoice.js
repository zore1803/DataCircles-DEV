const mongoose = require('mongoose');

const postalAddressSchema = new mongoose.Schema({
  addressLine1: { type: String, default: '' },
  addressLine2: { type: String, default: '' },
  pincode: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: '' },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
  invoiceNumber: { type: String, required: true },
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
  // Free-text footer blocks, printed on the document when present.
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  isTaxInvoice: { type: Boolean, default: false },
  signature: { type: String },
  signatureType: { type: String, enum: ['text', 'upload'], default: 'text' },
  receiverGSTIN: { type: String }, // Added receiverGSTIN field
  transactionType: { type: String, enum: ['intra', 'inter'], default: 'intra' },
  gstRate: { type: Number, min: 0, max: 100, default: 18 },
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
    // Carried over from the catalog Item/variant at the moment it's added to
    // the invoice (not looked up live), same as rate/hsn — matches the
    // per-item gstRate already stored on Quotation items.
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    // Carried over from the catalog Item/variant at the moment it's added to
    // the invoice, same as gstRate — lets computeDocument() know this line's
    // rate already includes GST instead of taxing it again.
    taxInclusive: { type: Boolean, default: false },
  }],
  // Payment records for this invoice
  payments: [{
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Net Banking', 'Cheque', 'Card', 'NEFT', 'RTGS', 'IMPS', 'EMI', 'TDS', 'Other'],
      default: 'UPI',
    },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    internalNotes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedAt: { type: Date, default: Date.now },
  }],
  digitalSignature: {
    status: { type: String, enum: ['pending', 'signed', 'cancelled', 'failed', 'none'], default: 'none' },
    provider: { type: String, enum: ['docusign', 'zoho', 'internal', 'other'] },
    documentId: { type: String },
    signedAt: { type: Date },
    signedUrl: { type: String }
  },
  // Set when this invoice was created via the "Duplicate" action, pointing
  // at the source invoice it was cloned from. Never set on the source itself.
  duplicatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  stockMovementStatus: { type: String, enum: ['pending', 'applied', 'reversed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
