// models/FormVersion.js
// Immutable structural snapshot — FORMS_DOMAIN_MODEL.md §FormVersion, FORMS_SCHEMA.md §3.
// `layout` and `schemaHash` are immutable after creation (enforced via `immutable: true` per
// FORMS_SCHEMA_IMPLEMENTATION_NOTES.md, not a blanket pre-save hook). `resolvedFields` is the
// one deliberate, narrow exception — may be refreshed in place on a non-structural republish
// (FORMS_SCHEMA.md §3a) without violating the immutability guarantee, since neither `layout`
// nor `schemaHash` change and no submission's interpretation is altered.
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
    height: Number,
    url: String,
    alt: String,
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
