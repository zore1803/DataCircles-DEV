const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSyncMiddleware = require("../middlewares/userSync");
const sessionAuth = require("../middlewares/sessionAuth");
const csrfCheck = require("../middlewares/csrfCheck");
const sessionController = require("../controllers/sessionController");

// Establishment boundary: still verifies the existing Auth0/phone JWT.
// Everything below this line authenticates off the DataCircles session
// cookie instead.
router.post(
  "/establish",
  authMiddleware,
  userSyncMiddleware,
  sessionController.establish,
);

router.get("/me", sessionAuth, sessionController.me);
router.get("/csrf-token", sessionAuth, sessionController.csrfToken);
router.post("/logout", sessionController.logout);
router.get("/", sessionAuth, sessionController.list);
router.delete("/:id", sessionAuth, csrfCheck, sessionController.revoke);
router.post("/logout-others", sessionAuth, csrfCheck, sessionController.logoutOthers);

module.exports = router;
