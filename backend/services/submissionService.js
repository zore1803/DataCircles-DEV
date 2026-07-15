// services/submissionService.js
// The only Forms-specific service (per FORMS_ARCHITECTURE.md §2.1) — orchestrates the public
// submission pipeline: resolve form by slug → validate/coerce → duplicate-check → create-or-queue.
// Everything it calls (fieldCoercionService, module create/update services, duplicateDetection/
// ResolutionService) is itself reusable outside Forms. No Express dependency.
const FormDefinition = require("../models/FormDefinition");
const FormVersion = require("../models/FormVersion");
const FormSubmission = require("../models/FormSubmission");
const SubmissionEvent = require("../models/SubmissionEvent");
const DuplicateReview = require("../models/DuplicateReview");
const { coerceAdditionalFields } = require("./fieldCoercionService");
const duplicateDetectionService = require("./duplicateDetectionService");
const contactService = require("./contactService");
const companyService = require("./companyService");
const vendorService = require("./vendorService");
const { getCrmFieldNameForSystemId } = require("../utils/systemFields");

const mongoose = require("mongoose");

const CREATE_SERVICE_BY_MODULE = {
  Contact: (org, data) => contactService.createContact(org, data, { source: "form" }),
  Company: (org, data) => companyService.createCompany(org, data, { source: "form" }),
  Vendor: (org, data) => vendorService.createVendor(org, data, { source: "form" }),
};

async function logEvent(formSubmissionId, organization, eventType, payload) {
  return SubmissionEvent.create({
    formSubmission: formSubmissionId,
    organization,
    eventType,
    actor: { kind: "system", displayName: "submission pipeline" },
    payload,
  });
}

/**
 * Purpose: Coerce raw visitor-submitted values into typed field values, and validate required
 * fields are present — against the FormVersion's frozen layout, not the live draft (an old
 * published form must validate against what it actually asked, not today's edits).
 * Inputs: formVersion (FormVersion document), rawData (plain object keyed by fieldId)
 * Outputs: { processedData: plain object keyed by fieldId, validationErrors: [{fieldId,message}] }
 * Side effects: none
 */
function coerceAndValidate(formVersion, rawData) {
  const fieldMetaById = new Map(formVersion.resolvedFields.map((f) => [f.fieldId, f]));
  const processedData = {};
  const validationErrors = [];

  for (const section of formVersion.layout) {
    for (const el of section.elements) {
      if (el.type !== "field") continue;

      const meta = fieldMetaById.get(el.fieldId);
      const rawValue = rawData ? rawData[el.fieldId] : undefined;
      const isPresent = rawValue !== undefined && rawValue !== null && rawValue !== "";

      // A system field whose underlying CRM schema hard-requires a value (e.g. Company.industry)
      // must be enforced here even if an older FormVersion froze `required: false` for it — the
      // Builder now defaults these to required for newly-added fields, but a frozen layout can't be
      // retroactively edited, and letting one through here just moves the failure downstream to a
      // raw Mongoose ValidationError inside createCrmRecord instead of a clean 422.
      const isHardRequired = el.required || (meta && meta.baseRequired);

      if (isHardRequired && !isPresent) {
        validationErrors.push({ fieldId: el.fieldId, message: `${meta ? meta.label : el.fieldId} is required` });
        continue;
      }
      if (!isPresent) continue;

      // Reuse Phase 0's coercion rules (number/dropdown/string/text default) by shaping this as
      // a one-element additionalFields array through the existing pure-transform helper.
      const [coerced] = coerceAdditionalFields(
        [{ key: el.fieldId, value: rawValue }],
        meta ? { [el.fieldId]: { type: meta.type } } : {}
      );
      processedData[el.fieldId] = coerced.value;
    }
  }

  return { processedData, validationErrors };
}

