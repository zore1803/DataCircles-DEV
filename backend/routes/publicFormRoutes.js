// routes/publicFormRoutes.js
// PUBLIC, UNAUTHENTICATED router (FORMS_ARCHITECTURE.md §2.9). Mounted at /api/public/forms.
// Deliberately kept in its own file with NO `requireAuth`/`subscriptionGate`/`checkPermission`
// middleware, so the "this route is intentionally public" property is visible at a glance rather than
// hidden behind a missing middleware call. The owning organization is resolved from the URL slug inside
// the service, never from the client. Do NOT add authenticated form-management routes here — those live
// in a separate `formRoutes.js` under `/api/forms`.
//
// Because it IS public, every route here carries abuse controls (see publicFormRateLimit.js for the
// per-IP + per-form reasoning). No captcha, deliberately: the promise is open link → fill → submit.
const express = require("express");
const router = express.Router();
const publicFormController = require("../controllers/publicFormController");
const { resolveFormOrganization, uploadPublicFormFileSafe } = require("../middlewares/uploadMiddlewarePublicForm");
const { submitPerIp, submitPerForm, uploadPerIp, uploadPerForm, readPerIp } = require("../middlewares/publicFormRateLimit");

// The app-wide body parser allows 50mb, sized for authenticated document/import payloads. A form
// submission is a small JSON object of field values, so this router takes a far tighter limit —
// there is no reason for an anonymous caller to be able to post 50MB of JSON at an endpoint that
// then does duplicate detection over it. Mounted BEFORE the routes so it wins for this path.
// (File bytes do not pass through here: uploads are multipart and handled by multer, which has its
// own 5MB cap.)
const publicJson = express.json({ limit: "100kb" });

// POST /api/public/forms/:publicSlug/submit
router.post("/:publicSlug/submit", submitPerIp, submitPerForm, publicJson, publicFormController.submitForm);
// GET /api/public/forms/:publicSlug
router.get("/:publicSlug", readPerIp, publicFormController.getPublicForm);
// POST /api/public/forms/:publicSlug/upload — a "file"-type field uploads here first and gets back
// a URL, which is then submitted like any other string field value in the /submit call above. Kept
// as a separate step (rather than making /submit accept multipart) so the submission payload stays
// a plain JSON object regardless of whether the form has file fields.
router.post(
  "/:publicSlug/upload",
  uploadPerIp,
  uploadPerForm,
  resolveFormOrganization,
  uploadPublicFormFileSafe,
  publicFormController.uploadFile
);

module.exports = router;
