const mongoose = require('mongoose');

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
});

const quotationSchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
  quotationNumber: { type: String, required: true },
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
  discount: {
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  style: { type: String, enum: ['Classic', 'Modern', 'Minimal', 'Elegant'], default: 'Classic' },
  isTaxQuotation: { type: Boolean, default: false },
  signature: { type: String },
  signatureType: { type: String, enum: ['text', 'upload'], default: 'text' },
  receiverGSTIN: { type: String },
  items: [itemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);