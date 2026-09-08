// models/FormVersion.js
// Immutable structural snapshot — FORMS_DOMAIN_MODEL.md §FormVersion, FORMS_SCHEMA.md §3.
// `layout` and `schemaHash` are immutable after creation (enforced via `immutable: true` per
// FORMS_SCHEMA_IMPLEMENTATION_NOTES.md, not a blanket pre-save hook).
//
// Two deliberate, narrow exceptions exist, both on the non-structural republish path
// (FORMS_SCHEMA.md §3a) and neither altering how any existing submission is interpreted:
//   1. `resolvedFields` — refreshed in place when field labels/options drift
//      (formVersionService.refreshResolvedFields). Not marked immutable, hence unremarkable.
//   2. `layout` — PRESENTATION-only properties within it (image url/size/position, heading text,
//      divider styling, help text, button label) are refreshed in place by
//      formVersionService.refreshLayoutPresentation, which bypasses this `immutable` flag via
//      `overwriteImmutable` on that one update. §3a deliberately keeps presentation out of
//      schemaHash so cosmetic edits don't mint a version and strand old submissions — without
//      this refresh, the frozen layout would keep serving whatever it held at first publish and
//      republishing a cosmetic change would visibly do nothing. Structural properties inside
//      layout (type/fieldId/source/targetModule/required/validationOverrides/order) are never
//      touched by it; changing one of those still mints a new version, as does schemaHash.
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Same shape as FormDefinition's layout — see that file's elementSchema/sectionSchema for the
// per-type validation note. Duplicated here (not shared via import) because this copy is frozen
// at publish time and must never be affected by future changes to FormDefinition's schema.
const validationOverridesSchema = new Schema(
  {
    min: Schema.Types.Mixed,
    max: Schema.Types.Mixed,
    regex: String,
    restrictPastDates: Boolean,
    restrictFutureDates: Boolean,
    allowedDomains: [String],
  },
  { _id: false },
);

const frozenElementSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["field", "heading", "paragraph", "divider", "spacer", "image", "submitButton"],
    },
    order: { type: Number, required: true },
    layoutWidth: { type: String, enum: ["full", "half"] }, // FormDefinition.elementSchema note
    fieldId: String,
    source: { type: String, enum: ["system", "custom"] },
    // Frozen copy of the derived routing (FormDefinition.elementSchema note). Part of the
    // structural snapshot: changing a field's routing between Contact and Company is a structural
    // change and mints a new FormVersion (it's included in schemaHash — FORMS_SCHEMA.md §3a).
    // NOT duplicated into resolvedFields — layout and resolvedFields are two projections of the
    // same FormVersion joined in memory by fieldId, and routing is a structural fact that belongs
    // with layout, not with per-field display metadata (FORMS_SCHEMA.md invariant #17).
    targetModule: { type: String, enum: ["Contact", "Company", "Vendor"] },
    required: Boolean,
    helpText: String,
    placeholder: String,
    defaultValue: Schema.Types.Mixed,
    validationOverrides: validationOverridesSchema,
    text: String,
    fontSize: { type: String, enum: ["small", "normal", "large", "xlarge"] },
    fontWeight: { type: String, enum: ["normal", "bold"] },
    textAlign: { type: String, enum: ["left", "center", "right"] },
    textColor: String,
    height: Number,
    dividerThickness: Number,
    dividerColor: String,
    dividerSpacingTop: Number,
    dividerSpacingBottom: Number,
    url: String,
    alt: String,
    imageWidth: Number, // percent, 10-100 (FormDefinition.elementSchema note)
    label: String,
    color: String,
    position: { type: String, enum: ["left", "center", "right"] },
    style: String,
  },
  { _id: false },
);

const frozenSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: String,
    description: String,
    order: { type: Number, required: true },
    startsNewPage: Boolean, // FormDefinition.sectionSchema note
    elements: [frozenElementSchema],
  },
  { _id: false },
);

// FORMS_SCHEMA.md §3: field *metadata as it existed at freeze time* — separate from `layout`,
// which holds only structure + fieldId references + per-form overrides.
const resolvedFieldSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    source: { type: String, enum: ["system", "custom"], required: true },
    label: String,
    type: String,
    // Semantic refinement of `type` where the CRM has none of its own — Contact.email is a plain
    // String on the model, so "this is an email address" can only travel as metadata. Read by
    // utils/fieldTypeContract.validateFieldValue. Frozen with the rest of the field's display
    // metadata so an old submission is still judged by the rules it was collected under.
    format: String,
    options: [String],
    baseRequired: Boolean, // the field definition's own required-ness, distinct from the
    // per-form `required` override living in `layout` — both must survive independently
  },
  { _id: false },
);

const formVersionSchema = new Schema(
  {
    formDefinition: {
      type: Schema.Types.ObjectId,
      ref: "FormDefinition",
      required: true,
      immutable: true,
    },
    // Display/ordering only — NEVER authoritative for "what's currently live."
    // That's always FormDefinition.publishState.activeFormVersionId. See FORMS_SCHEMA.md §3.
    versionNumber: { type: Number, required: true, immutable: true },
    // See FORMS_SCHEMA.md §3a for exactly what's hashed (structure only, not labels/options).
    schemaHash: { type: String, required: true, immutable: true },
    layout: { type: [frozenSectionSchema], immutable: true },
    // NOT immutable — may be refreshed in place on a non-structural republish (§3a).
    resolvedFields: [resolvedFieldSchema],
  },
  { timestamps: true },
);

// Enforces no duplicate version numbers per form; also the query path for "latest version" —
// see FORMS_SCHEMA_IMPLEMENTATION_NOTES.md for the atomic-increment concern under concurrent publish.
formVersionSchema.index({ formDefinition: 1, versionNumber: 1 }, { unique: true });

module.exports = mongoose.model("FormVersion", formVersionSchema);
