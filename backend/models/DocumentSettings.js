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
    // Boilerplate the editor can drop into a document's footer on request.
    // Stored per organization; documents keep their own copy once inserted.
    //
    // The two flat fields below are the org-wide fallback and predate per-type
    // text. The *ByType maps hold the real values, keyed by document type
    // (tax | performa | quotation | deliveryChallan); a type with no entry
    // falls back to the flat field, so existing settings keep working.
    defaultNotes: {
      type: String,
      default: '',
    },
    defaultTerms: {
      type: String,
      default: '',
    },
    defaultNotesByType: {
      type: Object,
      default: {},
    },
    defaultTermsByType: {
      type: Object,
      default: {},
    },
    signatures: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ['upload', 'draw', 'type'], required: true },
        dataUrl: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('DocumentSettings', documentSettingsSchema);
