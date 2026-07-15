// routes/publicFormRoutes.js
// PUBLIC, UNAUTHENTICATED router (FORMS_ARCHITECTURE.md §2.9). Mounted at /api/public/forms.
// Deliberately kept in its own file with NO `requireAuth`/`subscriptionGate`/`checkPermission`
// middleware, so the "this route is intentionally public" property is visible at a glance rather than
// hidden behind a missing middleware call. The owning organization is resolved from the URL slug inside
// the service, never from the client. Do NOT add authenticated form-management routes here — those live
// in a separate `formRoutes.js` under `/api/forms` (a later phase).
const express = require("express");
const router = express.Router();
const publicFormController = require("../controllers/publicFormController");

// POST /api/public/forms/:publicSlug/submit
router.post("/:publicSlug/submit", publicFormController.submitForm);
// GET /api/public/forms/:publicSlug
router.get("/:publicSlug", publicFormController.getPublicForm);

module.exports = router;