/**
 * Purpose: Translate fieldId-keyed `processedData` into one plain CRM-schema-keyed payload PER
 * TARGET MODULE, routed by each field element's `targetModule` (frozen on the FormVersion layout
 * at publish time). A Contact form containing Company fields therefore produces both a `Contact`
 * bucket and a `Company` bucket, each shaped like a manual-create request body — never one merged
 * payload validated/coerced against a single module (FORMS_ARCHITECTURE.md §2.5; the merged-payload
 * approach was the architectural gap targetModule was added to close).
 *
 * The routing map is built from `formVersion.layout` (structure), and field metadata from
 * `formVersion.resolvedFields` (labels/source) — the two are joined in memory by fieldId, exactly
 * as coerceAndValidate already does. `targetModule` is read from layout only; it is deliberately
 * NOT duplicated into resolvedFields (FORMS_SCHEMA.md invariant #17).
 *
 * Inputs: formVersion (layout + resolvedFields), processedData (fieldId-keyed), defaultModule
 *   (the form's own module — used only as a fallback for any legacy field element frozen before
 *   targetModule existed, satisfying "default targetModule = form.module, no migration").
 * Outputs: { [module]: { ...systemFields, additionalFields: [...] } } — only modules that actually
 *   received a value are present.
 * Side effects: none
 */
function buildCrmPayloads(formVersion, processedData, defaultModule) {
  const metaById = new Map(formVersion.resolvedFields.map((f) => [f.fieldId, f]));

  const targetModuleById = new Map();
  for (const section of formVersion.layout) {
    for (const el of section.elements) {
      if (el.type === "field" && el.fieldId) {
        targetModuleById.set(el.fieldId, el.targetModule || defaultModule);
      }
    }
  }

  const payloads = {};
  for (const [fieldId, value] of Object.entries(processedData || {})) {
    const meta = metaById.get(fieldId);
    const targetModule = targetModuleById.get(fieldId);
    if (!meta || !targetModule) continue;

    if (!payloads[targetModule]) payloads[targetModule] = { additionalFields: [] };

    if (meta.source === "system") {
      const crmFieldName = getCrmFieldNameForSystemId(fieldId);
      if (crmFieldName) payloads[targetModule][crmFieldName] = value;
    } else if (meta.source === "custom") {
      payloads[targetModule].additionalFields.push({ key: meta.label, value });
    }
  }

  return payloads;
}

// A bucket is "meaningful" only if the visitor actually supplied at least one value in it — an
// empty Company bucket (Contact form where no company field was filled) must not create a blank
// Company record.
function hasMeaningfulData(payload) {
  if (!payload) return false;
  const hasSystem = Object.keys(payload).some(
    (k) => k !== "additionalFields" && payload[k] !== undefined && payload[k] !== null && payload[k] !== ""
  );
  const hasCustom = Array.isArray(payload.additionalFields) && payload.additionalFields.length > 0;
  return hasSystem || hasCustom;
}

/**
 * Purpose: Handle a public form submission end-to-end — the sole entry point for the public
 * POST /:publicSlug/submit endpoint (once that controller exists).
 * Inputs: publicSlug (String), rawData (plain object keyed by fieldId), sourceMeta ({ip,
 *   userAgent, utm, referrer })
 * Outputs: Promise<FormSubmissionDocument>
 * Side effects: one FormSubmission insert, one-or-more SubmissionEvent inserts, possibly a
 *   DuplicateReview insert, possibly a new/updated CRM record.
 * Errors thrown: throws (caller maps to 404) if publicSlug doesn't resolve to a published form
 * Known callers: public submit controller (future)
 */
