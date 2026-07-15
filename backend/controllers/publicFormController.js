// controllers/publicFormController.js
// The public, UNAUTHENTICATED surface for form submissions (FORMS_ARCHITECTURE.md §2.9). There is no
// `req.user` here — the owning organization is resolved EXCLUSIVELY from the URL slug inside
// submissionService.submitToForm (never accepted from the client). This controller is a thin HTTP
// adapter: it shapes the request into (publicSlug, rawData, sourceMeta), delegates all business logic
// to the service, and maps the outcome to a public-safe response that never leaks CRM internals
// (record IDs, duplicate-review state, organization).
const submissionService = require("../services/submissionService");
const FormDefinition = require("../models/FormDefinition");
const FormVersion = require("../models/FormVersion");

// Best-effort client IP without trusting a spoofable header blindly: prefer Express's own req.ip
// (honors the app's trust-proxy setting), fall back to the socket address. Stored for audit only.
function clientIp(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || undefined;
}

// Only accept a known, bounded set of UTM keys from the client — never spread arbitrary client input
// into stored sourceMeta.
function pickUtm(utm) {
  if (!utm || typeof utm !== "object") return undefined;
  const { source, medium, campaign, term, content } = utm;
  const picked = { source, medium, campaign, term, content };
  const hasAny = Object.values(picked).some((v) => v !== undefined);
  return hasAny ? picked : undefined;
}

/**
 * POST /api/public/forms/:publicSlug/submit
 * Body: { data: { [fieldId]: value }, utm?: { source, medium, campaign, term, content } }
 * Responses:
 *   201 { success: true, submissionId }            — accepted (imported OR queued for duplicate review;
 *                                                     deliberately indistinguishable to a public visitor)
 *   422 { success: false, validationErrors: [...] } — a required field was missing (D8 hard failure)
 *   400 { error }                                   — malformed request body
 *   404 { error }                                   — slug doesn't resolve to a submittable (published) form
 *   500 { error }                                   — unexpected server error
 */
async function submitForm(req, res) {
  try {
    const { publicSlug } = req.params;

    const body = req.body || {};
    const rawData = body.data;
    // The submitted values must be a plain fieldId->value object. Reject anything else (array, string,
    // null, missing) before it reaches the service, so a malformed request is a clean 400 rather than
    // surfacing as a confusing downstream validation result.
    if (rawData === undefined || rawData === null || typeof rawData !== "object" || Array.isArray(rawData)) {
      return res.status(400).json({ error: "Request body must include a `data` object of field values." });
    }

    const sourceMeta = {
      ip: clientIp(req),
      userAgent: req.get("user-agent"),
      referrer: req.get("referer"), // HTTP header is historically misspelled "referer"
      utm: pickUtm(body.utm),
    };

    const submission = await submissionService.submitToForm(publicSlug, rawData, sourceMeta);

    // A hard validation failure (missing required field) is the one outcome the public caller needs to
    // act on — echo the per-field errors so the renderer can highlight them. Everything else (imported,
    // or queued for duplicate review) is a success from the submitter's perspective; we intentionally do
    // NOT reveal which, so the endpoint can't be used to probe whether a record already exists.
    if (submission.validationErrors && submission.validationErrors.length > 0) {
      return res.status(422).json({ success: false, validationErrors: submission.validationErrors });
    }

    return res.status(201).json({ success: true, submissionId: submission._id });
  } catch (err) {
    // submitToForm throws only for an unresolvable/unpublished slug or a form with no active version —
    // both mean "there is nothing here to submit to" from the public side, so 404 (never 500, which
    // would wrongly imply a server fault, and never a message that distinguishes the two internal cases).
    if (/not found|not published|no active version/i.test(err.message)) {
      return res.status(404).json({ error: "Form not found or not accepting submissions." });
    }
    console.error("publicFormController.submitForm error:", err);
    return res.status(500).json({ error: "Something went wrong processing your submission." });
  }
}

// exports at bottom
/**
 * GET /api/public/forms/:publicSlug
 * Returns only what's needed to render a public form.
 */
async function getPublicForm(req, res) {
  try {
    const { publicSlug } = req.params;
    const form = await FormDefinition.findOne(
      { "publishState.publicSlug": publicSlug, status: "published" },
      { title: 1, theme: 1, "publishState.activeFormVersionId": 1 }
    );
    if (!form) return res.status(404).json({ error: "Form not found or not accepting submissions." });

    const version = await FormVersion.findById(form.publishState.activeFormVersionId, {
      layout: 1,
      resolvedFields: 1,
    });
    if (!version) return res.status(404).json({ error: "Form not found or not accepting submissions." });

    res.json({
      title: form.title,
      theme: form.theme,
      layout: version.layout,
      resolvedFields: version.resolvedFields,
    });
  } catch (err) {
    console.error("publicFormController.getPublicForm error:", err);
    res.status(500).json({ error: "Something went wrong loading this form." });
  }
}

module.exports = { submitForm, getPublicForm };
