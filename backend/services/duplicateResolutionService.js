// services/duplicateResolutionService.js
// Applies a decision to a DuplicateReview. Per FORMS_ARCHITECTURE.md D9 (revised after product
// clarification), the system NEVER auto-resolves a duplicate at any confidence score — a human
// always chooses. The v1 product surface exposes exactly two Review Center actions:
//   - keepSeparate  ("Keep both" — create a new CRM record, existing one untouched)
//   - linkToExisting ("Keep existing" — no new record, submission attaches to the existing one)
// mergeIntoExisting (field-by-field reconciliation) is NOT wired into any v1 flow and the Review
// UI does not expose it — kept here as a documented future capability, not dead code to delete,
// since the schema's DuplicateReview.decision enum still has room for "merged".
const DuplicateReview = require("../models/DuplicateReview");
const FormSubmission = require("../models/FormSubmission");
const contactService = require("./contactService");
const companyService = require("./companyService");
const vendorService = require("./vendorService");
// Only for resuming a Contact-form's deferred Company bucket once a Contact review resolves — see
// submissionService.resumeCompanyProcessing's own doc comment. No circular dependency: submissionService
// never requires this file.
const submissionService = require("./submissionService");

const CREATE_SERVICE_BY_MODULE = {
  Contact: (org, data, opts) => contactService.createContact(org, data, opts),
  Company: (org, data, opts) => companyService.createCompany(org, data, opts),
  Vendor: (org, data, opts) => vendorService.createVendor(org, data, opts),
};

const UPDATE_SERVICE_BY_MODULE = {
  Contact: (id, org, data, opts) => contactService.updateContact(id, org, data, opts),
  Company: (id, org, data, opts) => companyService.updateCompany(id, org, data, opts),
  Vendor: (id, org, data, opts) => vendorService.updateVendor(id, org, data, opts),
};

/**
 * Purpose: Find the Contact this submission's (deferred) Company decision should link to. Checks
 * `resultingRecords` first (the Contact was newly created), and if that's empty, falls back to the
 * submission's own resolved Contact-module DuplicateReview (the Contact was "Keep Existing"-linked).
 * This fallback exists because `resultingRecords` deliberately excludes linked (non-created) records
 * — per the schema's own stated invariant, a linked record's source of truth is the DuplicateReview
 * itself, not `resultingRecords`. Before `resumeCompanyProcessing` existed, the Company bucket only
 * ever ran once a Contact had been freshly created (always pushed to `resultingRecords`), so this
 * fallback path was never reachable; resuming a Company review after a "Keep Existing" Contact
 * resolution is what first exercises it.
 * Inputs: submission (FormSubmission doc)
 * Outputs: Promise<ObjectId|null>
 */
async function findLinkedContactId(submission) {
  const created = submission.resultingRecords.find((r) => r.module === "Contact");
  if (created) return created.recordId;

  const linkedContactReview = await DuplicateReview.findOne({
    formSubmission: submission._id,
    module: "Contact",
    decision: "linked_to_existing",
  });
  return linkedContactReview ? linkedContactReview.existingRecord.recordId : null;
}

/**
 * Purpose: "Keep both" — resolve a review by creating a new CRM record, existing record
 * untouched (D9 outcome 1).
 * Inputs: reviewId, organizationId, { decidedByUserId }
 * Outputs: Promise<{ review, createdRecord }>
 * Side effects: one DuplicateReview update, one new CRM record via the module's create service
 */
async function keepSeparate(reviewId, organizationId, { decidedByUserId } = {}) {
  const review = await DuplicateReview.findOne({ _id: reviewId, organization: organizationId });
  if (!review) throw new Error("DuplicateReview not found");
  // A review is resolved exactly once. Without this guard, a retried/double-submitted request
  // would create a second CRM record and re-fire the Company-resume hook a second time.
  if (review.decision !== "pending") throw new Error("Duplicate review has already been resolved");

  const createFn = CREATE_SERVICE_BY_MODULE[review.module];
  if (!createFn) throw new Error(`Unsupported module: ${review.module}`);
  const createdRecord = await createFn(organizationId, review.incomingData, { actingUserId: decidedByUserId, createdByUserId: decidedByUserId, userId: decidedByUserId });

  review.decision = "kept_separate";
  review.decidedBy = decidedByUserId;
  review.decidedAt = new Date();
  await review.save();

  if (review.formSubmission) {
    const submission = await FormSubmission.findById(review.formSubmission);
    if (submission) {
      if (review.module === "Company") {
        const contactId = await findLinkedContactId(submission);
        if (contactId) {
          const updateFn = UPDATE_SERVICE_BY_MODULE["Contact"];
          await updateFn(contactId, organizationId, { company: createdRecord._id }, { lastUpdatedByUserId: decidedByUserId });
        }
      }

      await FormSubmission.findByIdAndUpdate(review.formSubmission, {
        $push: { resultingRecords: { module: review.module, recordId: createdRecord._id } },
        importStatus: "imported",
        reviewStatus: "resolved",
        reviewedBy: decidedByUserId,
        reviewedAt: new Date(),
      });

      // Resume any Company-bucket processing deferred at submission time because the Contact itself
      // needed review (submitToForm skips the Company bucket entirely in that case — see
      // resumeCompanyProcessing's own doc comment). Re-fetch so the idempotency guard inside it sees
      // this function's own $push above.
      if (review.module === "Contact") {
        const refreshedSubmission = await FormSubmission.findById(review.formSubmission);
        await submissionService.resumeCompanyProcessing(refreshedSubmission, createdRecord._id);
      }
    }
  }

  return { review, createdRecord };
}