async function submitToForm(publicSlug, rawData, sourceMeta = {}) {
  // organization is resolved EXCLUSIVELY from the slug — never accepted from the client
  // (FORMS_ARCHITECTURE.md §2.9, FORMS_SCHEMA.md invariant #7).
  const form = await FormDefinition.findOne({ "publishState.publicSlug": publicSlug, status: "published" });
  if (!form) throw new Error("Form not found or not published");

  const formVersion = await FormVersion.findById(form.publishState.activeFormVersionId);
  if (!formVersion) throw new Error("Form has no active version");

  const { processedData, validationErrors } = coerceAndValidate(formVersion, rawData);

  const hardMissingRequired = validationErrors.length > 0; // only required-field-presence is a hard failure (D8)

  const submission = await FormSubmission.create({
    formDefinition: form._id,
    formVersion: formVersion._id,
    organization: form.organization, // invariant #15: must equal formDefinition.organization — it does, same source
    submittedAt: new Date(),
    sourceMeta,
    rawData,
    processedData,
    processingStatus: hardMissingRequired ? "rejected" : "validated",
    reviewStatus: "not_required",
    importStatus: "not_imported",
    validationErrors,
  });

  await logEvent(submission._id, form.organization, "submission_received", { publicSlug });

  if (hardMissingRequired) {
    await logEvent(submission._id, form.organization, "validation_failed", { validationErrors });
    return submission;
  }

  await logEvent(submission._id, form.organization, "validated", {});

  // Translate fieldId-keyed processedData into one plain CRM-schema-keyed payload PER target
  // module (buildCrmPayloads' doc comment explains why). form.module is the fallback for any
  // legacy field element frozen before targetModule existed.
  const payloads = buildCrmPayloads(formVersion, processedData, form.module);

  const duplicateStrategy = form.publishState.duplicateStrategy;

  // --- Primary module (the form's own module) ---
  // The primary bucket is always processed first and always creates/queues a record; the
  // Company bucket of a Contact form is a DEPENDENT bucket handled afterwards, because a
  // Company review must be able to link back to the Contact that was just created
  // (duplicateResolutionService reads resultingRecords.find(r => r.module === "Contact")).
  const primaryPayload = payloads[form.module] || { additionalFields: [] };

  const primaryOutcome = await processModuleBucket({
    submission,
    form,
    module: form.module,
    payload: primaryPayload,
    duplicateStrategy,
    isPrimary: true,
  });

  // --- Dependent Company bucket (ONLY for a Contact form; DO NOT GENERALIZE) ---
  // The single supported cross-module relationship is Contact -> Company. Only attempt it when
  // the visitor actually filled at least one Company field, and only when a Contact record was
  // actually created this submission (if the Contact itself is under review, there is nothing to
  // link the Company to yet — the Company is handled when that Contact review resolves).
  if (form.module === "Contact" && hasMeaningfulData(payloads.Company) && primaryOutcome.createdRecord) {
    await handleRelatedCompany({
      submission,
      form,
      companyPayload: payloads.Company,
      contactRecord: primaryOutcome.createdRecord,
      duplicateStrategy,
    });
  }

  return FormSubmission.findById(submission._id);
}

// The ONLY threshold in this pipeline — "is this worth flagging to a human at all." Score never
// causes automatic resolution at any value (D9): the system flags-and-asks, a human always chooses
// Keep Both or Keep Existing. There is no higher "auto-resolve" band in this product.
const REVIEW_THRESHOLD = 80;

/**
 * Purpose: Run one module's payload bucket through the create-or-queue pipeline (duplicate
 * detection, prior-decision short-circuit, review creation). Used for the primary bucket directly;
 * the Company bucket goes through handleRelatedCompany, which layers Contact-linking on top of the
 * same primitives.
 * Inputs: { submission, form, module, payload, duplicateStrategy, isPrimary }
 * Outputs: Promise<{ createdRecord: Doc|null, review: Doc|null }>
 *   createdRecord is set only when a NEW record was actually created (not when linked/queued).
 * Side effects: possibly one CRM create, FormSubmission updates, SubmissionEvent + DuplicateReview.
 */
