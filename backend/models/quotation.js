const mongoose = require('mongoose');

const postalAddressSchema = new mongoose.Schema({
  addressLine1: { type: String, default: '' },
  addressLine2: { type: String, default: '' },
  pincode: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  country: { type: String, default: '' },
}, { _id: false });

const itemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  rate: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  hsn: { type: String, default: '' },
  isVariant: { type: Boolean, default: false },
  parentItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  discountType: { type: String, enum: ['amount', 'percentage'], default: 'amount' },
  discount: { type: Number, default: 0, min: 0 },
  // Carried over from the catalog Item/variant at the moment it's added to
  // the quotation (not looked up live), same as rate/hsn — so a later
  // change to the product's own GST rate doesn't retroactively change
  // quotations that already reference it.
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
});

const quotationSchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
  // Kept separate from quotationNumber (rather than baked in once) so the
  // create/edit form's Prefix and Number boxes can round-trip independently
  // instead of the prefix having to be re-parsed back out of the combined
  // string.
  quotationPrefix: { type: String, default: 'QUO-' },
  quotationNumber: { type: String, required: true },
  // Free-text field (e.g. a customer's PO number) — has no bearing on
  // quotationNumber/numbering, purely informational.
  reference: { type: String, default: '' },
  date: { type: Date, required: true },
  dueDate: { type: Date },
  amount: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  status: { 
    type: String, 
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Void'], 
    required: true 
  },
  billingAddress: { type: postalAddressSchema, default: () => ({}) },
  shippingAddress: { type: postalAddressSchema, default: () => ({}) },
  discount: {
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  // Free-text footer blocks, printed on the document when present.
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  style: { type: String, enum: ['Classic', 'Modern', 'Minimal', 'Elegant', 'Compact', 'Corporate', 'Vibrant', 'Mono', ''], default: '' },
  isTaxQuotation: { type: Boolean, default: false },
  isRoundOff: { type: Boolean, default: true },
  transactionType: { type: String, enum: ['intra', 'inter'], default: 'intra' },
  signature: { type: String },
  signatureType: { type: String, enum: ['text', 'upload'], default: 'text' },
  receiverGSTIN: { type: String },
  items: [itemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);
