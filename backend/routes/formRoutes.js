// routes/formRoutes.js
// Authenticated Forms management routes (Phase 1b). Mounted at /api so both /api/forms/* and
// /api/duplicate-reviews/* resolve from this one router — DuplicateReview is deliberately not
// Forms-specific in its data shape (FORMS_DOMAIN_MODEL.md §3 / D6 shared-engine decision), so its
// routes live at their own top-level path, not nested under /forms.
//
// Middleware stack matches every other authenticated module exactly: requireAuth -> subscriptionGate
// -> restrictByPlan("forms", "read"|"write") -> checkPermission("forms", "readonly"|"read-write").
const express = require("express");
const router = express.Router();
const formController = require("../controllers/formController");
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const restrictByPlan = require("../middlewares/restrictByPlan");
const checkPermission = require("../middlewares/checkPermission");

const requireAuth = [authMiddleware, userSync];
const readGate = [requireAuth, subscriptionGate, restrictByPlan("forms", "read"), checkPermission("forms", "readonly")];
const writeGate = [requireAuth, subscriptionGate, restrictByPlan("forms", "write"), checkPermission("forms", "read-write")];

// --- Forms CRUD / publish ---
router.get("/forms", readGate, formController.listForms);
router.post("/forms", writeGate, formController.createForm);
router.get("/forms/:id", readGate, formController.getForm);
router.patch("/forms/:id", writeGate, formController.updateForm);
router.post("/forms/:id/publish", writeGate, formController.publishForm);
router.post("/forms/:id/archive", writeGate, formController.archiveForm);
router.post("/forms/:id/pause", writeGate, formController.pauseForm);
router.post("/forms/:id/resume", writeGate, formController.resumeForm);
router.delete("/forms/:id", writeGate, formController.deleteForm);

// --- Submissions ---
router.get("/forms/:id/submissions", readGate, formController.listSubmissions);
router.get("/forms/:id/submissions/:submissionId", readGate, formController.getSubmission);

// --- Duplicate Review Center ---
router.get("/duplicate-reviews", readGate, formController.listDuplicateReviews);
router.get("/duplicate-reviews/:id", readGate, formController.getDuplicateReview);
router.post("/duplicate-reviews/:id/keep-separate", writeGate, formController.resolveKeepSeparate);
router.post("/duplicate-reviews/:id/link", writeGate, formController.resolveLinkToExisting);
router.post("/duplicate-reviews/:id/merge", writeGate, formController.resolveMerge);

module.exports = router;