async function processModuleBucket({ submission, form, module, payload, duplicateStrategy, isPrimary }) {
  if (duplicateStrategy === "allow_duplicates") {
    const record = await createCrmRecord(submission, form, module, payload);
    return { createdRecord: record, review: null };
  }

  const matches = await duplicateDetectionService.findDuplicates({
    organization: form.organization,
    module,
    candidateData: payload,
  });

  const bestMatch = matches[0];
  if (!bestMatch || bestMatch.score < REVIEW_THRESHOLD) {
    const record = await createCrmRecord(submission, form, module, payload);
    return { createdRecord: record, review: null };
  }

  const priorDecision = await duplicateDetectionService.findPriorDecision({
    organization: form.organization,
    existingRecordModule: bestMatch.existingRecord.module,
    existingRecordId: bestMatch.existingRecord.recordId,
  });

  if (priorDecision) {
    // "Don't ask again" — a prior human decision about this pair already exists.
    await logEvent(submission._id, form.organization, "duplicate_skipped_prior_decision", {
      module,
      priorDecisionId: priorDecision._id,
      priorDecision: priorDecision.decision,
    });
    if (priorDecision.decision === "kept_separate") {
      const record = await createCrmRecord(submission, form, module, payload);
      return { createdRecord: record, review: null };
    }
    // kept-existing prior decision: nothing new is created for this bucket.
    if (isPrimary) {
      await FormSubmission.findByIdAndUpdate(submission._id, { importStatus: "imported" });
    }
    return { createdRecord: null, review: null };
  }

  const review = await duplicateDetectionService.createReview({
    organization: form.organization,
    module,
    formSubmission: submission._id,
    existingRecord: bestMatch.existingRecord,
    incomingData: payload,
    score: bestMatch.score,
    matchDetails: bestMatch.matchDetails,
    reasonSummary: bestMatch.reasonSummary,
  });

  await logEvent(submission._id, form.organization, "duplicate_detected", {
    module,
    reviewId: review._id,
    score: bestMatch.score,
    matchedOn: review.matchedOn,
  });

  // No auto-resolution branch at any score — every flagged match waits for a human to choose
  // Keep Both or Keep Existing via duplicateResolutionService (Review Center action).
  await FormSubmission.findByIdAndUpdate(submission._id, { reviewStatus: "needs_review" });
  return { createdRecord: null, review };
}

/**
 * Purpose: Handle the Company sub-payload of a Contact form once the Contact record already exists.
 * Explicit Contact -> Company flow (FORMS_ARCHITECTURE.md §2.5; DO NOT GENERALIZE beyond it):
 *  - no Company duplicate -> create the Company and link it onto the Contact immediately;
 *  - Company duplicate -> a Company-scoped DuplicateReview is queued (via processModuleBucket) and
 *    the deferred linking happens later in duplicateResolutionService when a human resolves it.
 * Inputs: { submission, form, companyPayload, contactRecord, duplicateStrategy }
 * Outputs: Promise<void>
 * Side effects: possibly one Company create + one Contact update (link), or one DuplicateReview.
 */
async function handleRelatedCompany({ submission, form, companyPayload, contactRecord, duplicateStrategy }) {
  const outcome = await processModuleBucket({
    submission,
    form,
    module: "Company",
    payload: companyPayload,
    duplicateStrategy,
    isPrimary: false,
  });

  if (outcome.createdRecord) {
    await linkContactToCompany(submission, form, contactRecord._id, outcome.createdRecord);
  }
  // If a Company review was queued instead, linking is deferred to duplicateResolutionService,
  // which reads the just-created Contact from submission.resultingRecords.
}

/**
 * Purpose: Resume Company-bucket processing for a Contact-form submission once its Contact review
 * has just been resolved (Keep Both or Keep Existing). At original submission time, `submitToForm`
 * skips the Company bucket ENTIRELY when the Contact itself needed review (see that function's
 * "Dependent Company bucket" comment) — the Company field values are never lost (FormSubmission's
 * `rawData`/`processedData` are written unconditionally, before any duplicate-detection branching),
 * they are simply never processed. This reconstructs the Company payload from the same frozen
 * FormVersion + the submission's own stored `processedData`, and routes it through the exact same
 * `processModuleBucket`/`handleRelatedCompany` path `submitToForm` would have used — reusing the
 * existing duplicate-detection logic rather than duplicating any of it.
 * This is a small, additive fix for the "Company bucket skipped" gap identified during UI-alignment
 * review — NOT a redesign of the review architecture. A submission still never carries two
 * concurrently-pending reviews; the Company review (if any) is simply created a moment later, once
 * this resume step runs, rather than never at all.
 * Inputs: submission (a freshly-reloaded FormSubmission doc, reflecting the just-resolved Contact
 *   decision), contactId (the Contact this submission's Company should link to — the newly created
 *   record on Keep Both, or the existing record on Keep Existing)
 * Outputs: Promise<void>
 * Side effects: same as handleRelatedCompany — possibly one Company create + Contact link, or one
 *   Company-scoped DuplicateReview. No-op if this form isn't Contact-module, if the Company section
 *   was left empty, or if Company processing already happened for this submission (idempotency guard
 *   — resolving a review twice must not create a second Company or a second review).
 * Known callers: duplicateResolutionService.keepSeparate / linkToExisting, only when the resolved
 *   review's module is "Contact".
 */
