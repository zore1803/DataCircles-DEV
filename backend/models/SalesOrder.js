const mongoose = require('mongoose');

/*
 * Sales Order — deal-based, same shape as Quotation (backend/models/quotation.js)
 * so it plugs into the existing invoice-family PDF template
 * (shared/documentTemplates.js), Document Settings numbering, and the public
 * share pipeline (routes/publicDocumentRoutes.js) without those needing a
 * parallel code path.
 *
 * Whether/what a Sales Order was converted to is NOT stored here — mirrors
 * PurchaseOrder -> Purchase: salesOrderController computes it at read time
 * by looking up Invoices with a matching `salesOrder` field (see
 * attachConvertedInvoiceInfo), so there's no two-way pointer to keep in
 * sync. Converting never touches stock itself — only the resulting
 * Invoice's own stock logic does.
 */

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
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  rate: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  hsn: { type: String, default: '' },
  isVariant: { type: Boolean, default: false },
  parentItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
  discountType: { type: String, enum: ['amount', 'percentage'], default: 'amount' },
  discount: { type: Number, default: 0, min: 0 },
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
  taxInclusive: { type: Boolean, default: false },
});

const salesOrderSchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
  salesOrderPrefix: { type: String, default: 'SO-' },
  salesOrderNumber: { type: String, required: true },
  reference: { type: String, default: '' },
  date: { type: Date, required: true },
  // Expected delivery date reuses the shared template's generic "Due Date"
  // row (shared/documentTemplates.js reads doc.dueDate for every doc type),
  // so this field is deliberately named dueDate rather than a bespoke
  // expectedDeliveryDate to avoid a template-only fork for one document type.
  dueDate: { type: Date },
  amount: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  status: {
    type: String,
    enum: ['Draft', 'Confirmed', 'Cancelled'],
    default: 'Draft',
  },
  billingAddress: { type: postalAddressSchema, default: () => ({}) },
  shippingAddress: { type: postalAddressSchema, default: () => ({}) },
  discount: {
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  isRoundOff: { type: Boolean, default: true },
  transactionType: { type: String, enum: ['intra', 'inter'], default: 'intra' },
  signature: { type: String },
  signatureType: { type: String, enum: ['text', 'upload'], default: 'text' },
  receiverGSTIN: { type: String },
  items: [itemSchema],
  duplicatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder' },
}, { timestamps: true });

module.exports = mongoose.model('SalesOrder', salesOrderSchema);
