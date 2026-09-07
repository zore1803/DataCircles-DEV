const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const userSync = require("../middlewares/userSync");
const subscriptionGate = require("../middlewares/subscriptionGate");
const expenseController = require("../controllers/expenseController");
const uploadMiddlewareS3 = require("../middlewares/uploadMiddlewareS3");

const requireAuth = [authMiddleware, userSync];

// Declared before "/:id" so it isn't swallowed as an id.
router.get("/categories", requireAuth, subscriptionGate, expenseController.categories);
router.get("/exchange-rate", requireAuth, subscriptionGate, expenseController.exchangeRate);
router.post(
  "/attachments",
  requireAuth,
  subscriptionGate,
  uploadMiddlewareS3().single("file"),
  expenseController.uploadAttachment
);

router.get("/", requireAuth, subscriptionGate, expenseController.list);
router.post("/", requireAuth, subscriptionGate, expenseController.create);
router.put("/:id", requireAuth, subscriptionGate, expenseController.update);
router.delete("/:id", requireAuth, subscriptionGate, expenseController.remove);

module.exports = router;
