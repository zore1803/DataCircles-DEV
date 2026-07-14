// models/DuplicateReview.js
// A flagged potential match + eventual human decision — FORMS_DOMAIN_MODEL.md §DuplicateReview,
// FORMS_SCHEMA.md §6. Deliberately NOT Forms-specific in shape (per domain model §3 / D6 shared-
// engine decision), even though only Forms populates it in phase 1 — `formSubmission` is nullable
// so Import/manual-create can reuse this collection later without a migration.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const matchDetailSchema = new Schema(
  {
    signal: { type: String, required: true },
    matched: { type: Boolean, required: true },
    existingValue: Schema.Types.Mixed,
    incomingValue: Schema.Types.Mixed,
    weight: Number,
  },
  { _id: false },
);

const duplicateReviewSchema = new Schema(
  {
    // Denormalized — MUST always equal formSubmission.organization when formSubmission is set
    // (FORMS_SCHEMA.md invariant #15).
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    module: { type: String, required: true, enum: ["Contact", "Company", "Vendor"] },
    formSubmission: { type: Schema.Types.ObjectId, ref: "FormSubmission" }, // nullable, see file header

    existingRecord: {
      module: { type: String, enum: ["Contact", "Company", "Vendor"], required: true },
      // Polymorphic reference — needs refPath at read time (FORMS_SCHEMA_IMPLEMENTATION_NOTES.md).
      recordId: { type: Schema.Types.ObjectId, refPath: "existingRecord.module", required: true },
    },
    incomingData: Schema.Types.Mixed,

    score: { type: Number, required: true, min: 0, max: 100 },
    matchDetails: [matchDetailSchema],
    // matchedOn is NOT a stored field — see the virtual below (FORMS_SCHEMA.md invariant #14).
    reasonSummary: String,
    engineVersion: { type: String, required: true },

    decision: {
      type: String,
      required: true,
      enum: ["pending", "merged", "kept_separate", "linked_to_existing"],
      default: "pending",
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: Date,
  },
  { timestamps: true },
);

// Derived view over matchDetails, computed on read — never persisted, per invariant #14.
// Storing this separately would be two sources of truth for the same information.
duplicateReviewSchema.virtual("matchedOn").get(function () {
  return (this.matchDetails || []).filter((d) => d.matched).map((d) => d.signal);
});
duplicateReviewSchema.set("toJSON", { virtuals: true });
duplicateReviewSchema.set("toObject", { virtuals: true });

duplicateReviewSchema.index({ organization: 1, decision: 1 });
duplicateReviewSchema.index({ "existingRecord.module": 1, "existingRecord.recordId": 1 });

module.exports = mongoose.model("DuplicateReview", duplicateReviewSchema);
