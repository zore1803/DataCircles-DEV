// models/FormSubmission.js
// One visitor's response — FORMS_DOMAIN_MODEL.md §FormSubmission, FORMS_SCHEMA.md §4.
// Stores BOTH formDefinition and formVersion (not one derived from the other) — see
// FORMS_DOMAIN_MODEL.md §4 for why both references are justified, not redundant.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const sourceMetaSchema = new Schema(
  {
    ip: String,
    userAgent: String,
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
    referrer: String,
  },
  { _id: false },
);

const uploadedFileSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    url: { type: String, required: true },
    originalName: String,
    size: Number,
    mimeType: String,
  },
  { _id: false },
);

const validationErrorSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const formSubmissionSchema = new Schema(
  {
    formDefinition: { type: Schema.Types.ObjectId, ref: "FormDefinition", required: true, immutable: true },
    formVersion: { type: Schema.Types.ObjectId, ref: "FormVersion", required: true, immutable: true },
    // Denormalized — MUST always equal formDefinition.organization (FORMS_SCHEMA.md invariant #15).
    // Server-derived only, never client-supplied (invariant #7).
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, immutable: true },

    submittedAt: { type: Date, required: true, default: Date.now, immutable: true },
    sourceMeta: sourceMetaSchema,

    // Write-once audit trail — never updated by application code after creation (invariant #11).
    rawData: { type: Schema.Types.Mixed, immutable: true },
    // Coerced/cleaned/enriched — produced by an idempotent pipeline (invariant #12). See
    // FORMS_SCHEMA_IMPLEMENTATION_NOTES.md for the Mongoose markModified() gotcha on this field.
    processedData: Schema.Types.Mixed,

    uploadedFiles: [uploadedFileSchema],

    // Three orthogonal statuses, not one combined enum — see FORMS_SCHEMA.md §4 for the full
    // reasoning and the valid-combinations state space.
    processingStatus: {
      type: String,
      required: true,
      enum: ["pending", "validated", "rejected"],
      default: "pending",
    },
    reviewStatus: {
      type: String,
      required: true,
      enum: ["not_required", "needs_review", "resolved"],
      default: "not_required",
    },
    importStatus: {
      type: String,
      required: true,
      enum: ["not_imported", "imported"],
      default: "not_imported",
    },

    validationErrors: [validationErrorSchema],

    // Polymorphic reference — needs Mongoose refPath at read time to populate correctly
    // (FORMS_SCHEMA_IMPLEMENTATION_NOTES.md); array of module/recordId pairs kept here as the persisted shape.
    // Only tracks records newly created by this submission.
    resultingRecords: [
      {
        module: { type: String, enum: ["Contact", "Company", "Vendor"] },
        recordId: { type: Schema.Types.ObjectId, refPath: "resultingRecords.module" },
      }
    ],

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  { timestamps: true },
);

formSubmissionSchema.index({ formDefinition: 1, reviewStatus: 1 });
formSubmissionSchema.index({ organization: 1, reviewStatus: 1 });
formSubmissionSchema.index({ organization: 1, submittedAt: 1 });
formSubmissionSchema.index({ submittedAt: 1 });

module.exports = mongoose.model("FormSubmission", formSubmissionSchema);
