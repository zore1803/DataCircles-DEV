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

    // Column layout WITHOUT a nested element tree: elements stay a flat, ordered list and each one
    // declares how much of a 2-column grid it occupies ("half" puts two elements side by side).
    // A nested `columns` container would have forced every consumer that walks the layout
    // (coerceAndValidate, buildCrmPayloads, resolveFields, assertUniqueFieldIds, computeSchemaHash,
    // and the drag-and-drop sorting) to learn about nesting, for the same visual result.
    // Presentation-only, like fontSize — it changes how the visitor sees a field, not which field
    // it is or where it routes, so it does NOT mint a new FormVersion.
    layoutWidth: { type: String, enum: ["full", "half"] },

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
    // Per-element override of theme.textColor. Free-form CSS color (hex from the picker) rather
    // than an enum — presentation-only, same category as fontSize/fontWeight above.
    textColor: String,

    // type: "spacer"
    height: Number,

    // type: "divider" — additive, presentation-only (same category as heading/paragraph's
    // fontSize/fontWeight/textAlign above), no new element type or model introduced.
    dividerThickness: Number, // px
    dividerColor: String,
    dividerSpacingTop: Number, // px
    dividerSpacingBottom: Number, // px

    // type: "image" — an ordinary layout element (drag/reorder/delete) like heading/paragraph, not
    // form-wide chrome. Sizing/positioning are presentation-only, same category as heading's
    // fontSize/textAlign: `imageWidth` is a PERCENTAGE of the form's content width (not px) so the
    // image scales with the form on narrow screens instead of overflowing; alignment reuses the
    // existing shared `textAlign` field rather than introducing a parallel image-only enum.
    url: String,
    alt: String,
    imageWidth: Number, // percent, 10-100

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
    // Multi-page WITHOUT a new nesting level: a page is simply a run of consecutive sections, and
    // this flags the section that starts a new one. Adding a pages-contain-sections level would
    // have been a breaking schema change for every existing form and every consumer that walks
    // `layout`; a boolean is additive and defaults to the current single-page behaviour.
    //
    // STRUCTURAL, not presentation — splitting a form across pages changes what the visitor sees
    // and in what sequence, so it is part of computeSchemaHash and a change mints a new
    // FormVersion. (It also could not be a presentation field: mergePresentationIntoLayout only
    // refreshes a section's title/description, so a paging change would otherwise never reach an
    // already-published form.)
    startsNewPage: Boolean,
    elements: [elementSchema],
  },
  { _id: false },
);

// --- Theme: presentation-only, deliberately shallow (FORMS_SCHEMA.md §1b) ---

// Presentation tokens only. `preset` names a baseline token set (frontend
// src/components/forms/formThemes.js); every other field here is an OVERRIDE of that baseline, so a
// theme is resolved as `PRESET_TOKENS[preset]` + whatever is explicitly set below. Fields left
// unset (or cleared to "") fall through to the preset — which is also why forms created before
// presets existed keep rendering identically: no preset means the default one, and their own stored
// values still win over it.
//
// The preset table itself deliberately lives ONLY on the frontend: theme is never frozen into
// FormVersion (it's served live off FormDefinition, so a restyle needs no republish) and it never
// affects submission processing, so a server-side copy would be a second source of truth with
// nothing to gain. `preset` is stored as a free String rather than an enum so adding a preset is a
// frontend-only change and an unknown value degrades to the default instead of failing validation.
const themeSchema = new Schema(
  {
    preset: String,
    logoUrl: String,
    backgroundColor: String,
    backgroundImageUrl: String,
    // Colour tokens (overrides of the preset's palette).
    primaryColor: String,
    surfaceColor: String,
    mutedTextColor: String,
    borderColor: String,
    // Form surface.
    formMaxWidth: Number,
    formPadding: Number,
    formRadius: Number,
    formShadow: { type: String, enum: ["none", "sm", "md", "lg"] },
    // Inputs.
    inputStyle: { type: String, enum: ["outlined", "filled", "underline"] },
    inputRadius: Number,
    // Button.
    buttonRadius: Number,
    buttonWidth: { type: String, enum: ["auto", "full"] },
    buttonTextColor: String,
    fontFamily: String,
    // Global typography defaults — same category as fontFamily above (presentation-only, no
    // colors/palettes). Per-element heading/paragraph fontSize/fontWeight/textAlign overrides
    // (elementSchema above) still take precedence when set; these are just the form-wide fallback.
    fontSize: { type: String, enum: ["small", "normal", "large", "xlarge"] },
    fontWeight: { type: String, enum: ["normal", "bold"] },
    textAlign: { type: String, enum: ["left", "center", "right"] },
    // Form-wide default text color; individual heading/paragraph elements may override it.
    textColor: String,
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
