const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const emailHandleController = require("../controllers/emailHandleController");

const requireAuth = [authMiddleware, userSync];

router.get("/", requireAuth, emailHandleController.getEmailHandle);
router.get("/check", requireAuth, emailHandleController.checkAvailability);
router.post("/", requireAuth, emailHandleController.claimHandle);
router.delete("/", requireAuth, emailHandleController.releaseHandle);

module.exports = router;
