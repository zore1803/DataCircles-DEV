const mongoose = require('mongoose');

/*
 * A saved Notes or Terms block that can be reused on documents.
 *
 * Organizations keep several per document type — e.g. a domestic and an export
 * set of terms for invoices — and mark one as the default that new documents
 * start from. Documents take a *copy* of the body when it's applied, so
 * editing a template never rewrites history on documents already issued.
 *
 * Distinct from DocumentSettings.defaultNotes/defaultTerms, which held a
 * single org-wide string and stays as the fallback for anything that hasn't
 * been migrated to templates.
 */
const KINDS = ['notes', 'terms'];
const DOC_TYPES = ['tax', 'performa', 'quotation', 'deliveryChallan'];

const documentFooterTemplateSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // 'notes' or 'terms' — the two footer blocks a document renders.
    kind: { type: String, enum: KINDS, required: true },
    // Which document type this template belongs to.
    docType: { type: String, enum: DOC_TYPES, required: true },
    title: { type: String, default: '', trim: true },
    body: { type: String, default: '' },
    // At most one default per (organization, kind, docType) — enforced in the
    // controller, which clears the flag on siblings before setting it here.
    isDefault: { type: Boolean, default: false },
    // Inactive templates stay listed but are skipped when picking a default.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

documentFooterTemplateSchema.index({ organization: 1, kind: 1, docType: 1, updatedAt: -1 });

module.exports = mongoose.model('DocumentFooterTemplate', documentFooterTemplateSchema);
module.exports.KINDS = KINDS;
module.exports.DOC_TYPES = DOC_TYPES;
