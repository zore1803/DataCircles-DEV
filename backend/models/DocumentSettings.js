const mongoose = require('mongoose');

const defaultDocumentTypeSettings = {
  invoice: {
    prefix: 'INV-',
    suffix: '',
    prefixes: ['INV-'],
    suffixes: [],
  },
  quote: {
    prefix: 'QT',
    suffix: '',
    prefixes: ['QT', 'QTN'],
    suffixes: [],
  },
  proformaInvoice: {
    prefix: 'PI',
    suffix: '',
    prefixes: ['PI', 'PFI'],
    suffixes: [],
  },
  deliveryChallan: {
    prefix: 'DC',
    suffix: '',
    prefixes: ['DC'],
    suffixes: [],
  },
};

const documentSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    invoicePrefix: {
      type: String,
      default: 'INV-',
      trim: true,
    },
    invoiceSuffix: {
      type: String,
      default: '',
      trim: true,
    },
    invoicePrefixes: {
      type: [String],
      default: ['INV-'],
    },
    invoiceSuffixes: {
      type: [String],
      default: [],
    },
    documentTypeSettings: {
      type: Object,
      default: defaultDocumentTypeSettings,
    },
    nextInvoiceNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DocumentSettings', documentSettingsSchema);
