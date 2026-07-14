// models/SubmissionEvent.js
// Append-only timeline of what happened to a FormSubmission — FORMS_DOMAIN_MODEL.md
// §SubmissionEvent, FORMS_SCHEMA.md §5. Separate collection, not embedded (resolved decision,
// per the cross-submission query need — see FORMS_SCHEMA.md §5 for the reasoning).
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Deliberately open, not a closed enum — see FORMS_DOMAIN_MODEL.md §SubmissionEvent: the set of
// things that can happen to a submission will keep growing (webhooks, automation, AI steps),
// and a closed enum would force a schema migration for every new capability.
const actorSchema = new Schema(
  {
    kind: { type: String, required: true }, // open string: "user" | "system" | "api_key" | "workflow" | ...
    id: Schema.Types.Mixed, // whatever identifier that actor kind uses (ObjectId, API key id, etc.)
    displayName: String, // present even when `id` doesn't resolve through the User collection
  },
  { _id: false },
);

const submissionEventSchema = new Schema(
  {
    formSubmission: { type: Schema.Types.ObjectId, ref: "FormSubmission", required: true, immutable: true },
    // Denormalized — MUST always equal formSubmission.organization (FORMS_SCHEMA.md invariant #15).
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, immutable: true },
    eventType: { type: String, required: true, immutable: true },
    occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
    actor: { type: actorSchema, required: true, immutable: true },
    // Shape defined by eventType, not validated at schema level (domain model: not a closed enum).
    payload: { type: Schema.Types.Mixed, immutable: true },
  },
  // No `updatedAt` — this collection is append-only, entries are never edited (invariant #13-adjacent).
  { timestamps: { createdAt: true, updatedAt: false } },
);

submissionEventSchema.index({ formSubmission: 1, occurredAt: 1 });
submissionEventSchema.index({ organization: 1, eventType: 1, occurredAt: 1 });

module.exports = mongoose.model("SubmissionEvent", submissionEventSchema);