async function resumeCompanyProcessing(submission, contactId) {
  const form = await FormDefinition.findById(submission.formDefinition);
  if (!form || form.module !== "Contact") return; // only Contact -> Company, DO NOT GENERALIZE

  // Idempotency guard: never double-process. If a Company outcome already exists for this
  // submission (a created record, or an already-queued review), there is nothing to resume.
  const alreadyHasCompanyRecord = submission.resultingRecords.some((r) => r.module === "Company");
  if (alreadyHasCompanyRecord) return;
  const existingCompanyReview = await DuplicateReview.findOne({ formSubmission: submission._id, module: "Company" });
  if (existingCompanyReview) return;

  const formVersion = await FormVersion.findById(submission.formVersion);
  if (!formVersion) return;

  const payloads = buildCrmPayloads(formVersion, submission.processedData, form.module);
  if (!hasMeaningfulData(payloads.Company)) return; // Company section was left empty — nothing to resume

  await handleRelatedCompany({
    submission,
    form,
    companyPayload: payloads.Company,
    contactRecord: { _id: contactId },
    duplicateStrategy: form.publishState.duplicateStrategy,
  });
}

/**
 * Purpose: Attach a newly-created Company to the Contact created in the same submission — the
 * immediate (no-duplicate) half of the Contact -> Company relationship. Mirrors what
 * duplicateResolutionService does on the deferred (post-review) path, keeping both paths consistent.
 */
async function linkContactToCompany(submission, form, contactId, companyRecord) {
  // Mirror duplicateResolutionService's deferred link exactly: set the Contact's `company` to the
  // Company's ObjectId (a ref), with no acting user (public submission).
  await contactService.updateContact(
    contactId,
    form.organization,
    { company: companyRecord._id },
    {}
  );
  await logEvent(submission._id, form.organization, "contact_linked_to_company", {
    contactId,
    companyId: companyRecord._id,
  });
}

/**
 * Purpose: Create one CRM record for an explicit module bucket and record it on the submission.
 * Inputs: submission, form, module (explicit — NOT assumed to be form.module), crmPayload
 * Outputs: Promise<Doc> the created record
 * Side effects: one CRM create; FormSubmission.resultingRecords push + importStatus; one event.
 */
async function createCrmRecord(submission, form, module, crmPayload) {
  const createFn = CREATE_SERVICE_BY_MODULE[module];
  if (!createFn) throw new Error(`Unsupported module: ${module}`);
  // Defensive sanitization: some system fields (e.g. Contact.company) are ObjectId refs.
  // If the incoming payload contains a non-ObjectId string for such a ref (for example,
  // the literal string "company" due to a builder misconfiguration), Mongoose will throw
  // a CastError and crash the submission pipeline. Remove invalid ObjectId-like values
  // here so downstream related-bucket processing (Company creation + linking) can still
  // run and attach a Company to the Contact if appropriate.
  try {
    if (module === "Contact" && crmPayload && typeof crmPayload.company === "string") {
      if (!mongoose.Types.ObjectId.isValid(crmPayload.company)) {
        // log and drop the invalid company value to avoid a CastError
        console.warn(`submissionService: dropping invalid Contact.company value for submission ${submission._id}`);
        delete crmPayload.company;
      }
    }
  } catch (sanErr) {
    console.error("submissionService.sanitize error:", sanErr);
  }

  const record = await createFn(form.organization, crmPayload);

  await FormSubmission.findByIdAndUpdate(submission._id, {
    $push: { resultingRecords: { module, recordId: record._id } },
    importStatus: "imported",
  });
  await logEvent(submission._id, form.organization, "record_created", { module, recordId: record._id });
  return record;
}

module.exports = { submitToForm, coerceAndValidate, buildCrmPayloads, resumeCompanyProcessing };