/**
 * Purpose: "Link / attach" — resolve a review by attaching the submission to the existing
 * record; no new CRM record is created, no field values are overwritten (D9 outcome 3).
 * Inputs: reviewId, organizationId, { decidedByUserId (null/undefined for a system-driven
 *   auto-attach — see actor shape note) }
 * Outputs: Promise<{ review }>
 * Side effects: one DuplicateReview update; one FormSubmission update if formSubmission is set
 */
async function linkToExisting(reviewId, organizationId, { decidedByUserId } = {}) {
  const review = await DuplicateReview.findOne({ _id: reviewId, organization: organizationId });
  if (!review) throw new Error("DuplicateReview not found");
  // Same idempotency guard as keepSeparate — see its comment for why.
  if (review.decision !== "pending") throw new Error("Duplicate review has already been resolved");

  review.decision = "linked_to_existing";
  review.decidedBy = decidedByUserId || undefined;
  review.decidedAt = new Date();
  await review.save();

  if (review.formSubmission) {
    const submission = await FormSubmission.findById(review.formSubmission);
    if (submission) {
      if (review.module === "Company") {
        const contactId = await findLinkedContactId(submission);
        if (contactId) {
          const updateFn = UPDATE_SERVICE_BY_MODULE["Contact"];
          await updateFn(contactId, organizationId, { company: review.existingRecord.recordId }, { lastUpdatedByUserId: decidedByUserId });
        }
      }

      await FormSubmission.findByIdAndUpdate(review.formSubmission, {
        importStatus: "imported",
        reviewStatus: "resolved",
        reviewedBy: decidedByUserId || undefined,
        reviewedAt: new Date(),
      });

      // Same resume step as keepSeparate — the Contact here is the pre-existing linked record, not
      // a newly-created one, so contactId comes from review.existingRecord instead of createdRecord.
      if (review.module === "Contact") {
        const refreshedSubmission = await FormSubmission.findById(review.formSubmission);
        await submissionService.resumeCompanyProcessing(refreshedSubmission, review.existingRecord.recordId);
      }
    }
  }

  return { review };
}

/**
 * Purpose: "Merge" — field-by-field reconciliation, human-driven only (D9: never automated).
 * The caller (Review Center UI/controller) supplies the already-resolved field values to write;
 * this function applies them to the existing record via the module's update service. It does
 * NOT decide which value wins per field — that judgment happens in the UI, not here.
 * Inputs: reviewId, organizationId, { decidedByUserId, resolvedFieldValues: plain object to
 *   apply to the existing record }
 * Outputs: Promise<{ review, updatedRecord }>
 * Side effects: one DuplicateReview update, one CRM record update via the module's update service
 */
async function mergeIntoExisting(reviewId, organizationId, { decidedByUserId, resolvedFieldValues } = {}) {
  const review = await DuplicateReview.findOne({ _id: reviewId, organization: organizationId });
  if (!review) throw new Error("DuplicateReview not found");
  if (!resolvedFieldValues) throw new Error("mergeIntoExisting requires resolvedFieldValues — merge is never automated (D9)");

  const updateFn = UPDATE_SERVICE_BY_MODULE[review.module];
  if (!updateFn) throw new Error(`Unsupported module: ${review.module}`);
  const updatedRecord = await updateFn(review.existingRecord.recordId, organizationId, resolvedFieldValues, {
    lastUpdatedByUserId: decidedByUserId,
  });

  review.decision = "merged";
  review.decidedBy = decidedByUserId;
  review.decidedAt = new Date();
  await review.save();

  if (review.formSubmission) {
    await FormSubmission.findByIdAndUpdate(review.formSubmission, {
      importStatus: "imported",
      reviewStatus: "resolved",
      reviewedBy: decidedByUserId,
      reviewedAt: new Date(),
    });
  }

  return { review, updatedRecord };
}

module.exports = { keepSeparate, linkToExisting, mergeIntoExisting };
