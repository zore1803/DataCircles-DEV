// controllers/formController.js
// Authenticated Forms management surface (Phase 1b — see FORMS_ARCHITECTURE.md §2.9). One
// controller covering Forms CRUD/publish, submissions, and duplicate reviews — deliberately not
// split into formController/builderController/submissionController/reviewController until there's
// enough real code in each to justify it (per explicit product decision — "don't split before there
// is code").
//
// Every handler is a thin adapter: validate → call an existing service (or, for simple list/create
// operations that have no dedicated service — same pattern contactController already uses — a plain
// Mongoose query) → shape the response. No business logic lives here; all of it already exists in
// formPublishService / duplicateResolutionService, built and verified in earlier phases.
const FormDefinition = require("../models/FormDefinition");
const FormVersion = require("../models/FormVersion");
const FormSubmission = require("../models/FormSubmission");
const DuplicateReview = require("../models/DuplicateReview");
const formPublishService = require("../services/formPublishService");
const duplicateResolutionService = require("../services/duplicateResolutionService");

// Mirrors publicFormController's error-classification approach — map known service error messages
// to the right HTTP status rather than a blanket 500. Anything unrecognized still falls through to
// 500 in the caller's catch block.
function classifyServiceError(err) {
  const msg = err.message || "";
  if (/not found/i.test(msg)) return 404;
  if (/empty layout|invalid form definition|is not permitted|Unsupported module/i.test(msg)) return 400;
  return null; // unrecognized — caller decides (500)
}

function handleServiceError(res, err, fallbackMessage) {
  const status = classifyServiceError(err);
  if (status) return res.status(status).json({ error: err.message });
  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
}

/**
 * GET /api/forms?page=&limit=&status=&module=&search=
 */
async function listForms(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const query = { organization: req.user.organization };
    if (req.query.status) query.status = req.query.status;
    if (req.query.module) query.module = req.query.module;
    if (req.query.search) query.title = { $regex: req.query.search, $options: "i" };

    const [forms, totalCount] = await Promise.all([
      FormDefinition.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      FormDefinition.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      forms,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("formController.listForms error:", err);
    res.status(500).json({ error: "Failed to list forms" });
  }
}

/**
 * POST /api/forms
 * Body: { title, module, description? }
 */
async function createForm(req, res) {
  try {
    const { title, module, description } = req.body || {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    if (!["Contact", "Company", "Vendor"].includes(module)) {
      return res.status(400).json({ error: 'module must be one of "Contact", "Company", "Vendor"' });
    }

    const form = await FormDefinition.create({
      organization: req.user.organization,
      title,
      module,
      description,
      status: "draft",
      layout: [],
      createdBy: req.user._id,
    });

    res.status(201).json({ form });
  } catch (err) {
    console.error("formController.createForm error:", err);
    res.status(500).json({ error: "Failed to create form" });
  }
}

/**
 * GET /api/forms/:id
 */
async function getForm(req, res) {
  try {
    const form = await FormDefinition.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!form) return res.status(404).json({ error: "Form not found" });

    let activeVersion = null;
    if (form.publishState.activeFormVersionId) {
      const version = await FormVersion.findById(form.publishState.activeFormVersionId, {
        versionNumber: 1,
        schemaHash: 1,
        createdAt: 1,
      });
      if (version) {
        activeVersion = { versionNumber: version.versionNumber, schemaHash: version.schemaHash, publishedAt: version.createdAt };
      }
    }

    res.json({ form, activeVersion });
  } catch (err) {
    console.error("formController.getForm error:", err);
    res.status(500).json({ error: "Failed to load form" });
  }
}

/**
 * PATCH /api/forms/:id
 * Body: { layout?, theme?, title? } — direct pass-through to formPublishService.saveDraft.
 */
async function updateForm(req, res) {
  try {
    const { layout, theme, title } = req.body || {};
    const form = await formPublishService.saveDraft(req.params.id, req.user.organization, { layout, theme, title });
    res.json({ form });
  } catch (err) {
    handleServiceError(res, err, "Failed to update form");
  }
}

/**
 * POST /api/forms/:id/publish — direct pass-through to formPublishService.publishForm.
 */
async function publishForm(req, res) {
  try {
    const { formDefinition, formVersion, versionWasReused } = await formPublishService.publishForm(
      req.params.id,
      req.user.organization,
      { actorUserId: req.user._id }
    );
    res.json({
      form: formDefinition,
      versionNumber: formVersion.versionNumber,
      versionWasReused,
      publicSlug: formDefinition.publishState.publicSlug,
    });
  } catch (err) {
    handleServiceError(res, err, "Failed to publish form");
  }
}

/**
 * GET /api/forms/:id/submissions?page=&limit=&reviewStatus=&importStatus=&processingStatus=
 */
async function listSubmissions(req, res) {
  try {
    const form = await FormDefinition.findOne({ _id: req.params.id, organization: req.user.organization }, { _id: 1 });
    if (!form) return res.status(404).json({ error: "Form not found" });

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const query = { formDefinition: form._id };
    if (req.query.reviewStatus) query.reviewStatus = req.query.reviewStatus;
    if (req.query.importStatus) query.importStatus = req.query.importStatus;
    if (req.query.processingStatus) query.processingStatus = req.query.processingStatus;

    const [submissions, totalCount] = await Promise.all([
      FormSubmission.find(query, { rawData: 0, processedData: 0 }) // list view: no audit payload, per submission detail split
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit),
      FormSubmission.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      submissions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("formController.listSubmissions error:", err);
    res.status(500).json({ error: "Failed to list submissions" });
  }
}

/**
 * GET /api/duplicate-reviews?page=&limit=&module=&decision=
 * Defaults to decision=pending (the Review Center inbox's primary view) unless explicitly overridden.
 */
async function listDuplicateReviews(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const query = { organization: req.user.organization };
    query.decision = req.query.decision || "pending";
    if (req.query.module) query.module = req.query.module;

    const [reviews, totalCount] = await Promise.all([
      DuplicateReview.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DuplicateReview.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      reviews,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("formController.listDuplicateReviews error:", err);
    res.status(500).json({ error: "Failed to list duplicate reviews" });
  }
}

/**
 * POST /api/duplicate-reviews/:id/keep-separate — direct pass-through to
 * duplicateResolutionService.keepSeparate.
 */
async function resolveKeepSeparate(req, res) {
  try {
    const { review, createdRecord } = await duplicateResolutionService.keepSeparate(
      req.params.id,
      req.user.organization,
      { decidedByUserId: req.user._id }
    );
    res.json({ review, createdRecord });
  } catch (err) {
    handleServiceError(res, err, "Failed to resolve review");
  }
}

/**
 * POST /api/duplicate-reviews/:id/link — direct pass-through to
 * duplicateResolutionService.linkToExisting.
 */
async function resolveLinkToExisting(req, res) {
  try {
    const { review } = await duplicateResolutionService.linkToExisting(
      req.params.id,
      req.user.organization,
      { decidedByUserId: req.user._id }
    );
    res.json({ review });
  } catch (err) {
    handleServiceError(res, err, "Failed to resolve review");
  }
}

module.exports = {
  listForms,
  createForm,
  getForm,
  updateForm,
  publishForm,
  listSubmissions,
  listDuplicateReviews,
  resolveKeepSeparate,
  resolveLinkToExisting,
};
