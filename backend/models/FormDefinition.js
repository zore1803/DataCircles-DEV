// models/FormDefinition.js
// Aggregate root for the Forms module — see FORMS_DOMAIN_MODEL.md §4 and FORMS_SCHEMA.md §1.
// FormDefinition IS the editable working copy (FORMS_DOMAIN_MODEL.md's explicit statement).
// `status` is reachability-only; `hasUnpublishedChanges` is the independent draft-divergence
// flag — see FORMS_SCHEMA.md §1/§2 for why these are two separate fields, not one.
const mongoose = require("mongoose");
const { Schema } = mongoose;

// --- Layout: tagged union of Section > Element, per FORMS_SCHEMA.md §1a ---
// Mongoose's native discriminator support handles nested (array-within-array) discriminators
// poorly (see FORMS_SCHEMA_IMPLEMENTATION_NOTES.md), so this is a single flexible subschema
// validated per `type` via a pre-validate hook rather than Schema.discriminator().

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

const elementSchema = new Schema(
  {
    id: { type: String, required: true }, // client-generated stable string, not a Mongo _id — see §1a note
    type: {
      type: String,
      required: true,
      enum: ["field", "heading", "paragraph", "divider", "spacer", "image", "submitButton"],
    },
    order: { type: Number, required: true },

    // type: "field"
    fieldId: String, // stable ID (custom field ObjectId as string, or "system:module.fieldname" — §1b/§1c)
    source: { type: String, enum: ["system", "custom"] },
    // Which CRM module this captured value routes into — DERIVED, never user-editable. Always
    // equals the owning module of the referenced field. Defaults to the form's own `module` for
    // single-module forms; the only supported cross-module case is a Company field inside a
    // Contact form (FORMS_ARCHITECTURE.md §2.5). Computed at publish time (formVersionService
    // .resolveLayoutTargetModules), never set by any UI. See FORMS_SCHEMA.md §1a and invariant #17.
    targetModule: { type: String, enum: ["Contact", "Company", "Vendor"] },
    required: Boolean,
    helpText: String,
    placeholder: String,
    defaultValue: Schema.Types.Mixed,
    validationOverrides: validationOverridesSchema,

    // type: "heading" | "paragraph"
    text: String,
    fontSize: { type: String, enum: ["small", "normal", "large", "xlarge"] },
    fontWeight: { type: String, enum: ["normal", "bold"] },
    textAlign: { type: String, enum: ["left", "center", "right"] },

    // type: "spacer"
    height: Number,

    // type: "image"
    url: String,
    alt: String,

    // type: "submitButton"
    label: String,
    color: String,
    position: { type: String, enum: ["left", "center", "right"] },
    style: String,
  },
  { _id: false },
);

// Per-type minimal shape enforcement — the closest practical equivalent to a discriminator
// given Mongoose's nested-array-discriminator limitations (FORMS_SCHEMA_IMPLEMENTATION_NOTES.md).
elementSchema.pre("validate", function (next) {
  if (this.type === "field" && !this.fieldId) {
    return next(new Error("Element of type 'field' requires fieldId"));
  }
  if (this.type === "field" && !this.source) {
    return next(new Error("Element of type 'field' requires source"));
  }
  next();
});

const sectionSchema = new Schema(
  {
    id: { type: String, required: true }, // client-generated stable string, not a Mongo _id
    title: String,
    description: String,
    order: { type: Number, required: true },
    elements: [elementSchema],
  },
  { _id: false },
);

// --- Theme: presentation-only, deliberately shallow (FORMS_SCHEMA.md §1b) ---

const themeSchema = new Schema(
  {
    logoUrl: String,
    backgroundColor: String,
    backgroundImageUrl: String,
    fontFamily: String,
    buttonColor: String,
    buttonPosition: { type: String, enum: ["left", "center", "right"] },
    buttonStyle: String,
    formAlignment: { type: String, enum: ["top", "left", "right", "center"], default: "top" },
  },
  { _id: false },
);

// --- FormPublishState: embedded subdocument, not a collection (FORMS_SCHEMA.md §2) ---

const publishStateSchema = new Schema(
  {
    publicSlug: { type: String }, // uniqueness enforced via a partial index below, not `unique` here
    activeFormVersionId: { type: Schema.Types.ObjectId, ref: "FormVersion" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    notifyOwnerOnSubmit: { type: Boolean, default: false },
    // Two values, not three — see FORMS_ARCHITECTURE.md D9 (revised after product clarification):
    // the system never auto-resolves a duplicate at any confidence score. "review_queue" always
    // flags-and-asks; "allow_duplicates" skips detection entirely. No automatic-resolution value
    // exists — there is nothing for one to do.
    duplicateStrategy: {
      type: String,
      enum: ["review_queue", "allow_duplicates"],
      default: "review_queue",
    },
    tools: {
      captchaEnabled: { type: Boolean, default: false },
      captchaSiteKey: String,
      captchaSecretKeyRef: String, // reference/pointer to secret storage, never the raw secret itself
      privacyPolicyEnabled: { type: Boolean, default: false },
      privacyPolicyUrl: String,
    },
    thankYou: {
      type: { type: String, enum: ["message", "redirect"], default: "message" },
      message: { type: String, default: "Thank you for your submission." },
      redirectUrl: String,
    },
    publishedAt: Date,
  },
  { _id: false },
);

// --- FormDefinition ---

const formDefinitionSchema = new Schema(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    module: { type: String, required: true, enum: ["Contact", "Company", "Vendor"] },
    title: { type: String, required: true },

    // Reachability only — see file header note and FORMS_SCHEMA.md §1/§2.
    status: {
      type: String,
      required: true,
      enum: ["draft", "published", "paused", "archived"],
      default: "draft",
    },
    // Independent draft-divergence flag — orthogonal to `status`, not a duplicate of it
    // (FORMS_SCHEMA.md invariant #6 distinguishes this explicitly from the removed `isPublished`).
    hasUnpublishedChanges: { type: Boolean, default: false },

    layout: [sectionSchema],
    theme: { type: themeSchema, default: () => ({}) },
    publishState: { type: publishStateSchema, default: () => ({}) },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

formDefinitionSchema.index({ organization: 1, status: 1 });
formDefinitionSchema.index(
  { "publishState.publicSlug": 1 },
  { unique: true, partialFilterExpression: { "publishState.publicSlug": { $exists: true } } },
);
// Open Decision D4's required check — "does any form in this org reference this fieldId"
// before allowing a custom field to be deleted in Settings (FORMS_SCHEMA.md §7).
formDefinitionSchema.index({ organization: 1, "layout.elements.fieldId": 1 });

module.exports = mongoose.model("FormDefinition", formDefinitionSchema);
